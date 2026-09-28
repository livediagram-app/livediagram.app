// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTable } from '@livediagram/diagram';
import { useTableCellSelection } from './useTableCellSelection';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The cell selection (docs/specs/008-canvas/canvas-and-palette.md multi-cell selection + the cell menu)
// follows the grid it selects in: it clamps when rows or columns go, closes its menu when editing
// starts or the anchor goes, and clears when the table is deselected.

type Props = {
  rows: number;
  cols: number;
  editing: { r: number; c: number } | null;
  isSelected: boolean;
};
const element = createTable(0, 0);

function setup(initial: Partial<Props> = {}) {
  return renderHook(
    (p: Props) =>
      useTableCellSelection({
        element,
        rows: p.rows,
        cols: p.cols,
        gridRef: { current: null },
        editing: p.editing,
        isSelected: p.isSelected,
        disabled: false,
        onCommitTable: vi.fn(),
      }),
    { initialProps: { rows: 3, cols: 3, editing: null, isSelected: true, ...initial } },
  );
}

// Anchor at (2, 2) with an extra cell at (0, 1) and the menu open.
function selectCorner(result: ReturnType<typeof setup>['result']) {
  act(() => {
    result.current.setSelectedCell({ r: 2, c: 2 });
    result.current.setExtraCells(new Set(['0:1']));
    result.current.setCellMenuPos({ x: 10, y: 20 });
  });
}

describe('useTableCellSelection', () => {
  it('drops an anchor the grid no longer has, and the menu with it', () => {
    const { result, rerender } = setup();
    selectCorner(result);
    rerender({ rows: 2, cols: 3, editing: null, isSelected: true });
    expect(result.current.selectedCell).toBeNull();
    expect(result.current.cellMenuPos).toBeNull();
    // The extra is still inside the smaller grid, so it stays.
    expect([...result.current.extraCells]).toEqual(['0:1']);
  });

  it('drops only the extras past the edge', () => {
    const { result, rerender } = setup();
    act(() => {
      result.current.setSelectedCell({ r: 0, c: 0 });
      result.current.setExtraCells(new Set(['0:1', '0:2']));
    });
    rerender({ rows: 3, cols: 2, editing: null, isSelected: true });
    expect(result.current.selectedCell).toEqual({ r: 0, c: 0 });
    expect([...result.current.extraCells]).toEqual(['0:1']);
  });

  it('closes the menu and collapses the extras when editing starts', () => {
    const { result, rerender } = setup();
    selectCorner(result);
    rerender({ rows: 3, cols: 3, editing: { r: 2, c: 2 }, isSelected: true });
    expect(result.current.cellMenuPos).toBeNull();
    expect(result.current.extraCells.size).toBe(0);
    expect(result.current.selectedCell).toEqual({ r: 2, c: 2 });
  });

  it('closes the menu when the anchor goes', () => {
    const { result } = setup();
    selectCorner(result);
    act(() => result.current.setSelectedCell(null));
    expect(result.current.cellMenuPos).toBeNull();
  });

  it('keeps the menu over an unchanged selection', () => {
    const { result, rerender } = setup();
    selectCorner(result);
    rerender({ rows: 3, cols: 3, editing: null, isSelected: true });
    expect(result.current.cellMenuPos).toEqual({ x: 10, y: 20 });
  });

  it('keeps a menu opened while an edit is already under way', () => {
    // Only a CHANGE of editing or anchor closes it.
    const { result } = setup({ editing: { r: 0, c: 0 } });
    act(() => result.current.setSelectedCell({ r: 1, c: 1 }));
    act(() => result.current.setCellMenuPos({ x: 1, y: 2 }));
    expect(result.current.cellMenuPos).toEqual({ x: 1, y: 2 });
  });

  it('clears everything when the table is deselected', () => {
    const { result, rerender } = setup();
    selectCorner(result);
    rerender({ rows: 3, cols: 3, editing: null, isSelected: false });
    expect(result.current.selectedCell).toBeNull();
    expect(result.current.extraCells.size).toBe(0);
    expect(result.current.cellMenuPos).toBeNull();
  });
});
