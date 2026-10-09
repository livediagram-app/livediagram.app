'use client';

// When rows or columns move under this person (someone else inserts, deletes, moves or sorts them), their edit and
// selection follow their cells (docs/specs/029-sheets/sheet.md "Collaboration"): positions are read through the
// old layout's ids and found again in the new one. An edit whose cell was deleted is thrown away, and said.
import { useEffect, useRef } from 'react';
import type { GridRange, Selection, SheetLayout } from '@livediagram/sheets';
import type { Editing } from './sheet-controller';

export const EDIT_LOST = 'Someone deleted the row you were editing';
export const EDIT_LOST_COLUMN = 'Someone deleted the column you were editing';

// A position in `from`, found in `to` by its id (null when the line is gone).
function follow(from: readonly string[], to: readonly string[], at: number): number | null {
  const id = from[at];
  if (id === undefined) return null;
  const i = to.indexOf(id);
  return i < 0 ? null : i;
}

// The selection's positions moved with their lines; a line gone keeps its position, within the grid.
export function followSelection(sel: Selection, from: SheetLayout, to: SheetLayout): Selection {
  const rows = to.rows.length;
  const cols = to.cols.length;
  const r = (at: number) => follow(from.rows, to.rows, at) ?? Math.min(at, rows - 1);
  const c = (at: number) => follow(from.cols, to.cols, at) ?? Math.min(at, cols - 1);
  const range = (g: GridRange): GridRange => {
    const r1 = r(g.r1);
    const r2 = r(g.r2);
    const c1 = c(g.c1);
    const c2 = c(g.c2);
    return {
      r1: Math.min(r1, r2),
      r2: Math.max(r1, r2),
      c1: Math.min(c1, c2),
      c2: Math.max(c1, c2),
    };
  };
  return {
    ranges: sel.ranges.map(range),
    active: { r: r(sel.active.r), c: c(sel.active.c) },
    anchor: { r: r(sel.anchor.r), c: c(sel.anchor.c) },
  };
}

export function useFollowLayout({
  layout,
  editing,
  setEditing,
  selectionNow,
  setSelection,
  toast,
  takeOwnLayout,
}: {
  layout: SheetLayout;
  editing: Editing | null;
  setEditing: (e: Editing | null) => void;
  selectionNow: () => Selection;
  setSelection: (s: Selection) => void;
  toast: (message: string) => void;
  // Whether the change seen was this person's own (read once).
  takeOwnLayout: () => boolean;
}): void {
  const seen = useRef(layout);
  useEffect(() => {
    const from = seen.current;
    seen.current = layout;
    if (from === layout || (from.rows === layout.rows && from.cols === layout.cols)) return;
    if (takeOwnLayout()) return;
    setSelection(followSelection(selectionNow(), from, layout));
    if (!editing) return;
    const r = follow(from.rows, layout.rows, editing.r);
    const c = follow(from.cols, layout.cols, editing.c);
    if (r === null || c === null) {
      setEditing(null);
      toast(r === null ? EDIT_LOST : EDIT_LOST_COLUMN);
    } else if (r !== editing.r || c !== editing.c) setEditing({ ...editing, r, c });
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps
}
