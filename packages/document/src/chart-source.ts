// A chart drawn from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): a pie, bar or line chart element whose
// `chartSource` names a sheet of the document and a range of it by stable row and column ids. Its data is read from
// the sheet wherever it is drawn (the editor, an export, a thumbnail); the element's own data is the last read,
// kept for anything that cannot read the sheet. Pure, and free of the sheets engine.
import { PLAN_SHEET_ID_PATTERN } from './element-types';
import type { LineSeries, PieSlice } from './data-shapes';

export type ChartSource = {
  sheetId: string;
  range: { r1: string; c1: string; r2: string; c2: string };
  // Only these of the range's columns, by id (several ranges picked together); every column when absent.
  cols?: string[];
};

// The most columns a source names: the series cap and a label column (@livediagram/sheets CHART_SERIES_MAX + 1).
export const CHART_SOURCE_COLS_MAX = 13;

// The table a range holds (@livediagram/sheets SheetChartTable, restated): one category per row, one series per
// value column.
export type ChartTable = {
  categories: string[];
  series: { name: string; values: number[] }[];
};

// A sheet's row or column id (@livediagram/sheets AXIS_ID_PATTERN, repeated so this package never imports it).
const AXIS_ID = /^[a-z0-9]{4,12}$/;

export function isChartSource(v: unknown): v is ChartSource {
  if (typeof v !== 'object' || v === null) return false;
  const { sheetId, range, cols, ...rest } = v as {
    sheetId?: unknown;
    range?: unknown;
    cols?: unknown;
  };
  if (typeof sheetId !== 'string' || !PLAN_SHEET_ID_PATTERN.test(sheetId)) return false;
  if (Object.keys(rest).length || typeof range !== 'object' || range === null) return false;
  if (
    cols !== undefined &&
    !(
      Array.isArray(cols) &&
      cols.length > 0 &&
      cols.length <= CHART_SOURCE_COLS_MAX &&
      new Set(cols).size === cols.length &&
      cols.every((id) => typeof id === 'string' && AXIS_ID.test(id))
    )
  )
    return false;
  const { r1, c1, r2, c2, ...more } = range as Record<string, unknown>;
  return (
    Object.keys(more).length === 0 &&
    [r1, c1, r2, c2].every((id) => typeof id === 'string' && AXIS_ID.test(id))
  );
}

// Where a chart sits in its Sheet (docs/specs/029-sheets/sheet.md "Charts"): the px from the top-left corner of the
// sheet's cells (A1's corner, at 100% zoom) to the chart's top-left. Its size is the element's own width and height.
export type SheetAnchor = { x: number; y: number };

// The farthest a chart sits into its sheet, either way: well past the widest sheet the engine allows.
export const SHEET_ANCHOR_MAX = 1_000_000;

export function isSheetAnchor(v: unknown): v is SheetAnchor {
  if (typeof v !== 'object' || v === null) return false;
  const { x, y, ...rest } = v as { x?: unknown; y?: unknown };
  return (
    Object.keys(rest).length === 0 &&
    [x, y].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= SHEET_ANCHOR_MAX,
    )
  );
}

type AnchorFields = {
  id: string;
  type: string;
  shape?: string;
  chartSource?: ChartSource;
  sheetAnchor?: SheetAnchor;
  planSheet?: { sheetId: string };
};

// A chart that sits in a Sheet: one with both a source and an anchor (its Sheet may still be missing from the tab).
export function isSheetAnchoredChart(el: AnchorFields): boolean {
  return el.type === 'shape' && !!el.chartSource && !!el.sheetAnchor;
}

// The charts on a tab that its Sheets draw, by id: anchored charts whose Sheet is on the same tab. The canvas draws
// none of these; an anchored chart whose Sheet is not there draws on the canvas at its own place.
export function sheetDrawnChartIds(elements: readonly AnchorFields[]): ReadonlySet<string> {
  const anchored = elements.filter(isSheetAnchoredChart);
  if (anchored.length === 0) return EMPTY_IDS;
  const sheets = new Set<string>();
  for (const el of elements)
    if (el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet)
      sheets.add(el.planSheet.sheetId);
  const out = new Set<string>();
  for (const el of anchored) if (sheets.has(el.chartSource!.sheetId)) out.add(el.id);
  return out.size ? out : EMPTY_IDS;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

// The charts a Sheet of `sheetId` draws over its cells, in paint order.
export function chartsInSheet<E extends AnchorFields>(
  elements: readonly E[],
  sheetId: string,
): E[] {
  return elements.filter((el) => isSheetAnchoredChart(el) && el.chartSource!.sheetId === sheetId);
}

type ChartFields = {
  shape: string;
  pieSlices?: PieSlice[];
  lineSeries?: LineSeries[];
};

// The data fields a table gives a chart, keeping the colours its slices or series already carry (by position).
// A pie or bar chart reads the first series (a pie never below zero); a line chart reads them all.
export function chartFieldsFromTable(
  el: ChartFields,
  t: ChartTable,
): { pieSlices: PieSlice[] } | { lineCategories: string[]; lineSeries: LineSeries[] } {
  if (el.shape === 'line-chart')
    return {
      lineCategories: t.categories,
      lineSeries: t.series.map((s, i) => {
        const color = el.lineSeries?.[i]?.color;
        return { name: s.name, values: s.values, ...(color ? { color } : {}) };
      }),
    };
  const first = t.series[0]?.values ?? [];
  return {
    pieSlices: t.categories.map((label, i) => {
      const color = el.pieSlices?.[i]?.color;
      const v = first[i] ?? 0;
      return {
        label,
        value: el.shape === 'pie-chart' ? Math.max(0, v) : v,
        ...(color ? { color } : {}),
      };
    }),
  };
}

// Copies made together (a duplicate, a paste, a duplicated tab): a chart copied with the Sheet it reads reads the
// Sheet's copy. `sheets` maps each copied Sheet's sheet id to its copy's; a chart of a Sheet left behind keeps
// reading the original.
export function relinkCopiedCharts<E extends object>(
  copies: E[],
  sheets: ReadonlyMap<string, string>,
): E[] {
  if (sheets.size === 0) return copies;
  return copies.map((el) => {
    const source = (el as { chartSource?: ChartSource }).chartSource;
    const to = source && sheets.get(source.sheetId);
    return to ? { ...el, chartSource: { ...source, sheetId: to } } : el;
  });
}

// The sheet id a copy of a Sheet element takes, against the original's (for relinkCopiedCharts).
export function copiedSheetId(
  original: { type: string; shape?: string; planSheet?: { sheetId: string } },
  copy: { planSheet?: { sheetId: string } },
): [string, string] | null {
  const from =
    original.type === 'shape' && original.shape === 'plan-sheet'
      ? original.planSheet?.sheetId
      : undefined;
  const to = copy.planSheet?.sheetId;
  return from && to && from !== to ? [from, to] : null;
}
