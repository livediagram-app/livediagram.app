'use client';

// The column under the pointer (docs/specs/026-plan/plan-board.md "Column hover"): its head and cells (each a
// `plan-col` part) carry `data-column-hover`, which globals.css draws as a slight shift of the column's colour.
// Written straight to the DOM from native pointerover / pointerleave on the board's grid, so moving the pointer never
// renders the board: pointerover fires only when the pointer crosses into another element, and each crossing touches
// at most the old column's and the new column's few parts.
import { useEffect, type RefObject } from 'react';
import { COLUMN_ATTR } from './column-move-flip';

export const COLUMN_HOVER_ATTR = 'data-column-hover';
// The class a column's painted parts wear (its head, its cells, a collapsed column's strip).
export const COLUMN_PART_CLASS = 'plan-col';

function partsOf(grid: HTMLElement, id: string): HTMLElement[] {
  return [
    ...grid.querySelectorAll<HTMLElement>(
      `[${COLUMN_ATTR}="${CSS.escape(id)}"].${COLUMN_PART_CLASS}`,
    ),
  ];
}

// `columns`: the board's column count, so the listeners attach once the grid is drawn (it is not, with none).
export function useColumnHover(
  gridRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  columns: number,
): void {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !enabled) return;
    let current: string | null = null;
    const set = (id: string | null) => {
      if (id === current) return;
      if (current) for (const el of partsOf(grid, current)) el.removeAttribute(COLUMN_HOVER_ATTR);
      current = id;
      if (id) for (const el of partsOf(grid, id)) el.setAttribute(COLUMN_HOVER_ATTR, '');
    };
    const over = (e: PointerEvent) => {
      // A touch has no hover: a finger never marks a column.
      if (e.pointerType === 'touch') return;
      const col = (e.target as Element).closest?.(`[${COLUMN_ATTR}]`);
      set(col && grid.contains(col) ? col.getAttribute(COLUMN_ATTR) : null);
    };
    const leave = () => set(null);
    grid.addEventListener('pointerover', over);
    grid.addEventListener('pointerleave', leave);
    return () => {
      grid.removeEventListener('pointerover', over);
      grid.removeEventListener('pointerleave', leave);
      set(null);
    };
  }, [gridRef, enabled, columns]);
}
