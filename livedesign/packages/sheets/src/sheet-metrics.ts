// A Dashboard's figures from a Sheet (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): one cell's value (a
// Sheet Figure, with an optional target cell), a column's total, average, lowest, highest or count (a Column
// Summary), and a column's last value against the one before (a Trend). Cells and columns are named by their stable
// row and column ids, so a figure follows rows and columns inserted, deleted or moved around it. Pure: the editor
// reads it live from the document's workbook, the same values the Sheet shows.
import { formatA1, parseA1 } from './address';
import { layoutIndex } from './layout';
import { cellKey, type CellFormat, type Sheet } from './sheet';
import { displayValue } from './number-format';
import type { Value } from './formula/values';
import type { Workbook } from './engine/workbook';

export type SheetCellRef = { r: string; c: string };
export const COLUMN_STATS = ['sum', 'average', 'min', 'max', 'count'] as const;
type ColumnStat = (typeof COLUMN_STATS)[number];
export const COLUMN_STAT_NAMES: Record<ColumnStat, string> = {
  sum: 'Total',
  average: 'Average',
  min: 'Lowest',
  max: 'Highest',
  count: 'Count',
};

// The most rows a column read takes, and the most suggestions offered: a figure stays cheap on a huge sheet.
const METRIC_ROWS_MAX = 2000;
const FIGURE_SUGGESTIONS_MAX = 12;

const isNumber = (v: Value): v is number => typeof v === 'number' && Number.isFinite(v);

// The ids of a cell typed as A1 ("C6", "$C$6"), or null outside the grid or for anything else.
export function cellRefFromA1(sheet: Sheet, text: string): SheetCellRef | null {
  const p = parseA1(text.trim().toUpperCase());
  if (!p) return null;
  const r = sheet.layout.rows[p.r];
  const c = sheet.layout.cols[p.c];
  return r && c ? { r, c } : null;
}

// A cell's A1 address now, or null once its row or column is gone.
export function a1OfRef(sheet: Sheet, ref: SheetCellRef): string | null {
  const ix = layoutIndex(sheet.layout);
  const r = ix.rowPos.get(ref.r);
  const c = ix.colPos.get(ref.c);
  return r === undefined || c === undefined ? null : formatA1(r, c);
}

function pos(sheet: Sheet, ref: SheetCellRef): { r: number; c: number } | null {
  const ix = layoutIndex(sheet.layout);
  const r = ix.rowPos.get(ref.r);
  const c = ix.colPos.get(ref.c);
  return r === undefined || c === undefined ? null : { r, c };
}

// A number as the cell at `ref` would show it (its own number format), for a figure the cell does not hold itself (a
// total of its column).
export function formatLike(sheet: Sheet, ref: SheetCellRef, n: number, locale: string): string {
  return displayValue(n, sheet.cells.get(cellKey(ref.r, ref.c))?.format, locale).text;
}

type SheetFigure = {
  // The number, or null when the cell holds none (text, empty, an error).
  value: number | null;
  // As the Sheet shows it.
  text: string;
  // What it is called: the text to its left, else the header above it, else its address.
  label: string;
  a1: string;
};

// A cell's figure, or null once its row or column is gone.
export function sheetFigure(
  wb: Workbook,
  sheet: Sheet,
  ref: SheetCellRef,
  locale: string,
): SheetFigure | null {
  const at = pos(sheet, ref);
  if (!at) return null;
  const v = wb.value(sheet.id, at.r, at.c);
  const shown = displayValue(v, sheet.cells.get(cellKey(ref.r, ref.c))?.format, locale);
  return {
    value: isNumber(v) ? v : null,
    text: shown.text,
    label: labelAt(wb, sheet, at.r, at.c),
    a1: formatA1(at.r, at.c),
  };
}

// The words that name the cell at (r, c): the nearest text to its left in its row, else the top of its column.
function labelAt(wb: Workbook, sheet: Sheet, r: number, c: number): string {
  for (let cc = c - 1; cc >= 0; cc--) {
    const t = wb.value(sheet.id, r, cc);
    if (typeof t === 'string' && t.trim()) return t.trim();
    if (isNumber(t)) break;
  }
  if (r > 0) {
    const head = wb.value(sheet.id, 0, c);
    if (typeof head === 'string' && head.trim()) return head.trim();
  }
  return formatA1(r, c);
}

// The cells most worth showing as a figure: numbers named by text to their left (a "Total" row, a "Budget" line) and
// a range named for a single cell, the last rows first (totals sit at the foot), at most FIGURE_SUGGESTIONS_MAX.
export function figureSuggestions(
  wb: Workbook,
  sheet: Sheet,
  locale: string,
): (SheetFigure & { ref: SheetCellRef })[] {
  const out: (SheetFigure & { ref: SheetCellRef })[] = [];
  const seen = new Set<string>();
  const add = (ref: SheetCellRef) => {
    const key = cellKey(ref.r, ref.c);
    if (seen.has(key) || out.length >= FIGURE_SUGGESTIONS_MAX) return;
    const f = sheetFigure(wb, sheet, ref, locale);
    if (!f || f.value === null) return;
    seen.add(key);
    out.push({ ...f, ref });
  };
  for (const n of sheet.layout.names ?? [])
    if (n.r1 === n.r2 && n.c1 === n.c2) add({ r: n.r1, c: n.c1 });
  const { rows, cols } = wb.extent(sheet.id);
  for (
    let r = Math.min(rows, METRIC_ROWS_MAX) - 1;
    r >= 0 && out.length < FIGURE_SUGGESTIONS_MAX;
    r--
  )
    for (let c = 1; c < cols; c++) {
      const v = wb.value(sheet.id, r, c);
      const left = wb.value(sheet.id, r, c - 1);
      if (isNumber(v) && typeof left === 'string' && left.trim()) {
        add({ r: sheet.layout.rows[r]!, c: sheet.layout.cols[c]! });
        break;
      }
    }
  return out;
}

type SheetColumn = {
  c: string;
  // Its header (the text over its numbers), else its letters.
  label: string;
  // Its numbers below the header, top to bottom, hidden rows and a total row left out (at most METRIC_ROWS_MAX).
  values: number[];
  // The first of its number cells, whose format a summary borrows.
  first: SheetCellRef | null;
};

// A row that totals the table above it: its cell bold and ruled above (a template's total row, sheet.md "Sheet
// templates"), or named Total (or Subtotal, Total Due) by the text to its left.
const TOTAL_LABEL = /total/i;

type ColumnRun = { header: string | null; values: number[]; first: SheetCellRef | null };

// A column of numbers: its main table's, read below that table's header and above its total row. A sheet's header is
// not always its first row (a template's title and subtitle sit above it, sheet.md "Sheet templates"), and a column
// may hold several tables (a template's chart data below its main table), so the column is read as runs of numbers,
// each under a header (a bold text cell, or the first text over the numbers) and ended by a total row or the next bold
// header; the run with the most numbers is the column's (the first of equals). A text cell inside a run (a "Done" in a
// Days Left column) is left out.
export function sheetColumn(wb: Workbook, sheet: Sheet, colId: string): SheetColumn | null {
  const ix = layoutIndex(sheet.layout);
  const c = ix.colPos.get(colId);
  if (c === undefined) return null;
  const { rows } = wb.extent(sheet.id);
  const runs: ColumnRun[] = [];
  let run: ColumnRun = { header: null, values: [], first: null };
  const close = () => {
    if (run.values.length > 0) runs.push(run);
    run = { header: null, values: [], first: null };
  };
  for (let r = 0; r < Math.min(rows, METRIC_ROWS_MAX); r++) {
    const rowId = sheet.layout.rows[r]!;
    if (ix.hiddenRows.has(rowId)) continue;
    const v = wb.value(sheet.id, r, c);
    const format = sheet.cells.get(cellKey(rowId, colId))?.format;
    if (v === null) {
      // An empty cell of a ruled bold row (a total with nothing in this column) still ends the table above it.
      if (format?.b && format.bt) close();
      continue;
    }
    if (isNumber(v)) {
      if (isTotalRow(wb, sheet, r, c, format)) {
        close();
        continue;
      }
      run.values.push(v);
      run.first ??= { r: rowId, c: colId };
      continue;
    }
    if (typeof v !== 'string' || !v.trim()) continue;
    // A bold text cell heads a new table; plain text heads one only before any header or number.
    if (format?.b) {
      close();
      run.header = v.trim();
    } else if (run.header === null && run.values.length === 0) run.header = v.trim();
  }
  close();
  const main = runs.reduce<ColumnRun | null>(
    (best, x) => (!best || x.values.length > best.values.length ? x : best),
    null,
  );
  return {
    c: colId,
    label: main?.header ?? formatA1(0, c).replace(/\d+$/, ''),
    values: main?.values ?? [],
    first: main?.first ?? null,
  };
}

function isTotalRow(
  wb: Workbook,
  sheet: Sheet,
  r: number,
  c: number,
  format: CellFormat | undefined,
): boolean {
  if (format?.b && format.bt) return true;
  for (let cc = c - 1; cc >= 0; cc--) {
    const t = wb.value(sheet.id, r, cc);
    if (typeof t === 'string' && t.trim()) return TOTAL_LABEL.test(t);
    if (isNumber(t)) return false;
  }
  return false;
}

// The columns holding numbers, in sheet order: what a Column Summary or a Trend can read.
export function numberColumns(wb: Workbook, sheet: Sheet): SheetColumn[] {
  const { cols } = wb.extent(sheet.id);
  const out: SheetColumn[] = [];
  for (let c = 0; c < cols; c++) {
    const col = sheetColumn(wb, sheet, sheet.layout.cols[c]!);
    if (col && col.values.length > 0) out.push(col);
  }
  return out;
}

// A column's summary by `stat`, or null with nothing to summarise (a count of nothing is 0).
export function summarise(values: readonly number[], stat: ColumnStat): number | null {
  if (stat === 'count') return values.length;
  if (values.length === 0) return null;
  if (stat === 'sum') return values.reduce((a, b) => a + b, 0);
  if (stat === 'average') return values.reduce((a, b) => a + b, 0) / values.length;
  // A loop, not a spread: a column's values can outnumber what a spread call takes.
  return values.reduce((m, n) => (stat === 'min' ? Math.min(m, n) : Math.max(m, n)));
}

type ColumnTrend = {
  last: number;
  previous: number | null;
  change: number | null;
  ratio: number | null;
};

// A column's last value against the one before it: the change, and the change as a share of the one before (null
// when that was 0).
export function columnTrend(values: readonly number[]): ColumnTrend | null {
  if (values.length === 0) return null;
  const last = values[values.length - 1]!;
  const previous = values.length > 1 ? values[values.length - 2]! : null;
  const change = previous === null ? null : last - previous;
  const ratio = previous === null || previous === 0 ? null : (last - previous) / Math.abs(previous);
  return { last, previous, change, ratio };
}

// Small-multiple samples of a column for its sparkline: at most `max` points, evenly picked, the last always kept.
export function sparklineOf(values: readonly number[], max = 40): number[] {
  if (values.length <= max) return [...values];
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]!);
}
