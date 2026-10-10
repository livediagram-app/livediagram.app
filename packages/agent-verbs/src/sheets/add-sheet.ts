// Putting a new Sheet on a tab for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP add_sheet and
// `sheet add`): the sheet is made in the store first (a title unique on the tab, optionally filled from rows or CSV
// text read as typed from A1), then a Sheet element framing it is placed beside what the tab holds, as add_board
// places a board, in one changeset (live to anyone with the tab open). The first cells are checked against the
// store's caps before the sheet is made, and a sheet whose filling or placing then fails is deleted, so a failed
// call leaves no unplaced sheet holding cells of the document's budget and a retry starts clean.
import { ApiError, type ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type DocumentResponse,
  type SheetCreateRequest,
  type SheetResponse,
  type TabResponse,
} from '@livediagram/api-schema';
import { createShape } from '@livediagram/document';
import { placeBeside } from '@livediagram/items';
import {
  AGENT_LOCALE,
  documentCellCount,
  emptyLayout,
  emptySheet,
  makeSheetId,
  nextSheetTitle,
  parseCsv,
  sheetFromJson,
  splitWrite,
  uniqueSheetTitle,
  Workbook,
  writeRows,
  type AgentValue,
  type Rand,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { apiRefusalOf } from '../plan/api-refusal';
import { tabPath } from '../verbs/shared';
import { capsRefusal, sendSheetWrite } from './change-sheet';
import { readSheets, sheetsPath, type SheetRefusal } from './sheet-state';

export interface AddSheetInput {
  tabId?: string;
  title?: string;
  // The first cells, from A1: rows of values, or CSV text (a tab-separated first line reads as TSV).
  rows?: AgentValue[][];
  csv?: string;
}

export type AddSheetResult =
  | {
      ok: true;
      tabId: string;
      sheetId: string;
      elementId: string;
      title: string;
      // The cells filled, in A1; null for a blank sheet.
      filled: string | null;
      truncated: boolean;
      changesetId: string | null;
      rev: number | null;
    }
  | SheetRefusal;

// The first cells as a write against the new sheet, read as typed in the agents' locale.
function firstCells(
  input: AddSheetInput,
  tabSheets: readonly Sheet[],
  blank: Sheet,
  rand: Rand,
): { write: SheetWrite | null; filled: string | null; truncated: boolean } | SheetRefusal {
  const parsed = input.csv !== undefined ? parseCsv(input.csv) : null;
  const rows: AgentValue[][] | undefined = parsed?.rows ?? input.rows;
  if (!rows?.length || rows.every((r) => r.length === 0))
    return { write: null, filled: null, truncated: !!parsed?.truncated };
  const wb = new Workbook({ sheets: [...tabSheets, blank], locale: AGENT_LOCALE });
  const made = writeRows(wb, blank.id, 'A1', rows, rand);
  // The blank sheet is in the workbook and A1 is a cell, so only a formula can be refused.
  if (!made.ok)
    return {
      ok: false,
      code: 'formula_invalid',
      message: `The formula in ${made.at} cannot be read: ${made.why}.`,
    };
  return {
    write: made.write,
    filled: made.range,
    truncated: made.truncated || !!parsed?.truncated,
  };
}

export async function addSheet(
  api: ApiClient,
  documentId: string,
  input: AddSheetInput,
  client: 'mcp' | 'cli',
  rand: Rand = Math.random,
): Promise<AddSheetResult> {
  try {
    const { document } = await api.json<DocumentResponse>(
      `/documents/${encodeURIComponent(documentId)}`,
    );
    const tabs = [...document.tabs].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    // The tab named, else the first tab holding a sheet, else the first tab.
    const all = input.tabId ? null : await readSheets(api, documentId);
    const tabId =
      input.tabId ?? tabs.find((t) => all?.some((s) => s.tabId === t.id))?.id ?? tabs[0]?.id;
    if (!tabId) return { ok: false, code: 'tab_not_found', message: 'That document has no tabs.' };
    if (!tabs.some((t) => t.id === tabId))
      return {
        ok: false,
        code: 'tab_not_found',
        message: `No tab "${tabId}". Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
      };
    const onTab = (all ?? (await readSheets(api, documentId, tabId))).filter(
      (s) => s.tabId === tabId,
    );
    const taken = onTab.map((s) => s.title);
    const title = input.title?.trim()
      ? uniqueSheetTitle(input.title, taken)
      : nextSheetTitle(taken);
    const layout = emptyLayout(rand);
    const blank = emptySheet({ id: makeSheetId(rand), tabId, title, layout });
    const first = firstCells(input, onTab.map(sheetFromJson), blank, rand);
    if ('ok' in first) return first;
    if (first.write) {
      const cells = documentCellCount(all ?? (await readSheets(api, documentId)));
      const over = capsRefusal(blank, [first.write], cells);
      if (over) return { ok: false, ...over };
    }

    // The sheet, blank, then its first cells as the editor fills a dropped CSV: one write a call, split when large.
    const create: SheetCreateRequest = { id: blank.id, tabId, title, layout };
    const { sheet: made } = await api.json<SheetResponse>(sheetsPath(documentId), {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(create),
    });
    return await fillAndPlace(api, documentId, tabId, sheetFromJson(made), first, client);
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}

// A sheet made by a call that then failed: nothing frames it, so it is deleted rather than left holding cells.
async function deleteUnplaced(api: ApiClient, documentId: string, sheetId: string): Promise<void> {
  try {
    const res = await api.fetch(`${sheetsPath(documentId)}/${encodeURIComponent(sheetId)}`, {
      method: 'DELETE',
    });
    console.info('[sheets] add_sheet failed; unplaced sheet deleted', { status: res.status });
  } catch {
    console.warn('[sheets] add_sheet failed; unplaced sheet not deleted');
  }
}

// Fills the made sheet with its first cells, then places its element. A failure deletes the sheet, except a
// placing request that never answered: its element may have landed, and a frame with no sheet is worse.
async function fillAndPlace(
  api: ApiClient,
  documentId: string,
  tabId: string,
  made: Sheet,
  first: { write: SheetWrite | null; filled: string | null; truncated: boolean },
  client: 'mcp' | 'cli',
): Promise<AddSheetResult> {
  let sheet = made;
  try {
    for (const part of first.write ? splitWrite(first.write) : [])
      sheet = await sendSheetWrite(api, documentId, sheet, part, client);
  } catch (err) {
    await deleteUnplaced(api, documentId, made.id);
    throw err;
  }
  const { tab } = await api.json<TabResponse>(tabPath(documentId, tabId));
  const { x, y } = placeBeside(tab.elements);
  const element = { ...createShape('plan-sheet', x, y), planSheet: { sheetId: sheet.id } };
  const body: ChangesetRequest = {
    operations: [{ op: 'add', element }],
    base: { rev: tab.rev, elements: {} },
    summary: `Add the ${sheet.title} sheet`,
  };
  let answer: ChangesetResponse;
  try {
    answer = await api.json<ChangesetResponse>(`${tabPath(documentId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError) await deleteUnplaced(api, documentId, made.id);
    throw err;
  }
  return {
    ok: true,
    tabId,
    sheetId: sheet.id,
    elementId: element.id,
    title: sheet.title,
    filled: first.filled,
    truncated: first.truncated,
    changesetId: answer.changeset?.id ?? null,
    rev: answer.changeset?.rev ?? null,
  };
}
