// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModeBanner } from './ModeBanner';
import { usePaletteStripBox, useToolbarBox } from './PaletteTray';

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

function Banner({ onAction }: { onAction: () => void }) {
  const tray = usePaletteStripBox();
  return (
    <ModeBanner
      icon={<span>✎</span>}
      message="Select the board column you want this card to appear in"
      onAction={onAction}
      tray={tray}
    />
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

  it('hangs a mode banner from the strip, flush with its bottom edge and no wider', () => {
    mountStrip();
    const onAction = vi.fn();
    render(<Banner onAction={onAction} />);
    const tray = document.querySelector('[data-palette-tray]') as HTMLElement;
    expect(tray).not.toBeNull();
    expect(tray.textContent).toContain('Select the board column');
    const slot = tray.parentElement!;
    expect(slot.style.left).toBe('300px');
    expect(slot.style.width).toBe('600px');
    // Up a pixel over the strip's bottom border (12 + 46 - 1).
    expect(slot.style.top).toBe('57px');
    expect(tray.className).toContain('rounded-b-xl');
    expect(tray.className).toContain('border-t-0');
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

  // docs/specs/007-editor/start-diagramming.md "Bringing it back": an empty Draw tab's pill stands clear of the dock,
  // which mounts a beat after the pill asks where it is. Only a resize measured it again, so the pill kept its no-dock
  // place and sat on the dock's tools.
  it('measures a toolbar that arrives after it was first asked for', async () => {
    function Probe() {
      const box = useToolbarBox('[data-whiteboard-dock]');
      return <output data-testid="box">{box ? `${box.top}-${box.bottom}` : 'none'}</output>;
    }
    render(<Probe />);
    expect(screen.getByTestId('box').textContent).toBe('none');
    const dock = document.createElement('div');
    dock.setAttribute('data-whiteboard-dock', '');
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
    await act(async () => {
      document.body.append(dock);
      await Promise.resolve();
    });
    expect(screen.getByTestId('box').textContent).toBe('12-58');
  });
});
