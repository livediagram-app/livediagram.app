// Charts an agent puts over a sheet's cells (docs/specs/029-sheets/sheet-store.md "Shaping a sheet", sheet.md "Charts"):
// a design's charts over its tables, and change_sheet's `chart` over an A1 range. Each is an ordinary chart element
// linked to the range by row and column ids (so it grows with rows inserted inside it), anchored in its Sheet at a
// cell, carrying its first read for what draws it before a browser reads it live. Pure: the caller adds the elements.
import { withArticle } from '@livedesign/items';
import {
  CHART_SOURCE_COLS_MAX,
  SHEET_ANCHOR_MAX,
  chartFieldsFromTable,
  chartShapeOf,
  createShape,
  type ChartPaletteId,
  type ChartType,
  type ShapeElement,
} from '@livedesign/document';
import {
  SHEET_ACCENTS,
  accentChartPalette,
  cellKey,
  colWidth,
  columnLetters,
  templateTints,
  columnIndex,
  formatRange,
  idRangeOf,
  parseA1,
  parseRangeText,
  rowHeight,
  sheetChartTable,
  type IdRange,
  type SheetLayout,
  type Workbook,
} from '@livedesign/sheets';
import type { DesignTableInput } from './sheet-design';
import type { SheetRefusal } from './sheet-state';

// A chart to place: its type, the range it reads (only these columns of it when given), its anchor in the Sheet and
// its size, in a palette.
export type SheetChartOut = {
  type: ChartType;
  range: IdRange;
  cols?: string[];
  anchor: { x: number; y: number };
  width: number;
  height: number;
  palette?: ChartPaletteId;
};

export type SheetChartChange = {
  op: 'chart';
  type: ChartType;
  range: string;
  columns?: string[];
  at?: string;
  width?: number;
  height?: number;
  palette?: ChartPaletteId;
};

// The chart types that draw one series, the first (sheet.md "Charts"); line, area and scatter draw them all.
const ONE_SERIES_TYPES: readonly ChartType[] = ['column', 'bar', 'pie', 'doughnut'];

// What a chart of a one-series type shows of several value columns, said in its answer.
export function seriesNote(type: ChartType, values: readonly string[]): string {
  if (!ONE_SERIES_TYPES.includes(type) || values.length < 2) return '';
  return ` (${withArticle(type)} chart shows one series, ${values[0]}; line and area charts show all ${values.length})`;
}

// The palette in the family of a table's header fill (a design's accent, light or dark canvas), or undefined when the
// header is not an accent's.
export function paletteOfHeader(fill: string | undefined): ChartPaletteId | undefined {
  if (!fill) return undefined;
  const accent = SHEET_ACCENTS.find(
    (a) => templateTints(a, false).head === fill || templateTints(a, true).head === fill,
  );
  return accent ? accentChartPalette(accent) : undefined;
}

// The palette a chart takes when none is given: its table's family for a chart of one series, but none (the vivid
// default, whose colours tell apart) for lines, areas and points of several series, which one family's near shades
// would not.
function defaultPalette(
  type: ChartType,
  series: number,
  family: ChartPaletteId | undefined,
): ChartPaletteId | undefined {
  return !ONE_SERIES_TYPES.includes(type) && series > 1 ? undefined : family;
}

// The header names of a range's value columns: its columns past the first (only those picked, when some are).
function valueNames(wb: Workbook, sheetId: string, r: number, cols: readonly number[]): string[] {
  return cols.slice(1).map((c) => {
    const v = wb.value(sheetId, r, c);
    return typeof v === 'string' && v ? v : columnLetters(c);
  });
}

// A chart's size when none is given, the least it takes (the editor's resize floor) and the most.
export const SHEET_CHART_SIZE = { width: 420, height: 280 } as const;
const CHART_MIN = { width: 160, height: 120 } as const;
const CHART_MAX_PX = 2000;
// The chart's canvas place, for what does not draw the grid: in from the Sheet's right edge and below its chrome, as
// the editor and the templates place one.
const CANVAS_INSET_PX = 24;
const CANVAS_TOP_PX = 120;

const refuse = (code: string, message: string): SheetRefusal => ({ ok: false, code, message });

// A cell's top-left, in px from A1's corner: where a chart sits in its Sheet (hidden rows and columns take no room).
export function anchorAt(
  layout: SheetLayout,
  at: readonly [number, number],
): { x: number; y: number } {
  const hiddenCols = new Set(layout.hiddenCols ?? []);
  const hiddenRows = new Set(layout.hiddenRows ?? []);
  let x = 0;
  for (const id of layout.cols.slice(0, at[1])) if (!hiddenCols.has(id)) x += colWidth(layout, id);
  let y = 0;
  for (const id of layout.rows.slice(0, at[0])) if (!hiddenRows.has(id)) y += rowHeight(layout, id);
  return { x: Math.min(SHEET_ANCHOR_MAX, x), y: Math.min(SHEET_ANCHOR_MAX, y) };
}

const sized = (v: number | undefined, fallback: number, min: number) =>
  Math.round(Math.min(CHART_MAX_PX, Math.max(min, v ?? fallback)));

const named = (head: readonly string[], name: string) =>
  head.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());

// Each table's chart: reading the table's header and body (never its total), at its cell (right of the table, a
// column clear, level with its header, by default).
export function designCharts(
  wb: Workbook,
  sheetId: string,
  tables: readonly (DesignTableInput & { at0: [number, number] })[],
  palette: ChartPaletteId,
): SheetChartOut[] | SheetRefusal {
  const { layout } = wb.sheet(sheetId)!;
  const { rows, cols } = layout;
  const out: SheetChartOut[] = [];
  for (const t of tables) {
    if (!t.chart) continue;
    const [r0, c0] = t.at0;
    let at: [number, number] = [r0, c0 + t.head.length + 1];
    if (t.chart.at !== undefined) {
      const p = parseA1(t.chart.at);
      if (!p)
        return refuse(
          'range_invalid',
          `A chart's at "${t.chart.at}" is not a cell in A1 form ("H4").`,
        );
      at = [p.r, p.c];
    }
    const picked = (t.chart.columns ?? []).map((name) => cols[c0 + named(t.head, name)]!);
    out.push({
      type: t.chart.type,
      range: {
        r1: rows[r0]!,
        c1: cols[c0]!,
        r2: rows[r0 + t.rows.length]!,
        c2: cols[c0 + t.head.length - 1]!,
      },
      ...(picked.length ? { cols: picked.slice(0, CHART_SOURCE_COLS_MAX) } : {}),
      anchor: anchorAt(layout, at),
      width: sized(t.chart.width, SHEET_CHART_SIZE.width, CHART_MIN.width),
      height: sized(t.chart.height, SHEET_CHART_SIZE.height, CHART_MIN.height),
      palette:
        t.chart.palette ??
        defaultPalette(t.chart.type, (t.chart.columns?.length || t.head.length) - 1, palette),
    });
  }
  return out;
}

// change_sheet's `chart`: a range in A1 (its first row the series' names, its first column the labels), only some
// columns of it by letter, at a cell (right of the range, a column clear, level with its top, by default).
export function buildChartChange(
  wb: Workbook,
  sheetId: string,
  change: SheetChartChange,
): { ok: true; writes: []; line: string; charts: SheetChartOut[] } | SheetRefusal {
  const { layout } = wb.sheet(sheetId)!;
  const g = parseRangeText(change.range);
  const ids = g ? idRangeOf(layout, g.r1, g.c1, g.r2, g.c2) : null;
  if (!g || !ids || g.r2 >= layout.rows.length || g.c2 >= layout.cols.length)
    return refuse(
      'range_invalid',
      `"${change.range}" is not a range of the sheet in A1 form ("A4:C12").`,
    );
  if (g.r1 === g.r2)
    return refuse('range_invalid', 'A chart reads a header row and at least one row of data.');
  const picked: string[] = [];
  for (const letter of change.columns ?? []) {
    const c = columnIndex(letter.trim());
    if (c < g.c1 || c > g.c2)
      return refuse('range_invalid', `Column "${letter}" is not a column of ${formatRange(g)}.`);
    picked.push(layout.cols[c]!);
  }
  let at: [number, number] = [g.r1, g.c2 + 2];
  if (change.at !== undefined) {
    const p = parseA1(change.at);
    if (!p) return refuse('range_invalid', `"${change.at}" is not a cell in A1 form ("H4").`);
    at = [p.r, p.c];
  }
  const sheet = wb.sheet(sheetId)!;
  const cols = change.columns?.length
    ? change.columns.map((l) => columnIndex(l.trim()))
    : Array.from({ length: g.c2 - g.c1 + 1 }, (_, i) => g.c1 + i);
  const values = valueNames(wb, sheetId, g.r1, cols);
  const palette =
    change.palette ??
    defaultPalette(
      change.type,
      values.length,
      paletteOfHeader(sheet.cells.get(cellKey(layout.rows[g.r1]!, layout.cols[g.c1]!))?.format?.bg),
    );
  return {
    ok: true,
    writes: [],
    line: `charted ${formatRange(g)} as ${withArticle(change.type)} chart at ${change.at ?? `the cell right of it`}${seriesNote(change.type, values)}`,
    charts: [
      {
        type: change.type,
        range: ids,
        ...(picked.length ? { cols: picked.slice(0, CHART_SOURCE_COLS_MAX) } : {}),
        anchor: anchorAt(layout, at),
        width: sized(change.width, SHEET_CHART_SIZE.width, CHART_MIN.width),
        height: sized(change.height, SHEET_CHART_SIZE.height, CHART_MIN.height),
        ...(palette ? { palette } : {}),
      },
    ],
  };
}

// The chart elements, linked to their Sheet's sheet and anchored in it, each with its first read from `wb`, their
// canvas place over the Sheet `sheetEl`'s top right.
export function sheetChartElements(
  wb: Workbook,
  sheetEl: { x: number; y: number; width: number; height: number },
  sheetId: string,
  charts: readonly SheetChartOut[],
): ShapeElement[] {
  return charts.map((ch) => {
    const { shape, chartVariant } = chartShapeOf(ch.type);
    const source = { sheetId, range: ch.range, ...(ch.cols ? { cols: ch.cols } : {}) };
    const base: ShapeElement = {
      ...createShape(shape, 0, 0),
      ...(chartVariant ? { chartVariant } : {}),
      width: ch.width,
      height: ch.height,
      chartSource: source,
      sheetAnchor: ch.anchor,
      ...(ch.palette ? { chartPalette: ch.palette } : {}),
    };
    // Its range was just read from this workbook, so it reads.
    const table = sheetChartTable(wb, source, wb.locale)!;
    return {
      ...base,
      ...chartFieldsFromTable(base, table),
      x: Math.max(sheetEl.x, sheetEl.x + sheetEl.width - CANVAS_INSET_PX - ch.width),
      y: sheetEl.y + Math.min(CANVAS_TOP_PX, Math.max(0, sheetEl.height - ch.height)),
    };
  });
}
