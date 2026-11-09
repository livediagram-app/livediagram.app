// Pure row/column helpers for TableElement. Each returns a NEW element
// with a fresh `cells` grid (never mutates) so callers can drop the
// result straight into a commit. The grid is kept rectangular and at
// least 1x1 at all times.

import type { TableCellStyle, TableElement } from './index';
import { MAX_TABLE_CELLS, MAX_TABLE_COLS, MAX_TABLE_ROWS } from './validate';

// The clipboard's grid (quoted cells read whole), shared by every product's table paste.
export {
  isTabularClipboard,
  parseClipboardTableText,
} from '@liveworkspace/model-core/table-clipboard';

export function tableRowCount(t: TableElement): number {
  return t.cells.length;
}

export function tableColCount(t: TableElement): number {
  return t.cells[0]?.length ?? 0;
}

// Coerce a (possibly ragged / empty) grid to a rectangle of at least
// 1x1: every row padded / trimmed to the widest row's length. Used on
// load so a hand-edited or legacy table can't crash the renderer.
export function normalizeTable(t: TableElement): TableElement {
  const rows = Math.max(1, t.cells.length);
  const cols = Math.max(1, ...t.cells.map((r) => r.length), 1);
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => t.cells[r]?.[c] ?? ''),
  );
  return { ...t, cells };
}

export function setTableCell(t: TableElement, r: number, c: number, text: string): TableElement {
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
export function canAddTableRow(t: TableElement): boolean {
  const cols = Math.max(1, tableColCount(t));
  return t.cells.length < MAX_TABLE_ROWS && (t.cells.length + 1) * cols <= MAX_TABLE_CELLS;
}
export function canAddTableColumn(t: TableElement): boolean {
  const cols = tableColCount(t);
  return cols < MAX_TABLE_COLS && t.cells.length * (cols + 1) <= MAX_TABLE_CELLS;
}

// Insert a blank row. `at` is the index to insert before; omitted means
// append at the bottom. At the caps the table comes back unchanged.
export function addTableRow(t: TableElement, at?: number): TableElement {
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
export function removeTableRow(t: TableElement, at?: number): TableElement {
  if (t.cells.length <= 1) return t;
  const idx = at ?? t.cells.length - 1;
  const cells = t.cells.filter((_, i) => i !== idx);
  const rowHeights = t.rowHeights ? t.rowHeights.filter((_, i) => i !== idx) : t.rowHeights;
  const cellStyles = t.cellStyles ? t.cellStyles.filter((_, i) => i !== idx) : t.cellStyles;
  return { ...t, cells, rowHeights, cellStyles };
}

export function addTableColumn(t: TableElement, at?: number): TableElement {
  if (!canAddTableColumn(t)) return t;
  const idx = at ?? tableColCount(t);
  const cells = t.cells.map((row) => [...row.slice(0, idx), '', ...row.slice(idx)]);
  const colWidths = t.colWidths
    ? [...t.colWidths.slice(0, idx), null, ...t.colWidths.slice(idx)]
    : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => [...row.slice(0, idx), null, ...row.slice(idx)])
    : t.cellStyles;
  // The highlighted column (docs/specs/009-elements/comparison-tables.md) moves right with a column put before it.
  const hc = t.highlightColumn;
  return withHighlight(
    { ...t, cells, colWidths, cellStyles },
    hc !== undefined && idx <= hc ? hc + 1 : hc,
  );
}

export function removeTableColumn(t: TableElement, at?: number): TableElement {
  if (tableColCount(t) <= 1) return t;
  const idx = at ?? tableColCount(t) - 1;
  const cells = t.cells.map((row) => row.filter((_, i) => i !== idx));
  const colWidths = t.colWidths ? t.colWidths.filter((_, i) => i !== idx) : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => row.filter((_, i) => i !== idx))
    : t.cellStyles;
  // Deleting the highlighted column removes the highlight; deleting one before it moves it left.
  const hc = t.highlightColumn;
  const nextHc = hc === undefined || hc === idx ? undefined : idx < hc ? hc - 1 : hc;
  return withHighlight({ ...t, cells, colWidths, cellStyles }, nextHc);
}

// Overlay a parsed grid (rows of cells, e.g. from a pasted TSV) onto
// the table starting at (r0, c0), growing the table with blank cells
// as needed so the whole paste fits. Existing cells outside the
// pasted block are preserved. The grid grows no further than the caps every save checks (validate.ts):
// what lies past them is left out, so a big spreadsheet paste can't leave a tab no save accepts.
export function pasteIntoTable(
  t: TableElement,
  r0: number,
  c0: number,
  grid: string[][],
): TableElement {
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
export function setCellStyle(
  t: TableElement,
  r: number,
  c: number,
  patch: Partial<TableCellStyle>,
): TableElement {
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
export function clearCellStyle(t: TableElement, r: number, c: number): TableElement {
  if (!t.cellStyles) return t;
  return setCellStyleRaw(t, r, c, null);
}

function setCellStyleRaw(
  t: TableElement,
  r: number,
  c: number,
  value: TableCellStyle | null,
): TableElement {
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
export function moveTableColumn(t: TableElement, from: number, to: number): TableElement {
  const cols = tableColCount(t);
  if (from === to || from < 0 || from >= cols || to < 0 || to >= cols) return t;
  const cells = t.cells.map((row) => moveInArray(row, from, to, cols, () => ''));
  const colWidths = t.colWidths
    ? moveInArray(t.colWidths, from, to, cols, () => null)
    : t.colWidths;
  const cellStyles = t.cellStyles
    ? t.cellStyles.map((row) => moveInArray(row, from, to, cols, () => null))
    : t.cellStyles;
  return withHighlight(
    { ...t, cells, colWidths, cellStyles },
    movedIndex(t.highlightColumn, from, to),
  );
}

// Where index `i` lands when the track at `from` moves to `to`: the moved track goes with it, the ones between shift.
function movedIndex(i: number | undefined, from: number, to: number): number | undefined {
  if (i === undefined) return undefined;
  if (i === from) return to;
  if (from < to && i > from && i <= to) return i - 1;
  if (from > to && i >= to && i < from) return i + 1;
  return i;
}

// `t` with its highlighted column at `c`, or none (the key removed, not left undefined, so it round-trips).
function withHighlight(t: TableElement, c: number | undefined): TableElement {
  if (c === t.highlightColumn) return t;
  const { highlightColumn: _old, ...rest } = t;
  return c === undefined ? rest : { ...rest, highlightColumn: c };
}

/** Highlight column `c` as the recommended one, or remove the highlight with null
 *  (docs/specs/009-elements/comparison-tables.md). An index outside the table removes it. */
export function withHighlightColumn(t: TableElement, c: number | null): TableElement {
  const cols = tableColCount(t);
  return withHighlight(t, c !== null && c >= 0 && c < cols ? c : undefined);
}

export function moveTableRow(t: TableElement, from: number, to: number): TableElement {
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

/** What one table commit writes (docs/specs/008-canvas/canvas-and-palette.md Table): the cells and their parallel
 *  tracks and styles, and the highlighted column. */
export type TablePatch = Partial<
  Pick<TableElement, 'cells' | 'colWidths' | 'rowHeights' | 'cellStyles' | 'highlightColumn'>
>;

/** `t` with `patch` written over it. A `highlightColumn` key holding undefined removes the highlight, so the table
 *  carries no empty key. */
export function withTablePatch<T extends TableElement>(t: T, patch: TablePatch): T {
  const next = { ...t, ...patch };
  if ('highlightColumn' in patch && patch.highlightColumn === undefined)
    delete next.highlightColumn;
  return next;
}
