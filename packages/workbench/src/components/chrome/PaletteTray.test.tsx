// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  PALETTE_TRAY_MIN_WIDTH_PX,
  PaletteTray,
  pillPlace,
  TemplateExampleTray,
  traySlot,
  usePaletteStripBox,
  usePaletteTrayShown,
  useToolbarBox,
} from './PaletteTray';

// docs/specs/007-editor/toolbar-layout.md "Layout details": messages hang from the strip as its tray.

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// A stand-in for ToolbarPalette's strip card, at a known place on screen.
function mountStrip({ hidden = false }: { hidden?: boolean } = {}) {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  if (hidden) root.className = 'hidden';
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
  root.append(card);
  document.body.append(root);
}

// A message as the editor hangs one (the Shift hint, ModifierHintBanner): in the tray under the strip, else a pill.
function Banner({ onAction }: { onAction: () => void }) {
  const tray = usePaletteStripBox();
  const message = 'Select the board column you want this card to appear in';
  if (!tray) return <div>{message}</div>;
  return (
    <PaletteTray
      box={tray}
      lead={<span>✎</span>}
      end={
        <button type="button" onClick={onAction}>
          Cancel
        </button>
      }
    >
      {message}
    </PaletteTray>
  );
}

describe('the palette tray', () => {
  it("follows the strip's card when its centring box moves it without resizing it", () => {
    // The card sits in SnapWidth's two boxes; the outer one takes its whole-pixel width a beat later, which moves
    // the centred card without the card resizing again.
    const observed: Element[] = [];
    let fire: () => void = () => {};
    const Original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        fire = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      const root = document.createElement('div');
      root.setAttribute('data-toolbar-palette', '');
      const outer = document.createElement('div');
      const inner = document.createElement('div');
      const card = document.createElement('div');
      card.setAttribute('data-tour-id', 'palette');
      const rect = vi
        .spyOn(card, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(300, 12, 600, 46));
      inner.append(card);
      outer.append(inner);
      root.append(outer);
      document.body.append(root);
      render(<Banner onAction={() => {}} />);
      expect(observed).toContain(card);
      expect(observed).toContain(outer);
      rect.mockReturnValue(new DOMRect(380, 12, 440, 46));
      act(() => fire());
      const slot = (document.querySelector('[data-palette-tray]') as HTMLElement).parentElement!;
      expect(slot.style.left).toBe('380px');
      expect(slot.style.width).toBe('440px');
    } finally {
      globalThis.ResizeObserver = Original;
    }
  });

  // Work Tracker 1027: the strip re-centres when the tab-name pill beside it changes width (a tab switch, a delete, a
  // reload), moving without resizing, and the tray stayed where the strip had been.
  it('re-measures the tray slot when the strip moves without resizing', () => {
    let moved: (entries: { intersectionRatio: number }[]) => void = () => {};
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof moved) {
          moved = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      const root = document.createElement('div');
      root.setAttribute('data-toolbar-palette', '');
      const card = document.createElement('div');
      card.setAttribute('data-tour-id', 'palette');
      const rect = vi
        .spyOn(card, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(300, 12, 600, 46));
      root.append(card);
      document.body.append(root);
      render(<Banner onAction={() => {}} />);
      const slot = () =>
        (document.querySelector('[data-palette-tray]') as HTMLElement).parentElement!;
      expect(slot().style.left).toBe('300px');
      act(() => moved([{ intersectionRatio: 1 }]));
      rect.mockReturnValue(new DOMRect(560, 12, 600, 46));
      act(() => moved([{ intersectionRatio: 0.6 }]));
      expect(slot().style.left).toBe('560px');
      expect(slot().style.width).toBe('600px');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sits a mode banner just under the strip, apart from it and no wider', () => {
    mountStrip();
    const onAction = vi.fn();
    render(<Banner onAction={onAction} />);
    const tray = document.querySelector('[data-palette-tray]') as HTMLElement;
    expect(tray).not.toBeNull();
    expect(tray.textContent).toContain('Select the board column');
    const slot = tray.parentElement!;
    expect(slot.style.left).toBe('300px');
    expect(slot.style.width).toBe('600px');
    // A small gap under the strip's bottom edge (12 + 46 + 6), a card of its own with all four corners rounded.
    expect(slot.style.top).toBe('64px');
    expect(tray.className).toContain('rounded-xl');
    expect(tray.className).not.toContain('border-t-0');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('stays a top-centre pill without a strip, or with the strip hidden', () => {
    render(<Banner onAction={() => {}} />);
    expect(document.querySelector('[data-palette-tray]')).toBeNull();
    expect(screen.getByText(/Select the board column/)).toBeTruthy();
    cleanup();
    mountStrip({ hidden: true });
    render(<Banner onAction={() => {}} />);
    expect(document.querySelector('[data-palette-tray]')).toBeNull();
  });

  // A toolbar can mount a beat after something asks where it is; only a resize measured it again, so whatever stood
  // clear of it kept its no-toolbar place and sat on its tools.
  it('measures a toolbar that arrives after it was first asked for', async () => {
    function Probe() {
      const box = useToolbarBox('[data-test-toolbar]');
      return <output data-testid="box">{box ? `${box.top}-${box.bottom}` : 'none'}</output>;
    }
    render(<Probe />);
    expect(screen.getByTestId('box').textContent).toBe('none');
    const dock = document.createElement('div');
    dock.setAttribute('data-test-toolbar', '');
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
    await act(async () => {
      document.body.append(dock);
      await Promise.resolve();
    });
    expect(screen.getByTestId('box').textContent).toBe('12-58');
  });
});

// The tray stacks with the editor's chrome, under the header's popovers (who can see this).
describe('trayHost', () => {
  function stripIn(host: HTMLElement) {
    const root = document.createElement('div');
    root.setAttribute('data-toolbar-palette', '');
    const card = document.createElement('div');
    card.setAttribute('data-tour-id', 'palette');
    root.append(card);
    host.append(root);
  }

  it('is the editor’s box, not the body, so a header popover stands over the tray', async () => {
    const { trayHost } = await import('./PaletteTray');
    const editor = document.createElement('div');
    editor.setAttribute('data-editor-viewport', 'window');
    document.body.append(editor);
    stripIn(editor);
    expect(trayHost()).toEqual({ node: editor, dx: 0, dy: 0 });
  });

  it('falls back to the body without an editor box', async () => {
    const { trayHost } = await import('./PaletteTray');
    stripIn(document.body);
    expect(trayHost().node).toBe(document.body);
  });

  it('measures from a split pane’s corner, as its transform holds the tray', async () => {
    const { trayHost } = await import('./PaletteTray');
    const pane = document.createElement('div');
    pane.setAttribute('data-editor-viewport', 'pane');
    pane.style.transform = 'translateZ(0)';
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(new DOMRect(640, 48, 640, 700));
    document.body.append(pane);
    stripIn(pane);
    expect(trayHost()).toEqual({ node: pane, dx: 640, dy: 48 });
  });
});

describe('traySlot', () => {
  it("is the strip's own place and width when the strip is wide enough", () => {
    expect(traySlot({ left: 300, width: 600, top: 12, bottom: 58 }, 1280)).toEqual({
      left: 300,
      width: 600,
    });
  });

  it('keeps its minimum width, centred under a narrow strip (a locked article: the selection mode and Search)', () => {
    // A 126 px strip centred at 640: the 360 px slot runs from 460 to 820.
    expect(traySlot({ left: 577, width: 126, top: 12, bottom: 58 }, 1280)).toEqual({
      left: 460,
      width: PALETTE_TRAY_MIN_WIDTH_PX,
    });
  });

  it('stays 8 px inside the window', () => {
    expect(traySlot({ left: 700, width: 100, top: 12, bottom: 58 }, 800)).toEqual({
      left: 432,
      width: PALETTE_TRAY_MIN_WIDTH_PX,
    });
    expect(traySlot({ left: 0, width: 100, top: 12, bottom: 58 }, 800)).toEqual({
      left: 8,
      width: PALETTE_TRAY_MIN_WIDTH_PX,
    });
  });

  it('keeps its minimum width on a phone too, at most the window less 8 px each side, so its actions fit', () => {
    // A phone's strip sits beside the menu button, narrower than a tray's actions ("Keep It" ran past its edge).
    expect(traySlot({ left: 91, width: 208, top: 12, bottom: 58 }, 390)).toEqual({
      left: 15,
      width: PALETTE_TRAY_MIN_WIDTH_PX,
    });
    expect(traySlot({ left: 91, width: 138, top: 12, bottom: 58 }, 320)).toEqual({
      left: 8,
      width: 304,
    });
  });
});

describe("the tray's card", () => {
  it("centres under the strip's card when the slot is kept inside the window", () => {
    // A 100 px strip at the window's left edge (centre 50): the 360 px slot is clamped to 8..368 (centre 188), so the
    // spacer after the card starts twice the 138 px offset wide.
    render(
      <PaletteTray box={{ left: 0, width: 100, top: 12, bottom: 58 }} lead={<span />}>
        Tab 1 is empty
      </PaletteTray>,
    );
    const [before, after] = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-palette-tray] ~ span, span:has(~ [data-palette-tray])',
      ),
    ];
    expect(before!.style.flexBasis).toBe('0px');
    expect(after!.style.flexBasis).toBe('276px');
  });
});

// The top-centre stack starts below the tray while one is on screen (toolbar-layout.md "Layout details"), or an
// empty tab's tray covers the Offline banner on a phone.
describe('usePaletteTrayShown', () => {
  function Probe() {
    return <output data-testid="shown">{String(usePaletteTrayShown())}</output>;
  }
  const box = { left: 91, width: 208, top: 12, bottom: 58 };

  it('is true while any tray is on screen, and false once the last one goes', () => {
    const { rerender } = render(
      <>
        <Probe />
      </>,
    );
    expect(screen.getByTestId('shown').textContent).toBe('false');
    rerender(
      <>
        <Probe />
        <PaletteTray box={box} standing lead={<span />}>
          Tab 1 is empty
        </PaletteTray>
        <PaletteTray box={box} lead={<span />}>
          Click to drop
        </PaletteTray>
      </>,
    );
    expect(screen.getByTestId('shown').textContent).toBe('true');
    // The mode banner's tray goes; the standing one is still up.
    rerender(
      <>
        <Probe />
        <PaletteTray box={box} standing lead={<span />}>
          Tab 1 is empty
        </PaletteTray>
      </>,
    );
    expect(screen.getByTestId('shown').textContent).toBe('true');
    rerender(
      <>
        <Probe />
      </>,
    );
    expect(screen.getByTestId('shown').textContent).toBe('false');
  });
});

// liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md: the tray a template's example content
// hangs from the strip, and its top-centre card without one.
describe('the template example tray', () => {
  it('hangs from the strip as a standing message, with Clear Example Content first', () => {
    mountStrip();
    const onClear = vi.fn();
    const onKeep = vi.fn();
    render(<TemplateExampleTray onClear={onClear} onKeep={onKeep} />);
    const tray = screen.getByRole('status');
    expect(tray.hasAttribute('data-yields-to-mode')).toBe(true);
    expect(tray.textContent).toContain('Example content shows how this works.');
    const [clear, keep] = screen.getAllByRole('button');
    expect(clear!.textContent).toBe('Clear Example Content');
    expect(keep!.textContent).toBe('Keep It');
    fireEvent.click(clear!);
    expect(onClear).toHaveBeenCalledTimes(1);
    fireEvent.click(keep!);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('stands at the top centre without a strip', () => {
    const { container } = render(<TemplateExampleTray onClear={() => {}} onKeep={() => {}} />);
    expect(container.querySelector('[data-template-example-pill]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Clear Example Content' })).toBeTruthy();
  });

  it("stands clear of Draw's dock rather than over its tools", () => {
    const dock = document.createElement('div');
    dock.setAttribute('data-whiteboard-dock', '');
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 50, 600, 60));
    document.body.append(dock);
    const { container } = render(<TemplateExampleTray onClear={() => {}} onKeep={() => {}} />);
    const pill = container.querySelector<HTMLElement>('[data-template-example-pill]')!;
    expect(pill.style.top).toBe('120px');
  });
});

describe('pillPlace', () => {
  it('goes under a top dock, over a bottom one, and below the top chrome without one', () => {
    expect(pillPlace({ top: 12, bottom: 60 }, 900)).toEqual({ top: 70 });
    expect(pillPlace({ top: 830, bottom: 880 }, 900)).toEqual({ bottom: 80 });
    expect(pillPlace(null, 900)).toEqual({ top: 80 });
  });
});
