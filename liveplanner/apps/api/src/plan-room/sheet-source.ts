// A plan's Sheets as a source for a chart in another app (liveworkspace/docs/specs/004-index/sheet-sources.md "The
// door", docs/specs/015-api/api.md "Sheet sources"): the plan's Sheets for a picker, and one range of one, read as a
// chart reads it. Runs in the plan's room, where the Sheets are. Reads only the asked range: its categories and series
// under the chart caps, never a cell outside it, a formula's text, a format or a comment.
import {
  formatRange,
  idRangeOf,
  parseRangeText,
  posRangeOf,
  sheetChartTable,
  sheetFromJson,
  Workbook,
  type IdRange,
} from '@liveplanner/sheets';
import type { SheetListResult, SheetRangeResult } from '@liveworkspace/index-app';
import type { SheetRangeAsk } from '@liveworkspace/index-client';
import { listSheets } from '../db/sheets';
import type { PlanEnv } from '../types';
import { readPlanHead } from './plan-content';
import { EXPORT_LOCALE, sheetWorkbook } from './plan-export';

// A sheet's filled extent as A1 text: the range a picker offers first (`A1` for an empty sheet).
const extentA1 = ({ rows, cols }: { rows: number; cols: number }) =>
  formatRange({ r1: 0, c1: 0, r2: Math.max(0, rows - 1), c2: Math.max(0, cols - 1) });

export async function listPlanSheets(env: PlanEnv, planId: string): Promise<SheetListResult> {
  const { meta } = await readPlanHead(env, planId);
  if (!meta) return { status: 'not_found' };
  const sheets = (await listSheets(env, planId)).map(sheetFromJson);
  // Only the extents are asked of it: nothing is worked out.
  const wb = new Workbook({ sheets, locale: EXPORT_LOCALE });
  return {
    status: 'ok',
    sheets: sheets.map((s) => ({
      id: s.id,
      name: s.title,
      tabId: s.tabId,
      a1: extentA1(wb.extent(s.id)),
    })),
  };
}

export async function readPlanSheetRange(
  env: PlanEnv,
  planId: string,
  ask: SheetRangeAsk,
): Promise<SheetRangeResult> {
  const found = await sheetWorkbook(env, planId, ask.sheetId);
  if (found === null || found === 'no_sheet') return { status: 'not_found' };
  const { wb, sheet } = found;
  let range: IdRange | null;
  if (ask.range) {
    range = ask.range;
  } else {
    // An A1 range typed in a picker, turned into the ids it names now (clamped to the grid).
    const grid = parseRangeText(ask.a1!);
    if (!grid) return { status: 'invalid_range' };
    range = idRangeOf(sheet.layout, grid.r1, grid.c1, grid.r2, grid.c2);
  }
  const at = range ? posRangeOf(sheet.layout, range) : null;
  if (!range || !at) return { status: 'range_gone' };
  const table = sheetChartTable(
    wb,
    { sheetId: sheet.id, range, ...(ask.cols ? { cols: ask.cols } : {}) },
    EXPORT_LOCALE,
  )!;
  return {
    status: 'ok',
    read: { sheetName: sheet.title, tabId: sheet.tabId, range, a1: formatRange(at), table },
  };
}
