// A response as a Sheet row (docs/specs/030-forms/forms.md "Responses to a Sheet"): the sheet's header row and the rows
// in use read, the row planned by @livepages/forms (responseRowWrite), and stored through the sheet store's own
// checks, caps and relay (storeSheetWrite), unchecked against the sheet's validation rules so a response always lands.
import type { AnswerValue, FormSheetDestination } from '@livepages/forms';
import { responseRowWrite, type FormDefinition } from '@livepages/forms';
import { cellKey, type SheetPerson } from '@livepages/sheets';
import { documentLinksTab, readCells, readSheetHead, usedSheetRows } from '../db';
import type { RouteContext } from '../routes/context';
import { storeSheetWrite } from '../routes/sheet-write-route';
import { sheetOnItsTab } from './form-tab';

type SheetRowOutcome = 'written' | 'missing' | 'full' | 'busy';

// Whether the sheet a form sends its responses to is still there, on its tab in the document (form-tab.ts).
export async function sheetThere(
  ctx: RouteContext,
  documentId: string,
  sheet: FormSheetDestination,
): Promise<boolean> {
  return sheetOnItsTab(ctx.env, documentId, sheet);
}

export async function writeResponseRow(
  ctx: RouteContext,
  input: {
    documentId: string;
    sheet: FormSheetDestination;
    form: Pick<FormDefinition, 'sections'>;
    answers: ReadonlyMap<string, AnswerValue>;
    number: number | null;
    preview: boolean;
    by: SheetPerson;
  },
): Promise<SheetRowOutcome> {
  const { env } = ctx;
  const { documentId, sheet } = input;
  const head = await readSheetHead(env, documentId, sheet.sheetId);
  if (!head || head.tabId !== sheet.tabId) return 'missing';
  if (!(await documentLinksTab(env, documentId, sheet.tabId))) return 'missing';
  const headerRow = head.layout.rows[0];
  const headerCells = headerRow
    ? await readCells(
        env,
        documentId,
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
    usedRows: await usedSheetRows(env, documentId, sheet.sheetId),
  });
  const res = await storeSheetWrite(
    ctx,
    documentId,
    sheet.sheetId,
    { write, unchecked: true },
    input.by,
    null,
  );
  if (res.ok) return 'written';
  console.warn('[forms] form.sheet.unwritten', { documentId, status: res.status });
  return res.status === 413 ? 'full' : 'busy';
}
