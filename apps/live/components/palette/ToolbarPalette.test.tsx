// @vitest-environment jsdom
// The palette strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the editor's add-handlers.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import type { EsBoardControls } from './EventStormingBoardRows';
import { COLLABORATE_CATEGORY_GROUPS } from './palette-tile-defs';
import { paletteCategoriesFor } from './palette-layouts';
import { createShape, type EditorMode, type Element } from '@livediagram/document';
import type { ReactNode } from 'react';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { requestToolbarSearch } from '@/lib/toolbar-search-request';

const mobile = vi.hoisted(() => ({ value: false }));
// The window's width: a narrow one leaves Plan's strip room for only a few tiles, the rest behind More.
const viewport = vi.hoisted(() => ({ width: 1440 }));
vi.mock('@/hooks/ui/useViewportWidth', () => ({ useViewportWidth: () => viewport.width }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));
// A Plan board or Sheet filling its tab (docs/specs/026-plan/plan-board.md "The palette follows what fills the screen").
const covering = vi.hoisted(() => ({ value: false }));
const sheetFilling = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/plan/plan-cover-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/plan/plan-cover-store')>()),
  useBoardFillingTab: () => covering.value,
  useSheetCovering: () => sheetFilling.value,
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
  covering.value = false;
  sheetFilling.value = false;
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

const COLLAB_IDS = Object.keys(COLLABORATE_CATEGORY_GROUPS);

// The category bar's buttons, in order (docs/specs/007-editor/toolbar-layout.md "The category bar").
const barNames = () =>
  [...document.querySelectorAll('[data-category-bar-button]')].map((b) =>
    b.getAttribute('aria-label'),
  );
const flyout = () => document.querySelector('[data-category-flyout]') as HTMLElement | null;
const openFlyout = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  const el = flyout();
  expect(el, `${name}'s flyout`).not.toBeNull();
  return el!;
};

// A Plan category's tiles (Plan keeps the category picker and its tiles).
const planTiles = (id: string) => {
  const tiles = paletteCategoriesFor('plan').find((c) => c.id === id)?.tiles ?? [];
  expect(tiles.length, `${id}'s tiles`).toBeGreaterThan(0);
  return tiles;
};

describe('ToolbarPalette', () => {
  it("shows Diagram's categories on the strip, with the selection mode and Search, and no category picker", () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search elements' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Palette category' })).toBeNull();
    // No Popular, Write and Draw as one, every name one word.
    expect(barNames()).toEqual(['Shapes', 'Draw', 'Build', 'Concepts', 'Icons', 'Tech', 'Media']);
    // No tiles of their own on the strip: they are in the flyouts.
    expect(within(strip()).queryByRole('button', { name: 'Add Square' })).toBeNull();
  });

  it('keeps the category picker and its tiles in Plan', () => {
    show({ mode: 'plan' });
    expect(screen.getByRole('button', { name: 'Palette category' })).toBeTruthy();
    expect(document.querySelector('[data-category-bar-button]')).toBeNull();
  });

  it("reaches the same add-handler as the Palette from a category's flyout, and closes it", () => {
    const { h } = show();
    fireEvent.click(within(openFlyout('Shapes')).getByRole('button', { name: 'Add Square' }));
    expect(h.onAddShape).toHaveBeenCalledWith('square', expect.anything());
    expect(flyout()).toBeNull();
  });

  // docs/specs/026-plan/plan-mode.md "The palette": Boards until the tab has a board, then Cards.
  it('opens a Plan tab without a board on Boards, and moves on to Cards once one lands', () => {
    const picked = () => screen.getByRole('button', { name: 'Palette category' }).textContent;
    const board = { ...createShape('plan-board', 0, 0), id: 'b1' } as Element;
    const view = show({ mode: 'plan', tabElements: [] });
    expect(picked()).toContain('Boards');
    const again = (tabElements: Element[]) =>
      view.rerender(
        inMode(
          'plan',
          <ToolbarPalette
            canvasTool="select"
            onSetCanvasTool={vi.fn()}
            canvasEmpty={false}
            pendingDraw={null}
            tabElements={tabElements}
            {...view.h}
          />,
        ),
      );
    again([board]);
    expect(picked()).toContain('Cards');
    // The last board going takes it back to Boards.
    again([]);
    expect(picked()).toContain('Boards');
    // A category the person picked stays when a board lands.
    pickCategory('plan-metrics');
    again([board]);
    expect(picked()).toContain('Metrics');
  });

  it('opens a Plan tab with a board on Cards', () => {
    show({ mode: 'plan', tabElements: [{ ...createShape('plan-board', 0, 0), id: 'b1' }] });
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain('Cards');
  });

  // docs/specs/026-plan/plan-board.md "The palette follows what fills the screen": only Cards while a board fills its
  // tab, and the category chosen before comes back when it stops.
  it('offers only Cards while a board fills its tab, then restores the choice', () => {
    const picked = () => screen.getByRole('button', { name: 'Palette category' }).textContent;
    const view = show({ mode: 'plan' });
    pickCategory('plan-boards');
    expect(picked()).toContain('Boards');
    covering.value = true;
    view.rerender(
      inMode(
        'plan',
        <ToolbarPalette
          canvasTool="select"
          onSetCanvasTool={vi.fn()}
          canvasEmpty={false}
          pendingDraw={null}
          {...view.h}
        />,
      ),
    );
    expect(picked()).toContain('Cards');
    covering.value = false;
    view.rerender(
      inMode(
        'plan',
        <ToolbarPalette
          canvasTool="select"
          onSetCanvasTool={vi.fn()}
          canvasEmpty={false}
          pendingDraw={null}
          {...view.h}
        />,
      ),
    );
    expect(picked()).toContain('Boards');
  });

  // docs/specs/026-plan/plan-board.md "The palette follows what fills the screen": a Sheet filling its tab hides the
  // palette; on a phone the menu beside it stays.
  it('hides the palette while a Sheet fills its tab', () => {
    sheetFilling.value = true;
    show({ mode: 'plan' });
    const root = document.querySelector('[data-toolbar-palette]')!;
    expect(root.classList.contains('hidden')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Palette category' })).toBeNull();
  });

  it('keeps a phone’s menu while a Sheet fills its tab', () => {
    sheetFilling.value = true;
    mobile.value = true;
    render(
      inMode(
        'plan',
        <ToolbarPalette
          canvasTool="select"
          onSetCanvasTool={vi.fn()}
          canvasEmpty={false}
          pendingDraw={null}
          leading={<button type="button">Menu</button>}
          {...handlers()}
        />,
      ),
    );
    const root = document.querySelector('[data-toolbar-palette]')!;
    expect(root.classList.contains('hidden')).toBe(false);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Palette category' })).toBeNull();
  });

  it('swaps the tiles when the category changes', () => {
    show({ mode: 'plan' });
    pickCategory('plan-metrics');
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Metrics',
    );
    expect(
      within(strip()).getByRole('button', { name: planTiles('plan-metrics')[0]!.label }),
    ).toBeTruthy();
  });

  it('only offers More when the category has more than the strip shows', () => {
    show({ mode: 'plan' });
    pickCategory('plan-boards');
    expect(screen.queryByRole('button', { name: /^More/ })).toBeNull();
    cleanup();
    // A narrow window fits two tiles; the rest is behind More.
    viewport.width = 500;
    show({ mode: 'plan' });
    pickCategory('plan-boards');
    expect(screen.getByRole('button', { name: /^More/ })).toBeTruthy();
  });

  // The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
  it('offers the mock-up kit and the charts in Illustrate mode only', () => {
    show();
    expect(barNames()).not.toContain('Devices');
    expect(barNames()).not.toContain('Components');
    expect(barNames()).not.toContain('Data');
    cleanup();
    show({ mode: 'illustrate' });
    expect(barNames()).toEqual([
      'Shapes',
      'Write',
      'Build',
      'Concepts',
      'Components',
      'Devices',
      'Icons',
      'Stickers',
      'Media',
      'Data',
    ]);
  });

  // Facilitate mode (docs/specs/012-collaboration/facilitate-mode.md "The palette").
  it('offers Stickers, Data, Ask and Session in Facilitate, not in Diagram, and Icons in both', () => {
    show();
    for (const name of ['Ask', 'Session', 'Stickers', 'Data'])
      expect(barNames()).not.toContain(name);
    expect(barNames()).toContain('Icons');
    expect(barNames()).toContain('Tech');
    cleanup();
    show({ mode: 'facilitate' });
    expect(barNames()).toEqual([
      'Shapes',
      'Draw',
      'Icons',
      'Stickers',
      'Media',
      'Data',
      'Ask',
      'Session',
    ]);
    // The other Collaborate categories are Session's groups, not buttons of their own.
    expect(COLLAB_IDS.length).toBeGreaterThan(0);
    const session = openFlyout('Session');
    for (const group of ['Tools', 'Record', 'React', 'Selection Mode', 'Navigate'])
      expect(
        within(session).getByRole('button', { name: new RegExp(`^${group}`) }),
        group,
      ).toBeTruthy();
  });

  it("opens the category's full body under More, and closes it when a tile is used", () => {
    viewport.width = 500;
    show({ mode: 'plan' });
    pickCategory('plan-boards');
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(popover).not.toBeNull();
    const last = planTiles('plan-boards').at(-1)!;
    fireEvent.click(within(popover).getAllByRole('button', { name: last.label }).at(-1)!);
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  it("focuses a catalogue's search field when its flyout opens (docs/specs/007-editor/toolbar-layout.md)", () => {
    show({ mode: 'facilitate' });
    const popover = openFlyout('Icons');
    expect(document.activeElement).toBe(within(popover).getByPlaceholderText('Search icons'));
  });

  it('leaves focus alone on a phone, where it would raise the keyboard', () => {
    mobile.value = true;
    show({ mode: 'facilitate' });
    const popover = openFlyout('Icons');
    expect(document.activeElement).not.toBe(within(popover).getByPlaceholderText('Search icons'));
  });

  it('switches the flyout to the category pressed next', () => {
    show({ mode: 'facilitate' });
    openFlyout('Icons');
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(within(flyout()!).getByRole('button', { name: 'Add Square' })).toBeTruthy();
    expect(within(flyout()!).queryByPlaceholderText('Search icons')).toBeNull();
  });

  it('closes the flyout on Escape', () => {
    show({ mode: 'facilitate' });
    openFlyout('Icons');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
  });

  it('closes More on Escape', () => {
    viewport.width = 500;
    show({ mode: 'plan' });
    pickCategory('plan-boards');
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
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
      within(strip()).getAllByRole('button', { name: /^Add .* Note$/ }).length,
    ).toBeGreaterThan(0);
  });

  // docs/specs/021-event-storming/event-storming.md: the floating palette's board row, in the strip.
  it('offers Add from Photo on an event-storming board, as its category does', () => {
    const onImportPhoto = vi.fn();
    show({ esBoard: true, esBoardControls: { onImportPhoto } });
    fireEvent.click(within(strip()).getByRole('button', { name: 'Add from Photo' }));
    expect(onImportPhoto).toHaveBeenCalledTimes(1);
  });

  it('keeps Add from Photo focusable but inert while it is unavailable', () => {
    const onImportPhoto = vi.fn();
    show({ esBoard: true, esBoardControls: { onImportPhoto, photoDisabled: true } });
    const button = within(strip()).getByRole('button', { name: 'Add from Photo' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onImportPhoto).not.toHaveBeenCalled();
  });

  it('offers no Add from Photo off a board, or where the deployment has no photo import', () => {
    show({ esBoardControls: { onImportPhoto: vi.fn() } });
    expect(screen.queryByRole('button', { name: 'Add from Photo' })).toBeNull();
    cleanup();
    show({ esBoard: true, esBoardControls: {} });
    expect(screen.queryByRole('button', { name: 'Add from Photo' })).toBeNull();
  });

  it('hides rather than unmounts, so the chosen category survives', () => {
    const view = show({ mode: 'plan' });
    pickCategory('plan-metrics');
    const h = handlers();
    const rerender = (hidden: boolean) =>
      view.rerender(
        inMode(
          'plan',
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
      'Metrics',
    );
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
      fireEvent.click(within(popover).getByRole('button', { name: 'Add Cylinder' }));
      expect(h.onAddShape).toHaveBeenCalledWith('cylinder', expect.anything());
      // Used, so closed: the canvas is clear to draw on.
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it("keeps other modes' elements in a closed accordion until asked", () => {
      const { h } = show();
      const popover = openSearch();
      // A pie chart's other name: the Diagram icons include a pie chart glyph, which `pie chart` finds here.
      type(popover, 'doughnut');
      expect(within(popover).queryByRole('button', { name: 'Add Pie Chart' })).toBeNull();
      expect(popover.textContent).toContain('No Diagram elements match “doughnut”');
      expect(popover.textContent).toContain('Other modes have');
      const accordion = within(popover).getByRole('button', { name: /Elements From Other Modes/ });
      expect(accordion.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(accordion);
      fireEvent.click(within(popover).getByRole('button', { name: 'Add Pie Chart' }));
      expect(h.onAddShape).toHaveBeenCalledWith('pie-chart', expect.anything());
    });

    it("shows Plan's own elements in other modes, but never adds them", () => {
      const { h } = show();
      const popover = openSearch();
      type(popover, 'gantt');
      expect(
        within(popover).queryByRole('button', { name: /Elements From Other Modes/ }),
      ).toBeNull();
      const accordion = within(popover).getByRole('button', {
        name: /Not Available in Diagram Mode/,
      });
      expect(accordion.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(accordion);
      const gantt = within(popover).getByRole('button', { name: /Gantt/ });
      expect(gantt.getAttribute('aria-disabled')).toBe('true');
      expect(gantt.getAttribute('draggable')).not.toBe('true');
      fireEvent.click(gantt);
      fireEvent.keyDown(within(popover).getByRole('textbox', { name: 'Search elements' }), {
        key: 'Enter',
      });
      expect(h.onAddShape).not.toHaveBeenCalled();
      expect(document.querySelector('[data-toolbar-search]')).not.toBeNull();
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

    it("picks up Draw mode's markers from the other modes' section", () => {
      const { h } = show();
      const popover = openSearch();
      type(popover, 'marker');
      fireEvent.click(within(popover).getByRole('button', { name: /Elements From Other Modes/ }));
      fireEvent.click(within(popover).getByRole('button', { name: 'Marker 2' }));
      expect(h.onBeginMarker).toHaveBeenCalledWith('second');
      expect(document.querySelector('[data-toolbar-search]')).toBeNull();
    });

    it('opens on S where it is shown, and leaves S to Select where it is not', () => {
      show();
      act(() => {
        expect(requestToolbarSearch()).toBe(true);
      });
      expect(document.querySelector('[data-toolbar-search]')).not.toBeNull();
      cleanup();
      show({ esBoard: true });
      expect(requestToolbarSearch()).toBe(false);
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
      expect(
        within(popover).queryByRole('button', { name: /Elements From Other Modes|Not Available/ }),
      ).toBeNull();
    });

    it("is one strip menu at a time with a category's flyout, and closes on Escape", () => {
      show({ mode: 'facilitate' });
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
      fireEvent.click(within(popover).getByRole('button', { name: /Elements From Other Modes/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Search elements' }));
      popover = openSearch();
      expect(
        (within(popover).getByRole('textbox', { name: 'Search elements' }) as HTMLInputElement)
          .value,
      ).toBe('');
    });
  });
});
