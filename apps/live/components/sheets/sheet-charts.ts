// Charts made from a sheet's cells (docs/specs/029-sheets/sheet.md "Charts"): Insert Chart turns the selection (or,
// for one cell, the block of data it sits in) into a pie, bar or line chart element linked to that range, placed
// floating over the Sheet's top right. It moves with the Sheet while it sits on it; dragged onto the canvas, it stays
// there, still live.
import { createShape, type ShapeElement } from '@livediagram/document';
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
export function chartRangeOf(
  wb: Workbook,
  sheet: Sheet,
  sel: { ranges: readonly GridRange[]; active: { r: number; c: number } },
): IdRange | null {
  // The last range picked, as the toolbar and the formula bar read it.
  const last = sel.ranges[sel.ranges.length - 1];
  const one = !last || (last.r1 === last.r2 && last.c1 === last.c2);
  const g = one ? regionAround(wb, sheet.id, sel.active) : last;
  if (g.r1 === g.r2 && g.c1 === g.c2 && wb.value(sheet.id, g.r1, g.c1) === null) return null;
  const { rows, cols } = sheet.layout;
  const r2 = Math.min(g.r2, rows.length - 1);
  const c2 = Math.min(g.c2, cols.length - 1);
  return { r1: rows[g.r1]!, c1: cols[g.c1]!, r2: rows[r2]!, c2: cols[c2]! };
}

// Place a chart of `kind` reading `range`, over the Sheet element's top right (at its left edge when the Sheet is
// narrower than the chart).
export function placeSheetChart(
  bridge: SheetsBridge,
  sheetEl: ShapeElement,
  sheetId: string,
  kind: SheetChartKind,
  range: IdRange,
): void {
  const probe = createShape(kind, 0, 0);
  const x = Math.max(
    sheetEl.x + probe.width / 2,
    sheetEl.x + sheetEl.width - INSET_PX - probe.width / 2,
  );
  const y = sheetEl.y + Math.min(TOP_PX + probe.height / 2, sheetEl.height / 2);
  bridge.placeElement({ x, y }, (cx, cy) => ({
    ...createShape(kind, cx, cy),
    chartSource: { sheetId, range },
  }));
  track('Sheet', 'Created', 'Chart');
}
