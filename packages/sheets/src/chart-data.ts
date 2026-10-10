// A chart's data from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): the range by stable row and column ids,
// so it grows with rows inserted inside it and follows moves. Read as a spreadsheet does: a first row with no numbers
// in it names the series, a first column of text (or dates) labels the categories, and every other column is one
// series. Rows a filter hides are left out. Pure: the editor, exports and the api thumbnail all read it.
import { layoutIndex, posRangeOf } from './layout';
import { columnLetters } from './address';
import { cellKey, type IdRange, type NumberFormatKind } from './sheet';
import { displayValue } from './number-format';
import { isError, type Value } from './formula/values';
import type { Workbook } from './engine/workbook';

// A chart's link to its sheet: the sheet and the range, by ids, and only some of its columns when several ranges were
// picked together (sheet.md "Charts").
export type SheetChartLink = { sheetId: string; range: IdRange; cols?: readonly string[] };

export type SheetChartTable = {
  // The category labels, one per row of data.
  categories: string[];
  // One per value column, its name from the header row (or its column letter).
  series: { name: string; values: number[] }[];
};

// Bounds: a chart past these is unreadable, and they keep a read cheap on a huge range.
export const CHART_CATEGORIES_MAX = 500;
export const CHART_SERIES_MAX = 12;

const DATE_FORMATS: ReadonlySet<NumberFormatKind> = new Set(['date', 'time', 'datetime']);

const isNumber = (v: Value): v is number => typeof v === 'number' && Number.isFinite(v);
const isBlank = (v: Value) => v === null || v === '';

// The table a range holds now, or null when the sheet or a corner of the range is gone.
export function sheetChartTable(
  wb: Workbook,
  link: SheetChartLink,
  locale: string,
): SheetChartTable | null {
  const sheet = wb.sheet(link.sheetId);
  if (!sheet) return null;
  const { layout } = sheet;
  const p = posRangeOf(layout, link.range);
  if (!p) return null;
  const ix = layoutIndex(layout);
  const rows: number[] = [];
  for (let r = p.r1; r <= p.r2 && rows.length <= CHART_CATEGORIES_MAX; r++)
    if (!ix.hiddenRows.has(layout.rows[r]!)) rows.push(r);
  const picked = link.cols ? new Set(link.cols) : null;
  const cols: number[] = [];
  for (let c = p.c1; c <= p.c2 && cols.length <= CHART_SERIES_MAX; c++) {
    const id = layout.cols[c]!;
    if (!ix.hiddenCols.has(id) && (!picked || picked.has(id))) cols.push(c);
  }
  if (!rows.length || !cols.length) return { categories: [], series: [] };
  const value = (r: number, c: number) => wb.value(link.sheetId, r, c);
  const text = (r: number, c: number) =>
    displayValue(
      value(r, c),
      sheet.cells.get(cellKey(layout.rows[r]!, layout.cols[c]!))?.format,
      locale,
    ).text;
  const nf = (r: number, c: number) =>
    sheet.cells.get(cellKey(layout.rows[r]!, layout.cols[c]!))?.format?.nf;

  // A first column of text or dates labels the categories (only beside other columns).
  const labelled =
    cols.length > 1 &&
    rows.some((r) => {
      const v = value(r, cols[0]!);
      return (!isNumber(v) && !isBlank(v) && !isError(v)) || DATE_FORMATS.has(nf(r, cols[0]!)!);
    });
  const valueCols = labelled ? cols.slice(1) : cols;
  // A first row with no numbers among the values names the series (only above other rows).
  const headed =
    rows.length > 1 &&
    valueCols.every((c) => !isNumber(value(rows[0]!, c))) &&
    valueCols.some((c) => !isBlank(value(rows[0]!, c)));
  const body = (headed ? rows.slice(1) : rows).slice(0, CHART_CATEGORIES_MAX);
  return {
    categories: body.map((r, i) => (labelled ? text(r, cols[0]!) : String(i + 1))),
    series: valueCols.slice(0, CHART_SERIES_MAX).map((c) => ({
      name: (headed ? text(rows[0]!, c) : '') || `Column ${columnLetters(c)}`,
      values: body.map((r) => {
        const v = value(r, c);
        return isNumber(v) ? v : 0;
      }),
    })),
  };
}

// The block of data around a cell (a spreadsheet's current region): grown a row or a column at a time while the
// line just outside it holds anything beside the block, so a chart made from one cell takes the table it sits in.
export function regionAround(
  wb: Workbook,
  sheetId: string,
  at: { r: number; c: number },
): { r1: number; c1: number; r2: number; c2: number } {
  const ext = wb.extent(sheetId);
  const filled = (r: number, c: number) => !isBlank(wb.value(sheetId, r, c));
  const g = { r1: at.r, c1: at.c, r2: at.r, c2: at.c };
  const rowHas = (r: number) => {
    for (let c = Math.max(0, g.c1 - 1); c <= Math.min(ext.cols - 1, g.c2 + 1); c++)
      if (filled(r, c)) return true;
    return false;
  };
  const colHas = (c: number) => {
    for (let r = Math.max(0, g.r1 - 1); r <= Math.min(ext.rows - 1, g.r2 + 1); r++)
      if (filled(r, c)) return true;
    return false;
  };
  // Bounded by the filled extent, and by the chart limits so a vast sheet never makes a vast scan.
  for (let grew = true, steps = 0; grew && steps < CHART_CATEGORIES_MAX * 2; steps++) {
    const up = g.r1 > 0 && rowHas(g.r1 - 1);
    if (up) g.r1--;
    const down = g.r2 < ext.rows - 1 && rowHas(g.r2 + 1);
    if (down) g.r2++;
    const left = g.c1 > 0 && colHas(g.c1 - 1);
    if (left) g.c1--;
    const right = g.c2 < ext.cols - 1 && colHas(g.c2 + 1);
    if (right) g.c2++;
    grew = up || down || left || right;
  }
  return g;
}
