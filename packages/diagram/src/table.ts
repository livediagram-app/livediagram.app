// Pure row/column helpers for TableElement. Each returns a NEW element
// with a fresh `cells` grid (never mutates) so callers can drop the
// result straight into a commit. The grid is kept rectangular and at
// least 1x1 at all times.

import type { TableElement } from './index';

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
  return { ...t, cells };
}

// Remove a row (the last one by default). Never drops below one row.
export function removeTableRow(t: TableElement, at?: number): TableElement {
  if (t.cells.length <= 1) return t;
  const idx = at ?? t.cells.length - 1;
  return { ...t, cells: t.cells.filter((_, i) => i !== idx) };
}

export function addTableColumn(t: TableElement, at?: number): TableElement {
  const idx = at ?? tableColCount(t);
  const cells = t.cells.map((row) => [...row.slice(0, idx), '', ...row.slice(idx)]);
  const colWidths = t.colWidths
    ? [...t.colWidths.slice(0, idx), null, ...t.colWidths.slice(idx)]
    : t.colWidths;
  return { ...t, cells, colWidths };
}

export function removeTableColumn(t: TableElement, at?: number): TableElement {
  if (tableColCount(t) <= 1) return t;
  const idx = at ?? tableColCount(t) - 1;
  const cells = t.cells.map((row) => row.filter((_, i) => i !== idx));
  const colWidths = t.colWidths ? t.colWidths.filter((_, i) => i !== idx) : t.colWidths;
  return { ...t, cells, colWidths };
}
