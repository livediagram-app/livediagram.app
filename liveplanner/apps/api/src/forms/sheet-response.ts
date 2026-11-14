// A response as a Sheet row (docs/specs/030-forms/forms.md "Responses to a Sheet"): the sheet's top rows' text (where the header row is found) and the last row
// holding a value read, the row planned by @liveplanner/forms (responseRowWrite, on the form's remembered columns),
// and stored through the sheet store's own checks, caps and relay (storeSheetWrite) at the rev it was planned on,
// unchecked against the sheet's validation rules so a response always lands. 'written' only when every cell did.
import type { AnswerValue, FormSheetDestination } from '@liveplanner/forms';
import {
  HEADER_SCAN_ROWS,
  TABLE_GAP_ROWS,
  headerRowIndex,
  isTotalRow,
  responseRowWrite,
  type FormDefinition,
  type SheetTable,
} from '@liveplanner/forms';
import type { SheetWriteResponse } from '@liveplanner/api-schema';
import type { SheetPerson, SheetWrite } from '@liveplanner/sheets';
import {
  lastUsedSheetRow,
  planHasTab,
  readRowInputs,
  readRowTexts,
  readSheetHead,
  usedSheetRows,
} from '../db';
import type { PlanEnv } from '../types';
import type { PlanRouteContext } from '../routes/context';
import { SHEET_WRITE_RETRIES } from '../routes/sheet-route-kit';
import { storeSheetWrite } from '../routes/sheet-write-route';
import { sheetOnItsTab } from './form-tab';

type SheetRowOutcome = 'written' | 'missing' | 'full' | 'busy';

// Whether the sheet a form sends its responses to is still there, on its tab in the project (form-tab.ts).
export async function sheetThere(
  ctx: PlanRouteContext,
  projectId: string,
  sheet: FormSheetDestination,
): Promise<boolean> {
  return sheetOnItsTab(ctx.env, projectId, sheet);
}

export async function writeResponseRow(
  ctx: PlanRouteContext,
  input: {
    projectId: string;
    sheet: FormSheetDestination;
    form: Pick<FormDefinition, 'sections' | 'sheet'>;
    answers: ReadonlyMap<string, AnswerValue>;
    number: number | null;
    preview: boolean;
    by: SheetPerson;
  },
): Promise<SheetRowOutcome> {
  const { env } = ctx;
  const { projectId, sheet } = input;
  if (!(await planHasTab(env, projectId, sheet.tabId))) return 'missing';
  // Planned against the sheet as stored and stored only at that rev; a sheet that moved on meanwhile is read and
  // planned again, so the row never lands on rows or columns that are no longer where the plan put them.
  for (let attempt = 0; attempt < SHEET_WRITE_RETRIES; attempt++) {
    const head = await readSheetHead(env, projectId, sheet.sheetId);
    if (!head || head.tabId !== sheet.tabId) return 'missing';
    // The header row is found among the top rows (a template's sit under its title): one indexed read of their text.
    const rowTexts = await readRowTexts(
      env,
      projectId,
      sheet.sheetId,
      head.layout.rows.slice(0, HEADER_SCAN_ROWS),
    );
    // Only the last row holding a value places the response (responseRowWrite), unless it is a table's total.
    const usedRows = await lastUsedSheetRow(env, projectId, sheet.sheetId, head.layout.rows);
    const write = responseRowWrite({
      form: input.form,
      answers: input.answers,
      number: input.number,
      preview: input.preview,
      at: Date.now(),
      layout: head.layout,
      rowTexts,
      usedRows,
      table: await tableOf(env, projectId, sheet.sheetId, {
        rows: head.layout.rows,
        head: headerRowIndex(input.form, head.layout.rows, rowTexts),
        last: [...usedRows][0],
      }),
      columns: sheet.columns,
    });
    const res = await storeSheetWrite(
      ctx,
      projectId,
      sheet.sheetId,
      { write, unchecked: true },
      input.by,
      null,
      { atRev: head.rev },
    );
    if (res.ok) {
      // Every planned cell landed, or the row is not there to see: say so rather than thank anyone for it.
      const stored = (await res.json()) as SheetWriteResponse;
      const planned = cellsOf(write).length;
      const landed = cellsOf(stored.applied).length;
      if (landed === planned) return 'written';
      console.error('[forms] form.sheet.dropped', { projectId, planned, landed });
      return 'busy';
    }
    if (res.status === 409 && (await sheetErrorOf(res)) === 'sheet_busy') continue;
    console.warn('[forms] form.sheet.unwritten', { projectId, status: res.status });
    return res.status === 413 ? 'full' : res.status === 404 ? 'missing' : 'busy';
  }
  console.warn('[forms] form.sheet.unwritten', { projectId, status: 409 });
  return 'busy';
}

// A template's table (forms.md "A template's table with a total"): when the last row holding a value sits under the
// header row and is a total, its inputs and the first empty row among the table's first TABLE_GAP_ROWS rows. Else
// undefined, and the response goes under the last value. Two indexed reads (three when a row is added, for the row
// above's formulas), only for a sheet whose last row has one.
async function tableOf(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  at: { rows: readonly string[]; head: number; last: string | undefined },
): Promise<SheetTable | undefined> {
  const total = at.last === undefined ? -1 : at.rows.indexOf(at.last);
  if (total <= at.head) return undefined;
  const totalInputs = await readRowInputs(env, projectId, sheetId, at.last!);
  if (!isTotalRow(totalInputs.values())) return undefined;
  const body = at.rows.slice(at.head + 1, Math.min(total, at.head + 1 + TABLE_GAP_ROWS));
  const used = await usedSheetRows(env, projectId, sheetId, body);
  const empty = body.find((r) => !used.has(r)) ?? null;
  // No empty row: a new one goes above the total, taking the per-row formulas of the row above it (one more read).
  const above = at.rows[total - 1]!;
  const aboveInputs =
    empty === null && total - 1 > at.head
      ? await readRowInputs(env, projectId, sheetId, above)
      : undefined;
  return { total: at.last!, totalInputs, empty, aboveInputs };
}

const cellsOf = (w: SheetWrite) => (w.kind === 'title' ? [] : (w.cells ?? []));

async function sheetErrorOf(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : null;
}
