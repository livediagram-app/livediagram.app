// Pure row/column helpers for TableElement. Each returns a NEW element
// with a fresh `cells` grid (never mutates) so callers can drop the
// result straight into a commit. The grid is kept rectangular and at
// least 1x1 at all times.

import type { TableCellStyle, TableElement } from './index';

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

// Insert a blank row. `at` is the index to insert before; omitted means
// append at the bottom.
export function addTableRow(t: TableElement, at?: number): TableElement {
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

export function removeTableColumn(t: TableElement, at?: number): TableElement {
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
// pasted block are preserved.
export function pasteIntoTable(
  t: TableElement,
  r0: number,
  c0: number,
  grid: string[][],
): TableElement {
  if (grid.length === 0) return t;
  const pastedCols = Math.max(1, ...grid.map((row) => row.length));
  const rows = Math.max(t.cells.length, r0 + grid.length);
  const cols = Math.max(tableColCount(t), c0 + pastedCols);
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
