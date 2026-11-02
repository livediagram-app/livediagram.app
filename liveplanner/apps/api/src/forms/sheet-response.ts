// A response as a Sheet row (docs/specs/030-forms/forms.md "Responses to a Sheet"): the sheet's header row and the rows
// holding a value read, the row planned by @liveplanner/forms (responseRowWrite, on the form's remembered columns),
// and stored through the sheet store's own checks, caps and relay (storeSheetWrite) at the rev it was planned on,
// unchecked against the sheet's validation rules so a response always lands. 'written' only when every cell did.
import type { AnswerValue, FormSheetDestination } from '@liveplanner/forms';
import { responseRowWrite, type FormDefinition } from '@liveplanner/forms';
import type { SheetWriteResponse } from '@liveplanner/api-schema';
import { cellKey, type SheetPerson, type SheetWrite } from '@liveplanner/sheets';
import { planHasTab, readCells, readSheetHead, usedSheetRows } from '../db';
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
    form: Pick<FormDefinition, 'sections'>;
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
    const headerRow = head.layout.rows[0];
    const headerCells = headerRow
      ? await readCells(
          env,
          projectId,
          sheet.sheetId,
          head.layout.cols.map((c) => cellKey(headerRow, c)),
        )
      : [];
    const header = new Map<string, string>();
    for (const cell of headerCells) {
      const i = cell.i as { s?: unknown } | undefined;
      if (i && typeof i.s === 'string') header.set(cell.c, i.s);
    }
    const write = responseRowWrite({
      form: input.form,
      answers: input.answers,
      number: input.number,
      preview: input.preview,
      at: Date.now(),
      layout: head.layout,
      header,
      usedRows: await usedSheetRows(env, projectId, sheet.sheetId),
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

const cellsOf = (w: SheetWrite) => (w.kind === 'title' ? [] : (w.cells ?? []));

async function sheetErrorOf(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : null;
}
