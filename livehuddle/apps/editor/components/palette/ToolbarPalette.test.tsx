// @vitest-environment jsdom
// The palette strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the editor's add-handlers.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { type Element } from '@livehuddle/document';
import { requestToolbarSearch } from '@liveworkspace/workbench/lib/toolbar-search-request';

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

function show({
  ...props
}: {
  hidden?: boolean;
  tabElements?: Element[];
} = {}) {
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

// The tiles in the strip itself, not in the More popover.
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
  // docs/specs/012-collaboration/workshop-mode.md "The palette": the meeting palette's bar, no Popular, no Session.
  it('shows the meeting palette on the strip, with the selection mode and Search, and no category picker', () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search elements' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Palette category' })).toBeNull();
    expect(barNames()).toEqual([
      'Write',
      'Frame',
      'Navigate',
      'React',
      'Modes',
      'Icons',
      'Stickers',
      'Media',
    ]);
    // No tiles of their own on the strip: they are in the flyouts.
    expect(within(strip()).queryByRole('button', { name: 'Add Frame' })).toBeNull();
  });

  it("reaches the same add-handler as the Palette from a category's flyout, and closes it", () => {
    const { h } = show();
    fireEvent.click(within(openFlyout('Frame')).getByRole('button', { name: 'Add Frame' }));
    expect(h.onAddShape).toHaveBeenCalledWith('frame', expect.anything());
    expect(flyout()).toBeNull();
  });

  it('opens Navigate on the places and seats, then the office pieces, one level deep', () => {
    show();
    const navigate = openFlyout('Navigate');
    expect(within(navigate).getByText('Around the Space')).toBeTruthy();
    expect(within(navigate).getByText('Office Pieces')).toBeTruthy();
    fireEvent.click(within(navigate).getByRole('button', { name: 'Add Room' }));
    expect(flyout()).toBeNull();
  });

  it("focuses a catalogue's search field when its flyout opens (docs/specs/007-editor/toolbar-layout.md)", () => {
    show();
    const popover = openFlyout('Icons');
    expect(document.activeElement).toBe(within(popover).getByPlaceholderText('Search icons'));
  });

  it('leaves focus alone on a phone, where it would raise the keyboard', () => {
    mobile.value = true;
    show();
    const popover = openFlyout('Icons');
    expect(document.activeElement).not.toBe(within(popover).getByPlaceholderText('Search icons'));
  });

  it('switches the flyout to the category pressed next', () => {
    show();
    openFlyout('Icons');
    fireEvent.click(screen.getByRole('button', { name: 'Frame' }));
    expect(within(flyout()!).getByRole('button', { name: 'Add Frame' })).toBeTruthy();
    expect(within(flyout()!).queryByPlaceholderText('Search icons')).toBeNull();
  });

  it('closes the flyout on Escape', () => {
    show();
    openFlyout('Icons');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
  });

  describe('Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type")', () => {
    // The icon catalogues load as a chunk of their own, as the editor loads them on its first paint: loaded
    // before the searches run, so what they find never depends on whether the chunk happened to land.
    beforeAll(() => ensureIconCatalogs());

    const openSearch = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      return document.querySelector('[data-toolbar-search]') as HTMLElement;
    };
    const type = (popover: HTMLElement, q: string) =>
      fireEvent.change(within(popover).getByRole('textbox', { name: 'Search elements' }), {
        target: { value: q },
      });

    it('opens focused, and finds a tile from any category of the palette', () => {
      const { h } = show();
      const popover = openSearch();
      expect(document.activeElement).toBe(
        within(popover).getByRole('textbox', { name: 'Search elements' }),
      );
      type(popover, 'coffee');
      fireEvent.click(within(popover).getByRole('button', { name: 'Add Coffee Machine' }));
      expect(h.onAddShape).toHaveBeenCalledWith('coffee-machine', expect.anything());
      // Used, so closed: the canvas is clear to draw on.
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it('lists only the element types on the tab before anything is typed', () => {
      show({
        tabElements: [
          { id: 'a', type: 'shape', shape: 'frame', x: 0, y: 0, width: 1, height: 1 },
        ] as unknown as Element[],
      });
      const popover = openSearch();
      expect(popover.textContent).toContain('On This Tab');
      expect(
        within(popover)
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label'))
          .filter((l) => l?.startsWith('Add ')),
      ).toEqual(['Add Frame']);
      cleanup();
      show();
      expect(openSearch().textContent).toContain('No elements on this tab yet');
    });

    // docs/specs/012-collaboration/workshop-mode.md "The palette": a leaving element is placed from nowhere.
    it('finds nothing the palette does not offer, with no other section to look in', () => {
      show();
      const popover = openSearch();
      for (const [q, gone] of [
        ['marker', /^Marker \d/],
        ['cylinder', /^Add Cylinder$/],
        ['lane', /^Add Lane$/],
        ['poll', /^Add Poll$/],
      ] as const) {
        type(popover, q);
        expect(within(popover).queryAllByRole('button', { name: gone }), q).toEqual([]);
      }
      expect(popover.textContent).not.toMatch(/Other Modes|Not Available/);
    });

    it('opens on S where it is shown, and leaves S to Select where it is not', () => {
      show();
      act(() => {
        expect(requestToolbarSearch()).toBe(true);
      });
      expect(document.querySelector('[data-toolbar-search]')).not.toBeNull();
      cleanup();
      show({ hidden: true });
      expect(requestToolbarSearch()).toBe(false);
    });

    it('uses the best match on Enter', () => {
      const { h } = show();
      const popover = openSearch();
      type(popover, 'frame');
      fireEvent.keyDown(within(popover).getByRole('textbox', { name: 'Search elements' }), {
        key: 'Enter',
      });
      expect(h.onAddShape).toHaveBeenCalledWith('frame', expect.anything());
    });

    it('says so when nothing matches anywhere', () => {
      show();
      const popover = openSearch();
      type(popover, 'zzqqxx');
      expect(popover.textContent).toContain('No elements match “zzqqxx”');
      expect(
        within(popover).queryByRole('button', { name: /Elements From Other Modes|Not Available/ }),
      ).toBeNull();
    });

    it("is one strip menu at a time with a category's flyout, and closes on Escape", () => {
      show();
      openFlyout('Icons');
      const searchButton = screen.getByRole('button', { name: 'Search elements' });
      fireEvent.pointerDown(searchButton);
      fireEvent.click(searchButton);
      expect(flyout()).toBeNull();
      expect(document.querySelector('[data-toolbar-search]')).not.toBeNull();
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it('starts afresh each time it opens', () => {
      show();
      let popover = openSearch();
      type(popover, 'room');
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      popover = openSearch();
      expect(
        within(popover).getByRole<HTMLInputElement>('textbox', { name: 'Search elements' }).value,
      ).toBe('');
    });
  });
});
