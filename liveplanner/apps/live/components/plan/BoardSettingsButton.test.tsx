// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/document';
import { presetSetup } from '@liveplanner/items';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';
import { useElementMenuOpener } from '@/hooks/canvas/element-menu-opener';
import { BoardSettingsButton } from './BoardSettingsButton';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "The board set-up": a board's settings cog opens its element menu.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const element = {
  ...createShape('plan-board', 0, 0),
  id: 'b1',
  planBoard: presetSetup('kanban'),
} as ShapeElement;

describe('a board’s settings cog', () => {
  it('selects the board and opens its element menu under itself, closing it on a second press', () => {
    let menu: EditorContextMenuState | null = null;
    const setMenu = vi.fn((next: unknown) => {
      menu =
        typeof next === 'function'
          ? (next as (c: typeof menu) => typeof menu)(menu)
          : (next as typeof menu);
    });
    const select = vi.fn(() => true);
    renderHook(() => useElementMenuOpener(setMenu as never, true, select));
    render(<BoardSettingsButton element={element} palette={planPalette('light')} />);
    const cog = screen.getByRole('button', { name: 'Board Settings' });
    act(() => {
      fireEvent.click(cog);
    });
    expect(select).toHaveBeenCalledWith('b1');
    expect(menu).toMatchObject({ mode: 'element', elementId: 'b1' });
    act(() => {
      fireEvent.click(cog);
    });
    expect(menu).toBeNull();
  });

  it('opens nothing on a board a collaborator holds', () => {
    const setMenu = vi.fn();
    renderHook(() => useElementMenuOpener(setMenu, true, () => false));
    render(<BoardSettingsButton element={element} palette={planPalette('light')} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Board Settings' }));
    });
    expect(setMenu).not.toHaveBeenCalled();
  });
});
