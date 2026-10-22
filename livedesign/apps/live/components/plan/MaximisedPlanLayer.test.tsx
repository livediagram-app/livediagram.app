// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  finishRestore,
  getMaximisedPlanId,
  isMaximisedPlanClosing,
  maximisePlanElement,
  releasePlanElement,
  restorePlanElement,
  useMaximisedPlanId,
} from '@/hooks/plan/maximised-plan';
import { MOTION_MS } from '@livedesign/tailwind-config/motion';
import { CanvasPatternContext } from '@/components/canvas/canvas-pattern-context';
import {
  CanvasCover,
  MaximisableSlot,
  originOf,
  useMaximisedPlanLifetime,
} from './MaximisedPlanLayer';

// docs/specs/026-plan/plan-board.md "Maximised board" and plan-views.md "Maximised view": maximising moves the body,
// never remounts it; a view lays out at the overlay's size; one Escape restores, whatever else listens for it.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  finishRestore();
  releasePlanElement(getMaximisedPlanId() ?? '');
  cleanup();
  vi.unstubAllGlobals();
});

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      Count {n}
    </button>
  );
}

function Slot({ onSize }: { onSize?: (s: { width: number; height: number } | null) => void }) {
  const maximised = useMaximisedPlanId() === 'el';
  return (
    <div data-element-id="el">
      <MaximisableSlot
        id="el"
        maximised={maximised}
        placeholder={{ borderWidth: 1 }}
        {...(onSize ? { onMaximisedSize: onSize } : {})}
      >
        <Counter />
      </MaximisableSlot>
    </div>
  );
}

const overlay = () => document.querySelector('[data-maximised-board]');

describe('a maximisable slot', () => {
  it('keeps the body’s state across maximise and restore, moving it into the overlay and back', () => {
    render(<Slot />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Count 1');
    act(() => maximisePlanElement('el'));
    expect(overlay()?.contains(screen.getByRole('button'))).toBe(true);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Count 2');
    // jsdom has no element box to shrink back to, so the restore finishes at once.
    act(() => restorePlanElement());
    expect(overlay()).toBeNull();
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Count 2');
    expect(button.closest('[data-plan-slot="el"]')).not.toBeNull();
  });

  it('stops the body’s presses at the slot only while maximised', () => {
    const onDown = vi.fn();
    render(
      <div onPointerDown={onDown}>
        <Slot />
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('button'));
    expect(onDown).toHaveBeenCalledTimes(1);
    act(() => maximisePlanElement('el'));
    fireEvent.pointerDown(screen.getByRole('button'));
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it('reports the overlay box’s size while maximised, and none after', () => {
    let observe: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observe = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(700);
    const onSize = vi.fn();
    render(<Slot onSize={onSize} />);
    act(() => maximisePlanElement('el'));
    expect(onSize).toHaveBeenLastCalledWith({ width: 1200, height: 700 });
    width.mockReturnValue(1400);
    act(() => observe?.());
    expect(onSize).toHaveBeenLastCalledWith({ width: 1400, height: 700 });
    act(() => restorePlanElement());
    expect(onSize).toHaveBeenLastCalledWith(null);
    width.mockRestore();
    height.mockRestore();
  });
});

describe('Escape while maximised', () => {
  it('restores with one press, even when the editor’s own Escape listener prevents it first', () => {
    // The editor's shortcut listener: registered earlier, on window, deselecting (and preventing) on Escape.
    const editorEscape = vi.fn((e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    });
    window.addEventListener('keydown', editorEscape);
    maximisePlanElement('el');
    renderHook(() => useMaximisedPlanLifetime('el', true, true));
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(isMaximisedPlanClosing()).toBe(true);
    // It went no further: the editor did not also deselect on the same press.
    expect(editorEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', editorEscape);
  });

  it('leaves Escape to a dialog open over the element', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    maximisePlanElement('el');
    renderHook(() => useMaximisedPlanLifetime('el', true, true));
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(isMaximisedPlanClosing()).toBe(false);
    dialog.remove();
  });
});

// Restoring within the opening's grow: the opening's pending reveal is cancelled, so the host stays in its canvas
// slot from the moment restoring begins, and maximising again while it shrinks back runs the opening afresh.
describe('restoring while it is still growing', () => {
  const inSlot = () => !!screen.getByRole('button').closest('[data-plan-slot="el"]');
  const inOverlay = () => !!overlay()?.contains(screen.getByRole('button'));

  function withBoxes() {
    vi.useFakeTimers();
    // Every element a real box, so both phases animate (jsdom lays nothing out).
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 400, 300),
    );
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reveals the body in the box before the grow ends, within the long motion token', () => {
    withBoxes();
    render(<Slot />);
    act(() => maximisePlanElement('el'));
    // Mid-grow: still the empty frame, the body on the canvas.
    expect(inSlot()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long - 120);
    });
    expect(inOverlay()).toBe(true);
  });

  it('keeps the host in its canvas slot once restoring begins, never moving it back into the box', () => {
    withBoxes();
    render(<Slot />);
    act(() => maximisePlanElement('el'));
    act(() => restorePlanElement());
    const box = overlay()?.firstElementChild as HTMLElement;
    const moved = vi.spyOn(box, 'appendChild');
    expect(inSlot()).toBe(true);
    // Past the opening's reveal and its settle: neither runs.
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long);
    });
    expect(inSlot()).toBe(true);
    expect(moved).not.toHaveBeenCalled();
    expect(isMaximisedPlanClosing()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long);
    });
    expect(overlay()).toBeNull();
    expect(inSlot()).toBe(true);
    expect(moved).not.toHaveBeenCalled();
  });

  it('opens again when maximised while it shrinks back', () => {
    withBoxes();
    render(<Slot />);
    act(() => maximisePlanElement('el'));
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long * 2);
    });
    act(() => restorePlanElement());
    expect(inSlot()).toBe(true);
    act(() => maximisePlanElement('el'));
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long * 2);
    });
    expect(isMaximisedPlanClosing()).toBe(false);
    expect(inOverlay()).toBe(true);
  });
});

// docs/specs/026-plan/plan-tabs.md "Slot content": in a Dashboard slot the element is drawn in the slot, its canvas node
// out of sight under the page, so the grow and the shrink measure the slot where it is drawn, at that moment.
describe('where a maximised element grows from and shrinks to', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const boxed = (attrs: Record<string, string>, rect: DOMRect | null) => {
    const node = document.createElement('div');
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.getBoundingClientRect = () => rect ?? new DOMRect(0, 0, 0, 0);
    document.body.appendChild(node);
    return node;
  };

  it('measures the slot the element is drawn in, never its canvas node under the page', () => {
    boxed({ 'data-element-id': 'el' }, new DOMRect(-4000, -3000, 900, 600));
    boxed({ 'data-plan-slot': 'el' }, new DOMRect(40, 220, 500, 320));
    expect(originOf('el')).toEqual(new DOMRect(40, 220, 500, 320));
  });

  it('reads the slot afresh each time (the page scrolled or the row resized while maximised)', () => {
    const slot = boxed({ 'data-plan-slot': 'el' }, new DOMRect(40, 220, 500, 320));
    expect(originOf('el')?.top).toBe(220);
    slot.getBoundingClientRect = () => new DOMRect(40, 80, 500, 320);
    expect(originOf('el')?.top).toBe(80);
  });

  it('falls back to the canvas node while the slot has no box, and to nothing at all', () => {
    boxed({ 'data-plan-slot': 'el' }, null);
    expect(originOf('el')).toBeNull();
    boxed({ 'data-element-id': 'el' }, new DOMRect(10, 20, 300, 200));
    expect(originOf('el')).toEqual(new DOMRect(10, 20, 300, 200));
  });
});

// docs/specs/026-plan/plan-board.md "The header holds the top row": the cover hands the band to the element's header.
describe('the canvas cover', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  // docs/specs/008-canvas/canvas-and-palette.md "Canvas": a cover inherits the canvas's colour and static pattern, but an
  // animated style is a layer of the canvas's own, so the cover draws it again, under what it holds.
  it('draws the canvas’s animated style, under the element, and no other', () => {
    const cover = (pattern: 'aurora' | 'graph' | null) =>
      render(
        <CanvasPatternContext.Provider
          value={pattern ? { pattern, color: '#123456', scale: 1.5, speed: 2, opacity: 0.5 } : null}
        >
          <CanvasCover layout={{ insets, band: null }} marker={{ 'data-x': '' }}>
            <span />
          </CanvasCover>
        </CanvasPatternContext.Provider>,
      ).container;
    const moving = cover('aurora');
    const layer = moving.querySelector<HTMLElement>('[data-animated-pattern="aurora"]')!;
    expect(layer.style.opacity).toBe('0.5');
    expect(layer.style.getPropertyValue('--lvd-pat')).toBe('#123456');
    expect(layer.style.getPropertyValue('--lvd-bg-speed')).toBe('2');
    // First in the cover, so the element (a later positioned sibling) paints over it.
    expect(
      moving
        .querySelector('[data-canvas-cover] > :first-child')!
        .hasAttribute('data-tab-pattern-layer'),
    ).toBe(true);
    expect(moving.querySelector('[data-canvas-cover] > [data-x]')).not.toBeNull();
    cleanup();
    // A static pattern rides the inherited background; nothing is drawn twice.
    expect(cover('graph').querySelector('[data-tab-pattern-layer]')).toBeNull();
    cleanup();
    expect(cover(null).querySelector('[data-tab-pattern-layer]')).toBeNull();
  });

  it('sets the header band for the element it holds, and none without one', () => {
    // The cover sits in the canvas, as it is portalled there; the strip's place is set on the canvas.
    const main = document.createElement('main');
    document.body.appendChild(main);
    const { container, rerender } = render(
      <CanvasCover
        layout={{ insets, band: { height: 53, left: 124, mid: 349, stripEnd: 300 } }}
        marker={{}}
      >
        <span />
      </CanvasCover>,
      { container: main },
    );
    expect(main.style.getPropertyValue('--plan-strip-end')).toBe('300px');
    expect(main.style.getPropertyValue('--plan-strip-align')).toBe('flex-end');
    // The strip goes flush on the header while it is in the band (BAND_STRIP_FLUSH).
    expect(main.hasAttribute('data-strip-in-band')).toBe(true);
    const inner = container.querySelector<HTMLElement>('[data-header-band]')!;
    expect(inner.style.getPropertyValue('--plan-band-h')).toBe('53px');
    expect(inner.style.getPropertyValue('--plan-band-left')).toBe('124px');
    expect(inner.style.getPropertyValue('--plan-band-mid')).toBe('349px');
    rerender(
      <CanvasCover layout={{ insets: { ...insets, top: 66 }, band: null }} marker={{}}>
        <span />
      </CanvasCover>,
    );
    expect(container.querySelector('[data-header-band]')).toBeNull();
    const plain = container.querySelector<HTMLElement>('[data-canvas-cover] > div')!;
    expect(plain.style.top).toBe('66px');
    expect(plain.style.getPropertyValue('--plan-band-h')).toBe('');
    // No band: the strip is centred again.
    expect(main.style.getPropertyValue('--plan-strip-end')).toBe('');
    expect(main.hasAttribute('data-strip-in-band')).toBe(false);
    main.remove();
  });

  it("lends the element's hue to the chrome in its band, and takes it back", () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
    const band = { height: 53, left: 124, mid: 349, stripEnd: 300 };
    const { rerender } = render(
      <CanvasCover layout={{ insets, band }} marker={{}} tint="#0284c7">
        <span />
      </CanvasCover>,
      { container: main },
    );
    expect(main.dataset.bandTint).toBe('');
    expect(main.style.getPropertyValue('--band-tint')).toBe('#0284c7');
    // No band (the top row has no room for it): the chrome keeps its own colours.
    rerender(
      <CanvasCover layout={{ insets, band: null }} marker={{}} tint="#0284c7">
        <span />
      </CanvasCover>,
    );
    expect(main.dataset.bandTint).toBeUndefined();
    expect(main.style.getPropertyValue('--band-tint')).toBe('');
    main.remove();
  });
});
