// Changing a sheet for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP change_sheet and the CLI's sheet
// verbs): changes in order, each built against the sheet as the ones before it left it, and sent through the api's
// write route as the editor sends them (one write a call, a large one split, each with its own write id). The
// api answers with the write as it landed, which is applied here so the next change reads what is stored. A refused
// change stops the rest and says which went through.
import type { ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type SheetWriteRequest,
  type SheetWriteResponse,
} from '@livediagram/api-schema';
import {
  applySheetWrite,
  NOBODY,
  splitWrite,
  type Rand,
  type Sheet,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import { apiRefusalOf } from '../plan/api-refusal';
import { buildSheetChange, type SheetChange } from './sheet-change-build';
import { readSheets, resolveSheet, sheetWritesPath, workbookFor } from './sheet-state';

export interface SheetChangesResult {
  sheetId: string;
  title: string;
  applied: string[];
  rev: number | null;
  refusal?: { code: string; message: string };
}

// One write through the api, and the sheet after it as stored.
export async function sendSheetWrite(
  api: ApiClient,
  documentId: string,
  sheet: Sheet,
  write: SheetWrite,
  client: 'mcp' | 'cli',
): Promise<Sheet> {
  const body: SheetWriteRequest = { write, wid: crypto.randomUUID() };
  const answer = await api.json<SheetWriteResponse>(sheetWritesPath(documentId, sheet.id), {
    method: 'POST',
    headers: { [CLIENT_HEADER]: client },
    body: JSON.stringify(body),
  });
  const landed = applySheetWrite(sheet, answer.applied, { now: Date.now(), by: NOBODY });
  return { ...landed.sheet, rev: answer.rev };
}

// Builds and sends each change in turn against the workbook, which follows every landed write.
export async function applySheetChanges(
  api: ApiClient,
  documentId: string,
  wb: Workbook,
  sheetId: string,
  changes: readonly SheetChange[],
  client: 'mcp' | 'cli',
  rand: Rand = Math.random,
): Promise<Omit<SheetChangesResult, 'sheetId' | 'title'>> {
  const applied: string[] = [];
  let rev: number | null = null;
  for (const change of changes) {
    const sheet = wb.sheet(sheetId)!;
    const others = wb
      .sheetList()
      .filter((s) => s.id !== sheetId)
      .map((s) => s.title);
    const built = buildSheetChange(wb, sheetId, change, others, rand);
    if (!built.ok) return { applied, rev, refusal: { code: built.code, message: built.message } };
    let next = sheet;
    try {
      for (const write of built.writes)
        for (const part of splitWrite(write))
          next = await sendSheetWrite(api, documentId, next, part, client);
    } catch (err) {
      const refusal = apiRefusalOf(err);
      if (!refusal) throw err;
      return { applied, rev, refusal };
    }
    if (next !== sheet) {
      wb.updateSheet(next);
      rev = next.rev;
    }
    applied.push(built.line);
  }
  return { applied, rev };
}

export async function changeSheet(
  api: ApiClient,
  documentId: string,
  input: { sheet: string; changes: readonly SheetChange[] },
  client: 'mcp' | 'cli',
): Promise<SheetChangesResult> {
  const sheets = await readSheets(api, documentId);
  const found = resolveSheet(sheets, input.sheet);
  if (!found.ok) {
    const { code, message } = found;
    return { sheetId: '', title: input.sheet, applied: [], rev: null, refusal: { code, message } };
  }
  const { id, tabId } = found.sheet;
  const wb = await workbookFor(api, documentId, sheets, tabId);
  const result = await applySheetChanges(api, documentId, wb, id, input.changes, client);
  return { sheetId: id, title: wb.sheet(id)!.title, ...result };
}
