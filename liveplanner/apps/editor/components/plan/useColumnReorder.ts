'use client';

// A board's columns reordered (docs/specs/026-plan/plan-board.md "Drag a column"), every way it happens: a column head
// dragged (useColumnDrag), Alt+Shift+Left/Right on a focused head, and Move Left or Right in a column's settings. Each
// is one set-up change (one undo step, sent live like any board edit), glides (column-move-flip.ts), is announced
// ("Moved In Progress to position 3 of 5") and tracked as `ColumnReordered`. Only an Editor's, on a board that is set
// up here (never a Dashboard slot's), on a desktop: `enabled` says so, and without it no head is a handle.
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { PlanBoardSetup } from '@liveplanner/items';
import { moveColumn, moveColumnTo } from './board-setup-edits';
import {
  COLUMN_HEAD_ATTR,
  columnEdgeMessage,
  columnMovedMessage,
  type ColumnReorder,
} from './column-drag';
import type { ColumnPositions } from './column-move-flip';
import { trackSetup } from './track-board-setup';
import { useColumnDrag } from './useColumnDrag';

export const COLUMN_REORDERED = 'ColumnReordered';

type Glide = {
  beforeMove: (columnId: string) => void;
  beforeMoveFrom: (columnId: string, at: ColumnPositions) => void;
};

export function useColumnReorder({
  setup,
  write,
  announce,
  enabled,
  grid,
  scroller,
  board,
  glide,
}: {
  setup: PlanBoardSetup | null;
  // The board's set-up written (plan.updateBoard for this board).
  write: (next: PlanBoardSetup) => void;
  announce: (message: string) => void;
  enabled: boolean;
  grid: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  board: RefObject<HTMLElement | null>;
  glide: Glide;
}) {
  const columnIds = useMemo(() => setup?.columns.map((c) => c.id) ?? [], [setup]);
  // The head whose column just moved by the keyboard: focus goes back to it once the move has laid out.
  const focusHeadRef = useRef<string | null>(null);

  // A reorder written: the glide noted first (or `at`, where a drag let it go), then the change, then said.
  const reordered = useCallback(
    (next: PlanBoardSetup, columnId: string, at?: ColumnPositions) => {
      if (!setup || next === setup) return;
      if (at) glide.beforeMoveFrom(columnId, at);
      else glide.beforeMove(columnId);
      write(next);
      trackSetup(COLUMN_REORDERED);
      const index = next.columns.findIndex((c) => c.id === columnId);
      const column = next.columns[index];
      if (column) announce(columnMovedMessage(column.name, index, next.columns.length));
    },
    [setup, glide, write, announce],
  );

  const drag = useColumnDrag({
    grid,
    scroller,
    board,
    enabled,
    columnIds,
    onDrop: (columnId, to, at) => {
      if (setup) reordered(moveColumnTo(setup, columnId, to), columnId, at);
    },
  });

  useEffect(() => {
    const id = focusHeadRef.current;
    if (!id) return;
    focusHeadRef.current = null;
    grid.current
      ?.querySelector<HTMLElement>(`[${COLUMN_HEAD_ATTR}="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
  });

  const reorderFor = (columnId: string, position: number): ColumnReorder | undefined => {
    if (!enabled || !setup) return undefined;
    return {
      position,
      total: setup.columns.length,
      onPointerDown: (e) => drag.onHeadPointerDown(columnId, e),
      onMoveKey: (step) => {
        const next = moveColumn(setup, columnId, step);
        const name = setup.columns[position]?.name ?? '';
        if (next === setup) return announce(columnEdgeMessage(name, step));
        focusHeadRef.current = columnId;
        reordered(next, columnId);
      },
    };
  };

  return { reorderFor, reordered };
}
