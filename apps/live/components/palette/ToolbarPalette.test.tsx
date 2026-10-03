// @vitest-environment jsdom
// The Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the same handlers the floating Palette's do.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';
import type { EsBoardControls } from './EventStormingBoardRows';
import { savePaletteFavourites } from '@/lib/palette-favourites';
import type { EditorMode } from '@livediagram/document';
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
  it('opens on Favourites with the selection mode and category pickers', () => {
    show();
    expect(screen.getByRole('button', { name: 'Selection mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Favourites',
    );
    // The shipped favourites lead with the square.
    expect(within(strip()).getByRole('button', { name: 'Add square' })).toBeTruthy();
  });

  it('reaches the same add-handler as the Palette from a strip tile', () => {
    const { h } = show();
    fireEvent.click(within(strip()).getByRole('button', { name: 'Add square' }));
    expect(h.onAddShape).toHaveBeenCalledWith('square', expect.anything());
  });

  it('swaps the tiles when the category changes', () => {
    show({ mode: 'infographic' });
    pickCategory('devices');
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Devices',
    );
    expect(within(strip()).getByRole('button', { name: 'Add web browser' })).toBeTruthy();
    expect(within(strip()).queryByRole('button', { name: 'Add square' })).toBeNull();
  });

  it('only offers More when the category has more than the strip shows', () => {
    show();
    // Favourites always has More: its search and Edit live there.
    expect(screen.getByRole('button', { name: 'More Favourites' })).toBeTruthy();
    cleanup();
    // Devices fits in the strip whole.
    show({ mode: 'infographic' });
    pickCategory('devices');
    expect(screen.queryByRole('button', { name: /^More/ })).toBeNull();
  });

  // The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
  it('offers the mock-up kit and the charts in Infographic mode only', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Palette category' }));
    expect(document.querySelector('[data-option-id="devices"]')).toBeNull();
    expect(document.querySelector('[data-option-id="components"]')).toBeNull();
    expect(document.querySelector('[data-option-id="data"]')).toBeNull();
    cleanup();
    show({ mode: 'infographic' });
    fireEvent.click(screen.getByRole('button', { name: 'Palette category' }));
    expect(document.querySelector('[data-option-id="devices"]')).not.toBeNull();
    expect(document.querySelector('[data-option-id="data"]')).not.toBeNull();
    expect(document.querySelector('[data-option-id="behaviour"]')).toBeNull();
    expect(document.querySelector('[data-option-id="technology"]')).toBeNull();
    expect(document.querySelector('[data-option-id="stickers"]')).not.toBeNull();
  });

  it("opens the category's full body under More, and closes it when a tile is used", () => {
    const { h } = show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(popover).not.toBeNull();
    // The Favourites body itself: its cross-category search.
    expect(within(popover).getByPlaceholderText('Search all elements')).toBeTruthy();
    fireEvent.click(within(popover).getByRole('button', { name: 'Add circle' }));
    expect(h.onAddShape).toHaveBeenCalledWith('circle', expect.anything());
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  it('focuses the search field when More opens (docs/specs/007-editor/toolbar-layout.md)', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(document.activeElement).toBe(
      within(popover).getByPlaceholderText('Search all elements'),
    );
  });

  it('leaves focus alone on a phone, where it would raise the keyboard', () => {
    mobile.value = true;
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    const popover = document.querySelector('[data-toolbar-more]') as HTMLElement;
    expect(document.activeElement).not.toBe(
      within(popover).getByPlaceholderText('Search all elements'),
    );
  });

  it('closes More when the category changes, since it showed the old one', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    expect(document.querySelector('[data-toolbar-more]')).not.toBeNull();
    pickCategory('shapes');
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
  });

  // The Favourites body writes its edits straight to storage; the strip catches up on close
  // (docs/specs/010-palette/palette-favourites.md).
  it('shows favourites edited under More once it closes', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    act(() => savePaletteFavourites(['shapes:diamond']));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(within(strip()).getByRole('button', { name: 'Add diamond' })).toBeTruthy();
    expect(within(strip()).queryByRole('button', { name: 'Add square' })).toBeNull();
  });

  it('closes More on Escape', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
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
    const view = show({ mode: 'infographic' });
    pickCategory('devices');
    const h = handlers();
    const rerender = (hidden: boolean) =>
      view.rerender(
        inMode(
          'infographic',
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
});
