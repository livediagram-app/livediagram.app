// Charts made from a sheet's cells (docs/specs/029-sheets/sheet.md "Charts"): Insert Chart turns the selection (or,
// for one cell, the block of data it sits in) into a pie, bar or line chart element linked to that range, placed
// floating over the Sheet's top right. It moves with the Sheet while it sits on it; dragged onto the canvas, it stays
// there, still live.
import { CHART_SOURCE_COLS_MAX, createShape, type ShapeElement } from '@livediagram/document';
import {
  regionAround,
  type GridRange,
  type IdRange,
  type Sheet,
  type Workbook,
} from '@livediagram/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { track } from '@/lib/telemetry';

export type SheetChartKind = 'bar-chart' | 'line-chart' | 'pie-chart';

export const NOTHING_TO_CHART = 'Select the cells to chart first';

// The chart sits this far in from the Sheet's right edge, and below its header, toolbar and formula bar.
const INSET_PX = 24;
const TOP_PX = 120;

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

// Place a chart of `kind` reading `range`, over the Sheet element's top right (at its left edge when the Sheet is
// narrower than the chart).
export function placeSheetChart(
  bridge: SheetsBridge,
  sheetEl: ShapeElement,
  sheetId: string,
  kind: SheetChartKind,
  pick: ChartPick,
): void {
  const probe = createShape(kind, 0, 0);
  const x = Math.max(
    sheetEl.x + probe.width / 2,
    sheetEl.x + sheetEl.width - INSET_PX - probe.width / 2,
  );
  const y = sheetEl.y + Math.min(TOP_PX + probe.height / 2, sheetEl.height / 2);
  bridge.placeElement({ x, y }, (cx, cy) => ({
    ...createShape(kind, cx, cy),
    chartSource: { sheetId, range: pick.range, ...(pick.cols ? { cols: pick.cols } : {}) },
  }));
  track('Sheet', 'Created', 'Chart');
}
