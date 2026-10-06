// @vitest-environment jsdom
// The Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the same handlers the floating Palette's do.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import type { EsBoardControls } from './EventStormingBoardRows';
import type { EditorMode, Element } from '@livediagram/document';
import type { ReactNode } from 'react';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';

const mobile = vi.hoisted(() => ({ value: false }));
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
});

function handlers(): PaletteAddHandlers {
  return Object.fromEntries(
    PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
  ) as unknown as PaletteAddHandlers;
}

// The palette reads the editor mode from the editor's provider; Diagram outside one.
const inMode = (mode: EditorMode, node: ReactNode) => (
  <EditorModeProvider value={{ mode, setMode: vi.fn(), canSwitch: true, canEdit: true }}>
    {node}
  </EditorModeProvider>
);

function show({
  mode = 'diagram',
  ...props
}: {
  esBoard?: boolean;
  hidden?: boolean;
  esBoardControls?: EsBoardControls;
  mode?: EditorMode;
  onAddPage?: () => void;
  tabElements?: Element[];
} = {}) {
  const h = handlers();
  const onSetCanvasTool = vi.fn();
  const view = render(
    inMode(
      mode,
      <ToolbarPalette
        canvasTool="select"
        onSetCanvasTool={onSetCanvasTool}
        canvasEmpty={false}
        pendingDraw={null}
        {...h}
        {...props}
      />,
    ),
  );
  return { ...view, h, onSetCanvasTool };
}

function pickCategory(id: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Palette category' }));
  const option = document.querySelector(`[data-option-id="${id}"]`);
  expect(option, `category ${id} in the menu`).not.toBeNull();
  fireEvent.click(option!);
}

// The tiles in the strip itself, not in the More popover.
const strip = () => document.querySelector('[data-toolbar-palette] > div') as HTMLElement;

describe('ToolbarPalette', () => {
  it('opens on Popular with the selection mode and category pickers', () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Popular',
    );
    // Diagram's Popular leads with the square.
    expect(within(strip()).getByRole('button', { name: 'Add square' })).toBeTruthy();
  });

  it('reaches the same add-handler as the Palette from a strip tile', () => {
    const { h } = show();
    fireEvent.click(within(strip()).getByRole('button', { name: 'Add square' }));
    expect(h.onAddShape).toHaveBeenCalledWith('square', expect.anything());
  });

  it('swaps the tiles when the category changes', () => {
    show({ mode: 'illustrate' });
    pickCategory('devices');
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Devices',
    );
    expect(within(strip()).getByRole('button', { name: 'Add web browser' })).toBeTruthy();
    expect(within(strip()).queryByRole('button', { name: 'Add square' })).toBeNull();
  });

  it('only offers More when the category has more than the strip shows', () => {
    show();
    // Collaborate always has More: its group browser lives there.
    pickCategory('behaviour');
    expect(screen.getByRole('button', { name: 'More Collaborate' })).toBeTruthy();
    cleanup();
    // Devices fits in the strip whole.
    show({ mode: 'illustrate' });
    pickCategory('devices');
    expect(screen.queryByRole('button', { name: /^More/ })).toBeNull();
  });

  // The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
  it('offers the mock-up kit and the charts in Illustrate mode only', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Palette category' }));
    expect(document.querySelector('[data-option-id="devices"]')).toBeNull();
    expect(document.querySelector('[data-option-id="components"]')).toBeNull();
    expect(document.querySelector('[data-option-id="data"]')).toBeNull();
    cleanup();
    show({ mode: 'illustrate' });
    fireEvent.click(screen.getByRole('button', { name: 'Palette category' }));
    expect(document.querySelector('[data-option-id="devices"]')).not.toBeNull();
    expect(document.querySelector('[data-option-id="data"]')).not.toBeNull();
    expect(document.querySelector('[data-option-id="behaviour"]')).toBeNull();
    expect(document.querySelector('[data-option-id="technology"]')).toBeNull();
    expect(document.querySelector('[data-option-id="stickers"]')).not.toBeNull();
  });

  it("opens the category's full body under More, and closes it when a tile is used", () => {
    const { h } = show();
    pickCategory('shapes');
    fireEvent.click(screen.getByRole('button', { name: 'More Shapes' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(popover).not.toBeNull();
    fireEvent.click(within(popover).getByRole('button', { name: 'Add circle' }));
    expect(h.onAddShape).toHaveBeenCalledWith('circle', expect.anything());
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  it('focuses the search field when More opens (docs/specs/007-editor/toolbar-layout.md)', () => {
    show();
    pickCategory('behaviour');
    fireEvent.click(screen.getByRole('button', { name: 'More Collaborate' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(document.activeElement).toBe(
      within(popover).getByPlaceholderText('Search collaboration'),
    );
  });

  it('leaves focus alone on a phone, where it would raise the keyboard', () => {
    mobile.value = true;
    show();
    pickCategory('behaviour');
    fireEvent.click(screen.getByRole('button', { name: 'More Collaborate' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(document.activeElement).not.toBe(
      within(popover).getByPlaceholderText('Search collaboration'),
    );
  });

  it('closes More when the category changes, since it showed the old one', () => {
    show();
    pickCategory('behaviour');
    fireEvent.click(screen.getByRole('button', { name: 'More Collaborate' }));
    expect(document.querySelector('[data-toolbar-more]')).not.toBeNull();
    pickCategory('shapes');
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  it('closes More on Escape', () => {
    show();
    pickCategory('behaviour');
    fireEvent.click(screen.getByRole('button', { name: 'More Collaborate' }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  it('shows only the notation on an event-storming board', () => {
    show({ esBoard: true });
    expect(screen.queryByRole('button', { name: 'Selection mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Palette category' })).toBeNull();
    expect(
      within(strip()).getAllByRole('button', { name: /^Add .* note$/ }).length,
    ).toBeGreaterThan(0);
  });

  // docs/specs/021-event-storming/event-storming.md: the floating palette's board row, in the strip.
  it('offers Add from photo on an event-storming board, as the floating palette does', () => {
    const onImportPhoto = vi.fn();
    show({ esBoard: true, esBoardControls: { onImportPhoto } });
    fireEvent.click(within(strip()).getByRole('button', { name: 'Add from photo' }));
    expect(onImportPhoto).toHaveBeenCalledTimes(1);
  });

  it('keeps Add from photo focusable but inert while it is unavailable', () => {
    const onImportPhoto = vi.fn();
    show({ esBoard: true, esBoardControls: { onImportPhoto, photoDisabled: true } });
    const button = within(strip()).getByRole('button', { name: 'Add from photo' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onImportPhoto).not.toHaveBeenCalled();
  });

  it('offers no Add from photo off a board, or where the deployment has no photo import', () => {
    show({ esBoardControls: { onImportPhoto: vi.fn() } });
    expect(screen.queryByRole('button', { name: 'Add from photo' })).toBeNull();
    cleanup();
    show({ esBoard: true, esBoardControls: {} });
    expect(screen.queryByRole('button', { name: 'Add from photo' })).toBeNull();
  });

  it('hides rather than unmounts, so the chosen category survives', () => {
    const view = show({ mode: 'illustrate' });
    pickCategory('devices');
    const h = handlers();
    const rerender = (hidden: boolean) =>
      view.rerender(
        inMode(
          'illustrate',
          <ToolbarPalette
            canvasTool="select"
            onSetCanvasTool={vi.fn()}
            canvasEmpty={false}
            pendingDraw={null}
            hidden={hidden}
            {...h}
          />,
        ),
      );
    rerender(true);
    const root = document.querySelector('[data-toolbar-palette]') as HTMLElement;
    expect(root.classList.contains('hidden')).toBe(true);
    rerender(false);
    expect(root.classList.contains('hidden')).toBe(false);
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Devices',
    );
  });

  it('ends with Add page in Illustrate mode, but not on a phone (docs/specs/007-editor/illustrate-pages.md)', () => {
    show({ mode: 'illustrate', onAddPage: vi.fn() });
    expect(screen.getByRole('button', { name: 'Add page' })).toBeTruthy();
    cleanup();
    mobile.value = true;
    show({ mode: 'illustrate', onAddPage: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Add page' })).toBeNull();
  });

  describe('Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type")', () => {
    const openSearch = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      return document.querySelector('[data-toolbar-search]') as HTMLElement;
    };
    const type = (popover: HTMLElement, q: string) =>
      fireEvent.change(within(popover).getByRole('textbox', { name: 'Search elements' }), {
        target: { value: q },
      });

    it("ends the strip in every mode's palette, and not on an event-storming board", () => {
      for (const mode of ['diagram', 'illustrate', 'plan'] as const) {
        show({ mode });
        const buttons = within(strip()).getAllByRole('button');
        expect(buttons.at(-1)?.getAttribute('aria-label'), mode).toBe('Search elements');
        cleanup();
      }
      show({ esBoard: true });
      expect(screen.queryByRole('button', { name: 'Search elements' })).toBeNull();
    });

    it('opens focused, and finds a tile from any category of the mode', () => {
      const { h } = show();
      const popover = openSearch();
      expect(document.activeElement).toBe(
        within(popover).getByRole('textbox', { name: 'Search elements' }),
      );
      type(popover, 'database');
      fireEvent.click(within(popover).getByRole('button', { name: 'Add cylinder' }));
      expect(h.onAddShape).toHaveBeenCalledWith('cylinder', expect.anything());
      // Used, so closed: the canvas is clear to draw on.
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it("keeps other modes' elements in a closed accordion until asked", () => {
      const { h } = show();
      const popover = openSearch();
      type(popover, 'pie chart');
      expect(within(popover).queryByRole('button', { name: 'Add pie chart' })).toBeNull();
      expect(popover.textContent).toContain('No Diagram elements match');
      const accordion = within(popover).getByRole('button', { name: /Not in Diagram Mode/ });
      expect(accordion.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(accordion);
      fireEvent.click(within(popover).getByRole('button', { name: 'Add pie chart' }));
      expect(h.onAddShape).toHaveBeenCalledWith('pie-chart', expect.anything());
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
      ).toEqual(['Add diamond']);
      cleanup();
      show();
      expect(openSearch().textContent).toContain('Nothing on this tab yet');
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
      expect(popover.textContent).toContain('No elements match');
      expect(within(popover).queryByRole('button', { name: /Not in/ })).toBeNull();
    });

    it('is one strip menu at a time with More, and closes on Escape', () => {
      show();
      pickCategory('behaviour');
      fireEvent.click(screen.getByRole('button', { name: 'More Collaborate' }));
      const searchButton = screen.getByRole('button', { name: 'Search elements' });
      fireEvent.pointerDown(searchButton);
      fireEvent.click(searchButton);
      expect(document.querySelector('[data-toolbar-more]')).toBeNull();
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
      fireEvent.click(within(popover).getByRole('button', { name: /Not in Diagram Mode/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      popover = openSearch();
      expect(
        (within(popover).getByRole('textbox', { name: 'Search elements' }) as HTMLInputElement)
          .value,
      ).toBe('');
    });
  });
});
