// Charts made from a sheet's cells (docs/specs/029-sheets/sheet.md "Charts"): Insert Chart turns the selection (or,
// for one cell, the block of data it sits in) into a chart element of any chart type linked to that range, sitting in
// the Sheet at an anchor over its cells (beside the range, inside the cells in view), drawn by the Sheet and selected
// there. Its own canvas place is over the Sheet's top right, for what does not draw the grid (exports, agents).
import {
  CHART_SOURCE_COLS_MAX,
  chartShapeOf,
  chartsInSheet,
  type ChartType,
  createShape,
  type Element,
  SHEET_ANCHOR_MAX,
  type ChartPaletteId,
  type SheetAnchor,
  type ShapeElement,
} from '@liveplanner/document';
import {
  posRangeOf,
  regionAround,
  type GridRange,
  type IdRange,
  type Sheet,
  type Workbook,
} from '@liveplanner/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import { track } from '@/lib/telemetry';
import type { Geometry } from './sheet-geometry';

export const NOTHING_TO_CHART = 'Select the cells to chart first';

// The chart sits this far in from the Sheet's right edge, and below its header, toolbar and formula bar (its canvas
// place); and this far right of the charted range, and in from the edges of the cells in view (its anchor).
const INSET_PX = 24;
const TOP_PX = 120;
export const CHART_GAP_PX = 24;

// The id range a chart reads: the selection, or for one cell the data around it; null for one empty cell alone.
// What a chart reads from the selection: a range, and only some of its columns when several ranges were picked.
export type ChartPick = { range: IdRange; cols?: string[] };

export function chartRangeOf(
  wb: Workbook,
  sheet: Sheet,
  sel: { ranges: readonly GridRange[]; active: { r: number; c: number } },
): ChartPick | null {
  // Several ranges picked together chart as one (sheet.md "Charts"): the rows they span, and only their columns.
  if (sel.ranges.length > 1) return chartRangesOf(sheet, sel.ranges);
  const last = sel.ranges[sel.ranges.length - 1];
  const one = !last || (last.r1 === last.r2 && last.c1 === last.c2);
  const g = one ? regionAround(wb, sheet.id, sel.active) : last;
  if (g.r1 === g.r2 && g.c1 === g.c2 && wb.value(sheet.id, g.r1, g.c1) === null) return null;
  const { rows, cols } = sheet.layout;
  const r2 = Math.min(g.r2, rows.length - 1);
  const c2 = Math.min(g.c2, cols.length - 1);
  return { range: { r1: rows[g.r1]!, c1: cols[g.c1]!, r2: rows[r2]!, c2: cols[c2]! } };
}

// Several ranges as one chart: the box round them, and the columns any of them covers (all of them, then no `cols`).
function chartRangesOf(sheet: Sheet, ranges: readonly GridRange[]): ChartPick {
  const { rows, cols } = sheet.layout;
  const r1 = Math.min(...ranges.map((g) => g.r1));
  const c1 = Math.min(...ranges.map((g) => g.c1));
  const r2 = Math.min(Math.max(...ranges.map((g) => g.r2)), rows.length - 1);
  const c2 = Math.min(Math.max(...ranges.map((g) => g.c2)), cols.length - 1);
  const picked: string[] = [];
  for (let c = c1; c <= c2; c++)
    if (ranges.some((g) => g.c1 <= c && c <= g.c2)) picked.push(cols[c]!);
  const range = { r1: rows[r1]!, c1: cols[c1]!, r2: rows[r2]!, c2: cols[c2]! };
  // As many as a chart reads (its series and a label column), so the source stays valid.
  return picked.length === c2 - c1 + 1
    ? { range }
    : { range, cols: picked.slice(0, CHART_SOURCE_COLS_MAX) };
}

// Where a new chart sits in its Sheet: right of the charted range, level with its top row, pulled back inside the
// cells in view (`view` their size, `scroll` how far they are scrolled) when it would leave them.
export function newChartAnchor(
  g: Pick<Geometry, 'rows' | 'cols'>,
  sheet: Sheet,
  pick: ChartPick,
  size: { width: number; height: number },
  scroll: { top: number; left: number },
  view: { width: number; height: number },
): SheetAnchor {
  const at = posRangeOf(sheet.layout, pick.range);
  const right = at ? (g.cols[at.c2 + 1] ?? 0) + CHART_GAP_PX : scroll.left + CHART_GAP_PX;
  const top = at ? (g.rows[at.r1] ?? 0) : scroll.top + CHART_GAP_PX;
  const fit = (p: number, from: number, room: number, length: number) => {
    const lo = from + CHART_GAP_PX;
    const hi = Math.max(lo, from + room - length - CHART_GAP_PX);
    return Math.round(Math.min(SHEET_ANCHOR_MAX, Math.max(0, Math.min(hi, Math.max(lo, p)))));
  };
  return {
    x: fit(right, scroll.left, view.width, size.width),
    y: fit(top, scroll.top, view.height, size.height),
  };
}

// The size a new chart of `type` takes (its kind's).
export function chartSizeOf(type: ChartType): { width: number; height: number } {
  const probe = createShape(chartShapeOf(type).shape, 0, 0);
  return { width: probe.width, height: probe.height };
}

// The chart this person placed last, for its Sheet to select once it draws it (SheetChartsLayer).
let placedChartId: string | null = null;
export function takePlacedChart(id: string): boolean {
  if (placedChartId !== id) return false;
  placedChartId = null;
  return true;
}

// How a chart is placed: its own size (a template's), and whether it is a template's (not selected, not counted as
// Insert Chart).
export type PlaceChartOpts = {
  size?: { width: number; height: number };
  palette?: ChartPaletteId;
  template?: true;
};

// Place a chart of `type` reading `range` in the Sheet at `anchor`; on the canvas, over the Sheet element's top right
// (at its left edge when the Sheet is narrower than the chart). One undo step; not selected on the canvas.
export function placeSheetChart(
  bridge: SheetsBridge,
  sheetEl: ShapeElement,
  sheetId: string,
  type: ChartType,
  pick: ChartPick,
  anchor: SheetAnchor,
  opts: PlaceChartOpts = {},
): void {
  const { shape, chartVariant } = chartShapeOf(type);
  const probe = { ...createShape(shape, 0, 0), ...(opts.size ?? {}) };
  const x = Math.max(
    sheetEl.x + probe.width / 2,
    sheetEl.x + sheetEl.width - INSET_PX - probe.width / 2,
  );
  const y = sheetEl.y + Math.min(TOP_PX + probe.height / 2, sheetEl.height / 2);
  bridge.placeElement(
    { x, y },
    (cx, cy) => {
      const el: ShapeElement = {
        ...createShape(shape, cx, cy),
        ...(chartVariant ? { chartVariant } : {}),
        ...(opts.size ?? {}),
        ...(opts.palette ? { chartPalette: opts.palette } : {}),
        chartSource: { sheetId, range: pick.range, ...(pick.cols ? { cols: pick.cols } : {}) },
        sheetAnchor: anchor,
      };
      if (!opts.template) placedChartId = el.id;
      return el;
    },
    { select: false },
  );
  if (!opts.template) track('Sheet', 'Created', 'Chart');
}

// The smallest a chart in a Sheet is resized to (sheet.md "Charts").
export const CHART_MIN_WIDTH = 160;
export const CHART_MIN_HEIGHT = 120;

// A chart dragged by (dx, dy) sheet px: never past the cells' top-left corner, nor the anchor's bounds.
export function movedAnchor(anchor: SheetAnchor, dx: number, dy: number): SheetAnchor {
  const clamp = (v: number) => Math.round(Math.min(SHEET_ANCHOR_MAX, Math.max(0, v)));
  return { x: clamp(anchor.x + dx), y: clamp(anchor.y + dy) };
}

// A chart's corner dragged by (dx, dy) sheet px: never below the smallest chart.
export function resizedChart(
  size: { width: number; height: number },
  dx: number,
  dy: number,
): { width: number; height: number } {
  return {
    width: Math.round(Math.max(CHART_MIN_WIDTH, size.width + dx)),
    height: Math.round(Math.max(CHART_MIN_HEIGHT, size.height + dy)),
  };
}

// Taking the charts anchored in sheet `sheetId` off the open tab, as a step (Clear Sheet, sheet.md "Sheet Settings"):
// `redo` takes them and `undo` puts them back, each quietly (the sheet's own write carries the one undo step). Null
// when it has none.
export function sheetChartsRemoval(
  bridge: Pick<SheetsBridge, 'tickElements'>,
  elements: readonly Element[],
  sheetId: string,
): ItemUndoStep | null {
  const charts = chartsInSheet(elements, sheetId);
  if (charts.length === 0) return null;
  const ids = new Set(charts.map((el) => el.id));
  return {
    redo: () => bridge.tickElements((els) => els.filter((el) => !ids.has(el.id))),
    undo: () =>
      bridge.tickElements((els) => {
        const there = new Set(els.map((el) => el.id));
        const back = charts.filter((el) => !there.has(el.id));
        return back.length ? [...els, ...back] : els;
      }),
  };
}
