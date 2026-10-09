// A sheet's layout as positions (docs/specs/029-sheets/sheet-store.md "Rows and columns by id"): id -> index
// maps built once per layout object, sizes with their defaults, and the layout changes every write applies.
import type { IdRange, SheetLayout } from './sheet';
import { COLUMN_WIDTH_NEW, ROW_HEIGHT_NEW } from './limits';

export type LayoutIndex = {
  rowPos: ReadonlyMap<string, number>;
  colPos: ReadonlyMap<string, number>;
  hiddenRows: ReadonlySet<string>;
  hiddenCols: ReadonlySet<string>;
};

const INDEXES = new WeakMap<SheetLayout, LayoutIndex>();

// O(1) lookups for a layout, built on first use and kept for as long as the layout object lives (layouts are
// never mutated: every change makes a new one).
export function layoutIndex(layout: SheetLayout): LayoutIndex {
  let index = INDEXES.get(layout);
  if (!index) {
    const rowPos = new Map<string, number>();
    layout.rows.forEach((id, i) => rowPos.set(id, i));
    const colPos = new Map<string, number>();
    layout.cols.forEach((id, i) => colPos.set(id, i));
    index = {
      rowPos,
      colPos,
      hiddenRows: new Set(layout.hiddenRows ?? []),
      hiddenCols: new Set(layout.hiddenCols ?? []),
    };
    INDEXES.set(layout, index);
  }
  return index;
}

export function rowHeight(layout: SheetLayout, rowId: string): number {
  return layout.rowSize?.[rowId] ?? layout.rowHeight ?? ROW_HEIGHT_NEW;
}

export function colWidth(layout: SheetLayout, colId: string): number {
  return layout.colSize?.[colId] ?? layout.colWidth ?? COLUMN_WIDTH_NEW;
}

// The ids of a positional rectangle (clamped to the grid), or null when it lies outside it.
export function idRangeOf(
  layout: SheetLayout,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): IdRange | null {
  const rows = layout.rows;
  const cols = layout.cols;
  const a = rows[Math.max(0, Math.min(r1, r2))];
  const b = rows[Math.min(rows.length - 1, Math.max(r1, r2))];
  const c = cols[Math.max(0, Math.min(c1, c2))];
  const d = cols[Math.min(cols.length - 1, Math.max(c1, c2))];
  if (!a || !b || !c || !d) return null;
  return { r1: a, c1: c, r2: b, c2: d };
}

// The positions of an id rectangle, or null when a corner is gone.
export function posRangeOf(
  layout: SheetLayout,
  range: IdRange,
): { r1: number; c1: number; r2: number; c2: number } | null {
  const ix = layoutIndex(layout);
  const r1 = ix.rowPos.get(range.r1);
  const r2 = ix.rowPos.get(range.r2);
  const c1 = ix.colPos.get(range.c1);
  const c2 = ix.colPos.get(range.c2);
  if (r1 === undefined || r2 === undefined || c1 === undefined || c2 === undefined) return null;
  return {
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.max(r1, r2),
    c2: Math.max(c1, c2),
  };
}

// Insert ids after `after` (null: at the start). An `after` no longer in the list inserts at the end.
export function insertIds(list: readonly string[], after: string | null, ids: readonly string[]) {
  if (after === null) return [...ids, ...list];
  const at = list.indexOf(after);
  if (at < 0) return [...list, ...ids];
  return [...list.slice(0, at + 1), ...ids, ...list.slice(at + 1)];
}

// Move ids (kept in their current relative order) to after `after` (null: the start). Ids not in the list are
// ignored; an `after` among the moved ids, or gone, leaves the list as it was.
export function moveIds(list: readonly string[], ids: readonly string[], after: string | null) {
  const moving = new Set(ids.filter((id) => list.includes(id)));
  if (moving.size === 0) return [...list];
  if (after !== null && (moving.has(after) || !list.includes(after))) return [...list];
  const kept = list.filter((id) => !moving.has(id));
  const moved = list.filter((id) => moving.has(id));
  return insertIds(kept, after, moved);
}

// Prefix sums of sizes (visible axes only; hidden are 0), for the grid's window maths.
export function axisOffsets(
  ids: readonly string[],
  sizeOf: (id: string) => number,
  hidden: ReadonlySet<string>,
): Float64Array {
  const out = new Float64Array(ids.length + 1);
  for (let i = 0; i < ids.length; i++)
    out[i + 1] = out[i]! + (hidden.has(ids[i]!) ? 0 : sizeOf(ids[i]!));
  return out;
}

// The index whose span holds `offset` in prefix sums (binary search); clamped to the last index.
export function indexAtOffset(offsets: Float64Array, offset: number): number {
  const n = offsets.length - 1;
  if (n <= 0) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
