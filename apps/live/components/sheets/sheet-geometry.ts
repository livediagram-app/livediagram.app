// Where rows and columns sit on screen (blueprint sheet-element.md "Layout"): prefix sums of sizes (hidden and
// filtered-out lines are zero), the frozen panes' sizes, the visible window for a scroll position, and the cell
// under a point. Pure, so the grid's maths is tested without a DOM.
import {
  axisOffsets,
  colWidth,
  indexAtOffset,
  layoutIndex,
  posRangeOf,
  rowHeight,
  type GridRange,
  type SheetLayout,
} from '@livediagram/sheets';

export const ROW_HEADER_PX = 46;
export const COL_HEADER_PX = 22;
export const GRID_OVERSCAN = 4;

export type Geometry = {
  rows: Float64Array; // rows[i] is row i's top; rows[n] the total height
  cols: Float64Array;
  frozenRows: number;
  frozenCols: number;
  frozenHeight: number; // px of the frozen rows
  frozenWidth: number;
  // A merge by its top-left "r,c", and every covered position to its top-left.
  merges: Map<string, GridRange>;
  covered: Map<string, string>;
  hiddenRow(r: number): boolean;
  hiddenCol(c: number): boolean;
  // The row numbers' width and the column letters' height: ROW_HEADER_PX and COL_HEADER_PX, or 0 when the sheet
  // hides its headers (Sheet Settings).
  headW: number;
  headH: number;
};

export function geometryOf(
  layout: SheetLayout,
  filteredOut: ReadonlySet<string> = new Set(),
): Geometry {
  const ix = layoutIndex(layout);
  const hiddenRows = new Set([...ix.hiddenRows, ...filteredOut]);
  const rows = axisOffsets(layout.rows, (id) => rowHeight(layout, id), hiddenRows);
  const cols = axisOffsets(layout.cols, (id) => colWidth(layout, id), ix.hiddenCols);
  const frozenRows = Math.min(layout.frozenRows ?? 0, layout.rows.length);
  const frozenCols = Math.min(layout.frozenCols ?? 0, layout.cols.length);
  const merges = new Map<string, GridRange>();
  const covered = new Map<string, string>();
  for (const m of layout.merges ?? []) {
    const p = posRangeOf(layout, m);
    if (!p) continue;
    const key = `${p.r1},${p.c1}`;
    merges.set(key, p);
    for (let r = p.r1; r <= p.r2; r++)
      for (let c = p.c1; c <= p.c2; c++) covered.set(`${r},${c}`, key);
  }
  return {
    rows,
    cols,
    frozenRows,
    frozenCols,
    frozenHeight: rows[frozenRows]!,
    frozenWidth: cols[frozenCols]!,
    merges,
    covered,
    headW: layout.showHeaders === false ? 0 : ROW_HEADER_PX,
    headH: layout.showHeaders === false ? 0 : COL_HEADER_PX,
    hiddenRow: (r) => hiddenRows.has(layout.rows[r]!),
    hiddenCol: (c) => ix.hiddenCols.has(layout.cols[c]!),
  };
}

export function totalSize(g: Geometry): { width: number; height: number } {
  return { width: g.cols[g.cols.length - 1]!, height: g.rows[g.rows.length - 1]! };
}

// The merge covering (r, c), as positions, or null.
export function mergeAt(g: Geometry, r: number, c: number): GridRange | null {
  const key = g.covered.get(`${r},${c}`);
  return key ? g.merges.get(key)! : null;
}

export type GridWindow = { r1: number; r2: number; c1: number; c2: number };

// The scrolling rows and columns in view (frozen ones are always drawn), plus overscan.
export function visibleWindow(
  g: Geometry,
  scroll: { top: number; left: number },
  view: { width: number; height: number },
): GridWindow {
  const n = g.rows.length - 1;
  const m = g.cols.length - 1;
  const top = g.frozenHeight + scroll.top;
  const left = g.frozenWidth + scroll.left;
  const r1 = Math.max(g.frozenRows, indexAtOffset(g.rows, top) - GRID_OVERSCAN);
  const r2 = Math.min(
    n - 1,
    indexAtOffset(g.rows, top + Math.max(0, view.height - g.frozenHeight)) + GRID_OVERSCAN,
  );
  const c1 = Math.max(g.frozenCols, indexAtOffset(g.cols, left) - GRID_OVERSCAN);
  const c2 = Math.min(
    m - 1,
    indexAtOffset(g.cols, left + Math.max(0, view.width - g.frozenWidth)) + GRID_OVERSCAN,
  );
  return { r1, r2: Math.max(r1 - 1, r2), c1, c2: Math.max(c1 - 1, c2) };
}

// A cell's box in the grid area's own coordinates (0,0 its top-left, under the headers), given the scroll.
export function cellBox(
  g: Geometry,
  r: number,
  c: number,
  scroll: { top: number; left: number },
  span: GridRange | null = null,
): { x: number; y: number; w: number; h: number } {
  const r2 = span ? span.r2 : r;
  const c2 = span ? span.c2 : c;
  const y0 = g.rows[r]!;
  const x0 = g.cols[c]!;
  const y = r < g.frozenRows ? y0 : y0 - scroll.top;
  const x = c < g.frozenCols ? x0 : x0 - scroll.left;
  return { x, y, w: g.cols[c2 + 1]! - x0, h: g.rows[r2 + 1]! - y0 };
}

export type Hit =
  | { kind: 'cell'; r: number; c: number }
  | { kind: 'col'; c: number; edge: boolean }
  | { kind: 'row'; r: number; edge: boolean }
  | { kind: 'corner' }
  | { kind: 'none' };

export const RESIZE_HIT_PX = 4;

function axisAt(
  offsets: Float64Array,
  frozen: number,
  frozenSize: number,
  p: number,
  scroll: number,
): number {
  const at = p < frozenSize ? p : p + scroll;
  const i = indexAtOffset(offsets, at);
  return i < frozen || p >= frozenSize ? i : frozen;
}

// What is under a point in the Sheet's grid frame (x, y from the frame's top-left, headers included).
export function hitTest(
  g: Geometry,
  x: number,
  y: number,
  scroll: { top: number; left: number },
): Hit {
  const inColHead = y < g.headH;
  const inRowHead = x < g.headW;
  if (inColHead && inRowHead) return { kind: 'corner' };
  const gx = x - g.headW;
  const gy = y - g.headH;
  const total = totalSize(g);
  if (inColHead) {
    if (gx + (gx < g.frozenWidth ? 0 : scroll.left) > total.width) return { kind: 'none' };
    const c = axisAt(g.cols, g.frozenCols, g.frozenWidth, gx, scroll.left);
    const right = (c < g.frozenCols ? g.cols[c + 1]! : g.cols[c + 1]! - scroll.left) - gx;
    const left = gx - (c < g.frozenCols ? g.cols[c]! : g.cols[c]! - scroll.left);
    if (left <= RESIZE_HIT_PX && c > 0) return { kind: 'col', c: c - 1, edge: true };
    return { kind: 'col', c, edge: right <= RESIZE_HIT_PX };
  }
  if (inRowHead) {
    if (gy + (gy < g.frozenHeight ? 0 : scroll.top) > total.height) return { kind: 'none' };
    const r = axisAt(g.rows, g.frozenRows, g.frozenHeight, gy, scroll.top);
    const bottom = (r < g.frozenRows ? g.rows[r + 1]! : g.rows[r + 1]! - scroll.top) - gy;
    const top = gy - (r < g.frozenRows ? g.rows[r]! : g.rows[r]! - scroll.top);
    if (top <= RESIZE_HIT_PX && r > 0) return { kind: 'row', r: r - 1, edge: true };
    return { kind: 'row', r, edge: bottom <= RESIZE_HIT_PX };
  }
  const ax = gx < g.frozenWidth ? gx : gx + scroll.left;
  const ay = gy < g.frozenHeight ? gy : gy + scroll.top;
  if (ax >= total.width || ay >= total.height) return { kind: 'none' };
  const r = axisAt(g.rows, g.frozenRows, g.frozenHeight, gy, scroll.top);
  const c = axisAt(g.cols, g.frozenCols, g.frozenWidth, gx, scroll.left);
  const m = mergeAt(g, r, c);
  return m ? { kind: 'cell', r: m.r1, c: m.c1 } : { kind: 'cell', r, c };
}

// The scroll that brings (r, c) fully into view, or null when it already is.
export function scrollToReveal(
  g: Geometry,
  r: number,
  c: number,
  scroll: { top: number; left: number },
  view: { width: number; height: number },
): { top: number; left: number } | null {
  let { top, left } = scroll;
  if (r >= g.frozenRows) {
    const y0 = g.rows[r]! - g.frozenHeight;
    const y1 = g.rows[r + 1]! - g.frozenHeight;
    const avail = view.height - g.frozenHeight;
    if (y0 < top) top = y0;
    else if (y1 > top + avail) top = Math.max(0, y1 - avail);
  }
  if (c >= g.frozenCols) {
    const x0 = g.cols[c]! - g.frozenWidth;
    const x1 = g.cols[c + 1]! - g.frozenWidth;
    const avail = view.width - g.frozenWidth;
    if (x0 < left) left = x0;
    else if (x1 > left + avail) left = Math.max(0, x1 - avail);
  }
  return top === scroll.top && left === scroll.left ? null : { top, left };
}

// How many rows a page is, from the active row, for Page Up / Page Down.
export function pageRows(g: Geometry, viewHeight: number): number {
  const avg =
    (g.rows[g.rows.length - 1]! - g.frozenHeight) / Math.max(1, g.rows.length - 1 - g.frozenRows);
  return Math.max(1, Math.floor((viewHeight - g.frozenHeight) / Math.max(1, avg)));
}
