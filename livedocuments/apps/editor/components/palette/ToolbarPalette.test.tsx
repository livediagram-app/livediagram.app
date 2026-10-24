// @vitest-environment jsdom
// The palette strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the editor's add-handlers.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import type { Element } from '@livedocuments/document';
import { requestToolbarSearch } from '@/lib/toolbar-search-request';

const mobile = vi.hoisted(() => ({ value: false }));
// The window's width.
const viewport = vi.hoisted(() => ({ width: 1440 }));
vi.mock('@/hooks/ui/useViewportWidth', () => ({ useViewportWidth: () => viewport.width }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
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
  it("shows Pages' categories on the strip, with the selection mode and Search", () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search elements' })).toBeTruthy();
    // Every name one word.
    expect(barNames()).toEqual([
      'Shapes',
      'Write',
      'Concepts',
      'Components',
      'Devices',
      'Icons',
      'Stickers',
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
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(within(flyout()!).getByRole('button', { name: 'Add Square' })).toBeTruthy();
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

    it('ends the strip', () => {
      show();
      const buttons = within(strip()).getAllByRole('button');
      expect(buttons.at(-1)?.getAttribute('aria-label')).toBe('Search elements');
    });

    it('opens focused, and finds a tile from any category of the mode', () => {
      const { h } = show();
      const popover = openSearch();
      expect(document.activeElement).toBe(
        within(popover).getByRole('textbox', { name: 'Search elements' }),
      );
      type(popover, 'database');
      fireEvent.click(within(popover).getByRole('button', { name: 'Add Cylinder' }));
      expect(h.onAddShape).toHaveBeenCalledWith('cylinder', expect.anything());
      // Used, so closed: the canvas is clear to draw on.
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it('lists only the element types on the tab before anything is typed', () => {
      show({
        tabElements: [
          { id: 'a', type: 'shape', shape: 'diamond', x: 0, y: 0, width: 1, height: 1 },
        ] as unknown as Element[],
      });
      const popover = openSearch();
      expect(popover.textContent).toContain('On This Tab');
      expect(
        within(popover)
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label'))
          .filter((l) => l?.startsWith('Add ')),
      ).toEqual(['Add Diamond']);
      cleanup();
      show();
      expect(openSearch().textContent).toContain('No elements on this tab yet');
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
      type(popover, 'circle');
      fireEvent.keyDown(within(popover).getByRole('textbox', { name: 'Search elements' }), {
        key: 'Enter',
      });
      expect(h.onAddShape).toHaveBeenCalledWith('circle', expect.anything());
    });

    it('says so when nothing matches anywhere', () => {
      show();
      const popover = openSearch();
      type(popover, 'zzqqxx');
      expect(popover.textContent).toContain('No elements match “zzqqxx”');
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
      type(popover, 'pie chart');
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      popover = openSearch();
      expect(
        within(popover).getByRole<HTMLInputElement>('textbox', { name: 'Search elements' }).value,
      ).toBe('');
    });
  });
});
