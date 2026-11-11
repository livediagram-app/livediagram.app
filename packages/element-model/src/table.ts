// Pure row/column helpers for TableElement. Each returns a NEW element
// with a fresh `cells` grid (never mutates) so callers can drop the
// result straight into a commit. The grid is kept rectangular and at
// least 1x1 at all times.

import type { TextAlignX, TextSize } from '@liveworkspace/model-core/basics';

// The size limits every product's validator holds a table to (its MAX_TABLE_ROWS, MAX_TABLE_COLS, MAX_TABLE_CELLS).
export const TABLE_ROWS_MAX = 1_000;
export const TABLE_COLS_MAX = 1_000;
export const TABLE_CELLS_MAX = 50_000;
const MAX_TABLE_ROWS = TABLE_ROWS_MAX;
const MAX_TABLE_COLS = TABLE_COLS_MAX;
const MAX_TABLE_CELLS = TABLE_CELLS_MAX;

/** A cell's own style, as every product stores it (its link is the product's own). */
type TableCellStyle = {
  bg?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textSize?: TextSize;
  alignX?: TextAlignX;
  link?: unknown;
};

/** The table fields these helpers read and write, as every product's TableElement stores them. Each helper is
 *  generic over the product's own table, so a caller gets its own type back. */
export type TableGrid = {
  cells: string[][];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  cellStyles?: (TableCellStyle | null)[][];
};

/** A product's cell style: what its table's `cellStyles` hold. */
type CellStyleOf<T extends TableGrid> = NonNullable<NonNullable<T['cellStyles']>[number][number]>;

// The clipboard's grid (quoted cells read whole), shared by every product's table paste.
export {
  isTabularClipboard,
  parseClipboardTableText,
} from '@liveworkspace/model-core/table-clipboard';

export function tableRowCount(t: TableGrid): number {
  return t.cells.length;
}

export function tableColCount(t: TableGrid): number {
  return t.cells[0]?.length ?? 0;
}

// Coerce a (possibly ragged / empty) grid to a rectangle of at least
// 1x1: every row padded / trimmed to the widest row's length. Used on
// load so a hand-edited or legacy table can't crash the renderer.
export function normalizeTable<T extends TableGrid>(t: T): T {
  const rows = Math.max(1, t.cells.length);
  const cols = Math.max(1, ...t.cells.map((r) => r.length), 1);
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => t.cells[r]?.[c] ?? ''),
  );
  return { ...t, cells };
}

export function setTableCell<T extends TableGrid>(t: T, r: number, c: number, text: string): T {
  if (r < 0 || r >= t.cells.length) return t;
  const row = t.cells[r];
  if (!row || c < 0 || c >= row.length) return t;
  const cells = t.cells.map((rr, ri) =>
    ri === r ? rr.map((cc, ci) => (ci === c ? text : cc)) : rr,
  );
  return { ...t, cells };
}

// Whether one more row / column still fits the caps every save checks (validate.ts): a table past them is
// refused by the room and by every save of its tab, so an add at a cap leaves the table as it is.
export function canAddTableRow(t: TableGrid): boolean {
  const cols = Math.max(1, tableColCount(t));
  return t.cells.length < MAX_TABLE_ROWS && (t.cells.length + 1) * cols <= MAX_TABLE_CELLS;
}
export function canAddTableColumn(t: TableGrid): boolean {
  const cols = tableColCount(t);
  return cols < MAX_TABLE_COLS && t.cells.length * (cols + 1) <= MAX_TABLE_CELLS;
}

// Insert a blank row. `at` is the index to insert before; omitted means
// append at the bottom. At the caps the table comes back unchanged.
export function addTableRow<T extends TableGrid>(t: T, at?: number): T {
  if (!canAddTableRow(t)) return t;
  const cols = Math.max(1, tableColCount(t));
  const blank = Array.from({ length: cols }, () => '');
  const idx = at ?? t.cells.length;
  const cells = [...t.cells.slice(0, idx), blank, ...t.cells.slice(idx)];
  const rowHeights = t.rowHeights
    ? [...t.rowHeights.slice(0, idx), null, ...t.rowHeights.slice(idx)]
    : t.rowHeights;
  const blankStyles = Array.from({ length: Math.max(1, tableColCount(t)) }, () => null);
  const cellStyles = t.cellStyles
    ? [...t.cellStyles.slice(0, idx), blankStyles, ...t.cellStyles.slice(idx)]
    : t.cellStyles;
  return { ...t, cells, rowHeights, cellStyles };
}

// Remove a row (the last one by default). Never drops below one row.
export function removeTableRow<T extends TableGrid>(t: T, at?: number): T {
  if (t.cells.length <= 1) return t;
  const idx = at ?? t.cells.length - 1;
  const cells = t.cells.filter((_, i) => i !== idx);
  const rowHeights = t.rowHeights ? t.rowHeights.filter((_, i) => i !== idx) : t.rowHeights;
  const cellStyles = t.cellStyles ? t.cellStyles.filter((_, i) => i !== idx) : t.cellStyles;
  return { ...t, cells, rowHeights, cellStyles };
}

export function addTableColumn<T extends TableGrid>(t: T, at?: number): T {
  if (!canAddTableColumn(t)) return t;
  const idx = at ?? tableColCount(t);
  const cells = t.cells.map((row) => [...row.slice(0, idx), '', ...row.slice(idx)]);
  const colWidths = t.colWidths
    ? [...t.colWidths.slice(0, idx), null, ...t.colWidths.slice(idx)]
    : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => [...row.slice(0, idx), null, ...row.slice(idx)])
    : t.cellStyles;
  return { ...t, cells, colWidths, cellStyles };
}

export function removeTableColumn<T extends TableGrid>(t: T, at?: number): T {
  if (tableColCount(t) <= 1) return t;
  const idx = at ?? tableColCount(t) - 1;
  const cells = t.cells.map((row) => row.filter((_, i) => i !== idx));
  const colWidths = t.colWidths ? t.colWidths.filter((_, i) => i !== idx) : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => row.filter((_, i) => i !== idx))
    : t.cellStyles;
  return { ...t, cells, colWidths, cellStyles };
}

// Overlay a parsed grid (rows of cells, e.g. from a pasted TSV) onto
// the table starting at (r0, c0), growing the table with blank cells
// as needed so the whole paste fits. Existing cells outside the
// pasted block are preserved. The grid grows no further than the caps every save checks (validate.ts):
// what lies past them is left out, so a big spreadsheet paste can't leave a tab no save accepts.
export function pasteIntoTable<T extends TableGrid>(
  t: T,
  r0: number,
  c0: number,
  grid: string[][],
): T {
  if (grid.length === 0) return t;
  const pastedCols = Math.max(1, ...grid.map((row) => row.length));
  const haveRows = t.cells.length;
  const haveCols = tableColCount(t);
  // Columns first (a paste is read across), then as many rows as the cell cap leaves; never below what the
  // table already holds, which a saved table keeps within the caps.
  const cols = Math.max(
    haveCols,
    Math.min(c0 + pastedCols, MAX_TABLE_COLS, Math.floor(MAX_TABLE_CELLS / Math.max(1, haveRows))),
  );
  const rows = Math.max(
    haveRows,
    Math.min(r0 + grid.length, MAX_TABLE_ROWS, Math.floor(MAX_TABLE_CELLS / Math.max(1, cols))),
  );
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const gi = r - r0;
      const gj = c - c0;
      const pasted = grid[gi]?.[gj];
      return pasted ?? t.cells[r]?.[c] ?? '';
    }),
  );
  return { ...t, cells };
}

// Per-cell style override (background / text colour / bold). Merges
// `patch` into the cell's style; a cell whose merged style is empty
// is stored as null (inherits the table defaults).
export function setCellStyle<T extends TableGrid>(
  t: T,
  r: number,
  c: number,
  patch: Partial<CellStyleOf<T>>,
): T {
  const row = t.cells[r];
  if (!row || c < 0 || c >= row.length) return t;
  const rows = t.cells.length;
  const cols = tableColCount(t);
  const existing = t.cellStyles?.[r]?.[c] ?? {};
  const next: TableCellStyle = { ...existing, ...patch };
  const cleaned: TableCellStyle = {};
  if (next.bg !== undefined) cleaned.bg = next.bg;
  if (next.textColor !== undefined) cleaned.textColor = next.textColor;
  if (next.bold !== undefined) cleaned.bold = next.bold;
  if (next.italic !== undefined) cleaned.italic = next.italic;
  if (next.underline !== undefined) cleaned.underline = next.underline;
  if (next.textSize !== undefined) cleaned.textSize = next.textSize;
  if (next.alignX !== undefined) cleaned.alignX = next.alignX;
  // Per-cell link (docs/specs/008-canvas/canvas-and-palette.md). Pass `{ link: undefined }` to clear it.
  if (next.link !== undefined) cleaned.link = next.link;
  const merged = Object.keys(cleaned).length > 0 ? cleaned : null;
  const cellStyles = Array.from({ length: rows }, (_, ri) =>
    Array.from({ length: cols }, (_, ci) =>
      ri === r && ci === c ? merged : (t.cellStyles?.[ri]?.[ci] ?? null),
    ),
  );
  return { ...t, cellStyles };
}

// Clear a cell's style overrides (back to the table defaults).
export function clearCellStyle<T extends TableGrid>(t: T, r: number, c: number): T {
  if (!t.cellStyles) return t;
  return setCellStyleRaw(t, r, c, null);
}

function setCellStyleRaw<T extends TableGrid>(
  t: T,
  r: number,
  c: number,
  value: TableCellStyle | null,
): T {
  const rows = t.cells.length;
  const cols = tableColCount(t);
  const cellStyles = Array.from({ length: rows }, (_, ri) =>
    Array.from({ length: cols }, (_, ci) =>
      ri === r && ci === c ? value : (t.cellStyles?.[ri]?.[ci] ?? null),
    ),
  );
  return { ...t, cellStyles };
}

// `arr` moved as a list of `n` (padded with `fill`): a parallel list (widths, heights, styles) can be shorter than the
// grid, as after a paste grew it, and splicing past its end moved a width or style onto the wrong column.
function moveInArray<T>(arr: T[], from: number, to: number, n: number, fill: () => T): T[] {
  const a = Array.from({ length: Math.max(n, arr.length) }, (_, i) =>
    i < arr.length ? arr[i]! : fill(),
  );
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x as T);
  return a;
}

// Reorder a column / row to a new index, carrying its width/height +
// cell styles along.
export function moveTableColumn<T extends TableGrid>(t: T, from: number, to: number): T {
  const cols = tableColCount(t);
  if (from === to || from < 0 || from >= cols || to < 0 || to >= cols) return t;
  const cells = t.cells.map((row) => moveInArray(row, from, to, cols, () => ''));
  const colWidths = t.colWidths
    ? moveInArray(t.colWidths, from, to, cols, () => null)
    : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => moveInArray(row, from, to, cols, () => null))
    : t.cellStyles;
  return { ...t, cells, colWidths, cellStyles };
}

export function moveTableRow<T extends TableGrid>(t: T, from: number, to: number): T {
  const rows = t.cells.length;
  if (from === to || from < 0 || from >= rows || to < 0 || to >= rows) return t;
  const cells = moveInArray(t.cells, from, to, rows, () => []);
  const rowHeights = t.rowHeights
    ? moveInArray(t.rowHeights, from, to, rows, () => null)
    : t.rowHeights;
  const cellStyles = t.cellStyles
    ? moveInArray(t.cellStyles, from, to, rows, () => [])
    : t.cellStyles;
  return { ...t, cells, rowHeights, cellStyles };
}
