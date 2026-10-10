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
import { MOTION_MS } from '@livediagram/tailwind-config/motion';
import { CanvasCover, MaximisableSlot, useMaximisedPlanLifetime } from './MaximisedPlanLayer';

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
    act(() => vi.advanceTimersByTime(MOTION_MS.long - 120));
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
    act(() => vi.advanceTimersByTime(MOTION_MS.long));
    expect(inSlot()).toBe(true);
    expect(moved).not.toHaveBeenCalled();
    expect(isMaximisedPlanClosing()).toBe(true);
    act(() => vi.advanceTimersByTime(MOTION_MS.long));
    expect(overlay()).toBeNull();
    expect(inSlot()).toBe(true);
    expect(moved).not.toHaveBeenCalled();
  });

  it('opens again when maximised while it shrinks back', () => {
    withBoxes();
    render(<Slot />);
    act(() => maximisePlanElement('el'));
    act(() => vi.advanceTimersByTime(MOTION_MS.long * 2));
    act(() => restorePlanElement());
    expect(inSlot()).toBe(true);
    act(() => maximisePlanElement('el'));
    act(() => vi.advanceTimersByTime(MOTION_MS.long * 2));
    expect(isMaximisedPlanClosing()).toBe(false);
    expect(inOverlay()).toBe(true);
  });
});

// docs/specs/026-plan/plan-board.md "The header holds the top row": the cover hands the band to the element's header.
describe('the canvas cover', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  it('sets the header band for the element it holds, and none without one', () => {
    const { container, rerender } = render(
      <CanvasCover layout={{ insets, band: { height: 53, left: 124, mid: 349 } }} marker={{}}>
        <span />
      </CanvasCover>,
    );
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
  });
});
