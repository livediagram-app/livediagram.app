// What a reorder may not do to a merge (docs/specs/029-sheets/sheet.md "Sort", "Rows and columns"). A merge is held by
// its corner rows and columns, so a sort or a move that pulls those apart stretches it over whatever lands between,
// over other merges too. Like Google Sheets and Excel, such a sort or move is refused, with a line saying why.
import { posRangeOf } from './layout';
import type { SheetLayout } from './sheet';

/** A sort or move a merge refused: the line to show (a toast in the editor, a refusal for an agent). */
export type MergeRefusal = { refused: string };

export const MERGE_SORT_REFUSAL = 'Unmerge the cells that span rows before sorting.';
export const mergeMoveRefusal = (axis: 'r' | 'c') =>
  `Unmerge the cells first: moving these ${axis === 'r' ? 'rows' : 'columns'} would split merged cells.`;

type Box = { r1: number; c1: number; r2: number; c2: number };

function boxes(layout: SheetLayout): Box[] {
  const out: Box[] = [];
  for (const m of layout.merges ?? []) {
    const b = posRangeOf(layout, m);
    if (b) out.push(b);
  }
  return out;
}

/** Whether sorting rows r1..r2 (within columns c1..c2, the whole width when absent) would move part of a merge that
 *  spans more than one row: such a sort is refused. A merge within one row (Merge Across) sorts with its row. */
export function sortSplitsMerge(
  layout: SheetLayout,
  r1: number,
  r2: number,
  c1 = 0,
  c2 = layout.cols.length - 1,
): boolean {
  return boxes(layout).some(
    (b) => b.r2 > b.r1 && b.r1 <= r2 && r1 <= b.r2 && b.c1 <= c2 && c1 <= b.c2,
  );
}

/** Whether moving lines from..to to before position `before` would split a merge spanning lines on that axis: the
 *  moved block holds only part of one, or it lands inside one. Moving a whole merge, or past them, is fine. */
export function moveSplitsMerge(
  layout: SheetLayout,
  axis: 'r' | 'c',
  from: number,
  to: number,
  before: number,
): boolean {
  return boxes(layout).some((b) => {
    const lo = axis === 'r' ? b.r1 : b.c1;
    const hi = axis === 'r' ? b.r2 : b.c2;
    if (hi === lo) return false;
    const touches = lo <= to && from <= hi;
    const whole = from <= lo && hi <= to;
    return (touches && !whole) || (lo < before && before <= hi);
  });
}
