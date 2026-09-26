// @vitest-environment jsdom
// The Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): what it shows, and that its controls
// reach the same handlers the floating Palette's do.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PALETTE_ADD_HANDLER_KEYS, type PaletteAddHandlers } from './palette-add-handlers';
import { ToolbarPalette } from './ToolbarPalette';

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
});

function handlers(): PaletteAddHandlers {
  return Object.fromEntries(
    PALETTE_ADD_HANDLER_KEYS.map((k) => [k, vi.fn()]),
  ) as unknown as PaletteAddHandlers;
}

function show(props: { esBoard?: boolean; hidden?: boolean } = {}) {
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
    show();
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
    // Devices fits in the strip whole.
    pickCategory('devices');
    expect(screen.queryByRole('button', { name: /^More/ })).toBeNull();
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

  it('closes More when the category changes, since it showed the old one', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More Favourites' }));
    expect(document.querySelector('[data-toolbar-more]')).not.toBeNull();
    pickCategory('shapes');
    expect(document.querySelector('[data-toolbar-more]')).toBeNull();
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

  it('hides rather than unmounts, so the chosen category survives', () => {
    const view = show();
    pickCategory('devices');
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
    expect(screen.getByRole('button', { name: 'Palette category' }).textContent).toContain(
      'Devices',
    );
  });
});
