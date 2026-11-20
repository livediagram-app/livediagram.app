// @vitest-environment jsdom
// The palette strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the editor's add-handlers.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import type { Element } from '@liveknowledge/document';
import { requestToolbarSearch } from '@liveworkspace/workbench/lib/toolbar-search-request';
import { PACKED_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';

const mobile = vi.hoisted(() => ({ value: false }));
// The window's width.
const viewport = vi.hoisted(() => ({ width: 1440 }));
vi.mock('@liveworkspace/workbench/hooks/ui/useViewportWidth', () => ({
  useViewportWidth: () => viewport.width,
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

beforeAll(() => {
  // The strip's rail measures itself; jsdom has no layout, so a no-op
  // observer is all it needs.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  mobile.value = false;
  viewport.width = 1440;
});

function handlers(): PaletteAddHandlers {
  return Object.fromEntries(
    PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
  ) as unknown as PaletteAddHandlers;
}

function show(
  props: {
    hidden?: boolean;
    tabElements?: Element[];
  } = {},
) {
  const h = handlers();
  const onSetCanvasTool = vi.fn();
  const view = render(
    <ToolbarPalette
      canvasTool="select"
      onSetCanvasTool={onSetCanvasTool}
      canvasEmpty={false}
      pendingDraw={null}
      {...h}
      {...props}
    />,
  );
  return { ...view, h, onSetCanvasTool };
}

// The strip's card, not the popovers hanging from it.
const strip = () => document.querySelector('[data-toolbar-palette] > div') as HTMLElement;

// The category bar's buttons, in order (docs/specs/007-editor/toolbar-layout.md "The category bar").
const barNames = () =>
  [...document.querySelectorAll('[data-category-bar-button]')].map((b) =>
    b.getAttribute('aria-label'),
  );
const flyout = () => document.querySelector<HTMLElement>('[data-category-flyout]');
const openFlyout = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  const el = flyout();
  expect(el, `${name}'s flyout`).not.toBeNull();
  return el!;
};

describe('ToolbarPalette', () => {
  it("shows Pages' categories on the strip, with the selection mode", () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    // Every name one word.
    expect(barNames()).toEqual([
      'Shapes',
      'Write',
      'Concepts',
      'Components',
      'Icons',
      'Media',
      'Data',
    ]);
    // No tiles of their own on the strip: they are in the flyouts.
    expect(within(strip()).queryByRole('button', { name: 'Add Square' })).toBeNull();
  });

  it("reaches the same add-handler as the Palette from a category's flyout, and closes it", () => {
    const { h } = show();
    fireEvent.click(within(openFlyout('Shapes')).getByRole('button', { name: 'Add Square' }));
    expect(h.onAddShape).toHaveBeenCalledWith('square', expect.anything());
    expect(flyout()).toBeNull();
  });

  // docs/specs/004-interface-design/touch-targets.md "touch-target-packed": the card packs its tiles' 44 x 44 touch pads
  // behind them, which needs the card's own stacking context, so a category's flyout hangs beside the card, never in it.
  it('packs the card’s touch pads, and hangs a category’s flyout outside the card', () => {
    show();
    const card = document.querySelector<HTMLElement>(
      '[data-toolbar-palette] [data-tour-id="palette"]',
    )!;
    for (const cls of PACKED_TOOLBAR_ITEMS.split(' ')) expect(card.classList).toContain(cls);
    expect(card.contains(openFlyout('Shapes'))).toBe(false);
  });

  // docs/specs/007-editor/toolbar-layout.md "On a phone": held sideways the row has no menu card, and the strip
  // keeps the phone's swiping row rather than turning into the desktop's centred one.
  it('keeps the phone’s swiping row with no menu card', () => {
    mobile.value = true;
    render(
      <ToolbarPalette
        canvasTool="select"
        onSetCanvasTool={vi.fn()}
        canvasEmpty={false}
        pendingDraw={null}
        leading={null}
        {...handlers()}
      />,
    );
    expect(document.querySelector('[data-strip-leading]')).toBeNull();
    // The swiping card: its rail gives way, the controls beside it keep their size.
    const card = document.querySelector('[data-tour-id="palette"]')!;
    expect(card.className).toContain('min-w-0');
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    // On a phone the bar swipes, so it names every category (toolbar-layout.md "On a phone", owner 2026-11-09).
    const bar = [...document.querySelectorAll('[data-category-bar-button]')];
    expect(bar.length).toBeGreaterThan(0);
    for (const b of bar) expect(b.textContent).toBe(b.getAttribute('aria-label'));
  });

  it('draws the menu card on a phone’s row when given one', () => {
    mobile.value = true;
    render(
      <ToolbarPalette
        canvasTool="select"
        onSetCanvasTool={vi.fn()}
        canvasEmpty={false}
        pendingDraw={null}
        leading={<button type="button">Menu</button>}
        {...handlers()}
      />,
    );
    expect(document.querySelector('[data-strip-leading]')).not.toBeNull();
  });

  it("focuses a catalogue's search field when its flyout opens (docs/specs/007-editor/toolbar-layout.md)", () => {
    show();
    const popover = openFlyout('Icons');
    expect(document.activeElement).toBe(
      within(popover).getByPlaceholderText('Search icons and stickers'),
    );
  });

  // The owner's request (2026-11-15): Icons and Stickers are one category, a switch picking which it browses.
  it('turns Icons to its Stickers side and back with the switch beside its search', () => {
    show();
    const popover = openFlyout('Icons');
    const side = (name: string) =>
      within(within(popover).getByRole('group', { name: 'Browse' })).getByRole('button', { name });
    expect(side('Icons').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(side('Stickers'));
    expect(side('Stickers').getAttribute('aria-pressed')).toBe('true');
    expect(within(popover).getByRole('navigation', { name: 'stickers groups' })).toBeTruthy();
    fireEvent.click(side('Icons'));
    expect(within(popover).getByRole('navigation', { name: 'icons groups' })).toBeTruthy();
  });

  it('leaves focus alone on a touch screen, where it would raise the keyboard (Work Tracker 1224)', () => {
    mobile.value = true;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    try {
      show();
      const popover = openFlyout('Icons');
      expect(document.activeElement).not.toBe(
        within(popover).getByPlaceholderText('Search icons and stickers'),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('focuses Search at a narrow width with a mouse, so keys typed straight away go in (Work Tracker 1224)', () => {
    mobile.value = true;
    show();
    const popover = openFlyout('Icons');
    expect(document.activeElement).toBe(
      within(popover).getByPlaceholderText('Search icons and stickers'),
    );
  });

  it('switches the flyout to the category pressed next', () => {
    show();
    openFlyout('Icons');
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(within(flyout()!).getByRole('button', { name: 'Add Square' })).toBeTruthy();
    expect(within(flyout()!).queryByPlaceholderText('Search icons and stickers')).toBeNull();
  });

  it('closes the flyout on Escape', () => {
    show();
    openFlyout('Icons');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
  });

  it('hides rather than unmounts', () => {
    const view = show();
    const h = handlers();
    const rerender = (hidden: boolean) =>
      view.rerender(
        <ToolbarPalette
          canvasTool="select"
          onSetCanvasTool={vi.fn()}
          canvasEmpty={false}
          pendingDraw={null}
          hidden={hidden}
          {...h}
        />,
      );
    rerender(true);
    const root = document.querySelector('[data-toolbar-palette]') as HTMLElement;
    expect(root.classList.contains('hidden')).toBe(true);
    rerender(false);
    expect(root.classList.contains('hidden')).toBe(false);
  });

  // A knowledgebase is searched by its pages (Cmd or Ctrl K): the fork's Search Elements is not on the strip, and S
  // opens nothing (docs/specs/002-project-scope/not-in-liveknowledge.md).
  describe('no Search Elements', () => {
    it('has no Search button on the strip', () => {
      show();
      expect(screen.queryByRole('button', { name: /search elements/i })).toBeNull();
      expect(document.querySelector('[data-toolbar-search-button]')).toBeNull();
    });

    it('answers no request for it: a key typed outside the writing opens nothing', () => {
      show();
      act(() => {
        expect(requestToolbarSearch()).toBe(false);
      });
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });
  });
});
