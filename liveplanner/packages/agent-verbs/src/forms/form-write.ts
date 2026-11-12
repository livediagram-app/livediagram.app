// Writing a form's change (form-calls.ts): card types first, then the form (a new Form tab by a changeset, an
// existing form through its route), then the headers of the sheets its responses go to, each only once every change
// has been checked.

import type { ApiClient } from '@liveworkspace/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type ItemTypesRequest,
} from '@liveplanner/api-schema';
import { sheetHeaders, type FormDefinition } from '@liveplanner/forms';
import { ITEM_TYPE_CATALOGUE_VERSION } from '@liveplanner/items';
import { changeBoard } from '../plan/change-board';
import { isCardTypesStale, itemTypesPath } from '../plan/plan-state';
import { columnIndex, columnLetters } from '@liveplanner/sheets';
import { changeSheet } from '../sheets/change-sheet';
import { readSheet } from '../sheets/read-sheet';
import type { SheetChange } from '../sheets/sheet-change-build';
import { tabPath } from '../verbs/shared';
import { type FormDraft } from './form-draft';
import type { Client } from './form-calls';

// --- Writing ----------------------------------------------------------------------------------------------------

export async function postChangeset(
  api: ApiClient,
  projectId: string,
  tabId: string,
  body: ChangesetRequest,
  client: Client,
): Promise<ChangesetResponse> {
  return api.json<ChangesetResponse>(`${tabPath(projectId, tabId)}/changesets`, {
    method: 'POST',
    headers: { [CLIENT_HEADER]: client },
    body: JSON.stringify(body),
  });
}

// The card types as the draft left them, saved at the revision read. Another change landing first is a stale
// refusal: the caller builds again from a fresh read.
export async function saveTypes(api: ApiClient, d: FormDraft): Promise<'saved' | 'stale'> {
  if (!d.typesChanged) return 'saved';
  const body: ItemTypesRequest = {
    itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: d.types },
    expectedRev: d.world.itemTypesRev,
  };
  try {
    await api.json(itemTypesPath(d.world.projectId), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return 'saved';
  } catch (err) {
    if (isCardTypesStale(err)) return 'stale';
    throw err;
  }
}

// A sheet form's sheet holds a header for every question, as a response would leave it: the ones it lacks are
// written after its last header (bold), never over one, so the columns answers already fill keep their meaning. A new
// sheet also freezes its header row and takes its tab's name, so it reads as the form's before anyone answers.
async function syncSheetHeaders(
  api: ApiClient,
  d: FormDraft,
  sheetId: string,
  fresh: { title: string } | null,
  client: Client,
): Promise<void> {
  const read = fresh
    ? null
    : await readSheet(api, d.world.projectId, { sheet: sheetId, range: 'A1:ZZ1' });
  const cells = read && read.ok ? read.cells : [];
  const have = new Set(cells.map((c) => c.display.trim().toLowerCase()).filter(Boolean));
  const lastCol = cells.reduce((n, c) => Math.max(n, columnIndex(c.at.replace(/\d+$/, '')) + 1), 0);
  const missing = sheetHeaders(d.form)
    .map((h) => h.header)
    .filter((h) => !have.has(h.toLowerCase()));
  const changes: SheetChange[] = [];
  if (missing.length) {
    const from = columnLetters(lastCol);
    const to = columnLetters(lastCol + missing.length - 1);
    // As text: a set reads text as typed, so "2024" would be a number and "=Score" a formula, and a response
    // (which finds its column by a text header) would then add a second column. A leading ' keeps it text.
    changes.push({ op: 'set', at: `${from}1`, rows: [missing.map((h) => `'${h}`)] });
    changes.push({ op: 'format', range: `${from}1:${to}1`, format: { bold: true } });
    // Widths fitted to the headers, so a long question never runs over the column beside it.
    changes.push({ op: 'resize', cols: `${from}:${to}`, fit: true });
  }
  if (fresh) changes.push({ op: 'freeze', rows: 1 }, { op: 'rename', title: fresh.title });
  if (!changes.length) return;
  const done = await changeSheet(api, d.world.projectId, { sheet: sheetId, changes }, client);
  // The sheet engine answers a refusal rather than throwing: a miss all the same.
  if (done.refusal) throw new Error(done.refusal.message);
  if (missing.length && !fresh)
    d.lines.push(
      `added the sheet's column${missing.length === 1 ? '' : 's'} ${missing.map((m) => `"${m}"`).join(', ')}`,
    );
}

// The responses tabs a draft makes, after what the project holds (made already when a new project carried them),
// each new sheet given its headers; then the boards that now take the form's card type.
export async function writeAround(
  api: ApiClient,
  d: FormDraft,
  client: Client,
  tabsMade: boolean,
  // The form as it was read, when it was changed: its sheet is synced only when a header is new to it.
  before: FormDefinition | null = null,
): Promise<string[]> {
  const made: string[] = [];
  for (const tab of d.newTabs) {
    if (!tabsMade)
      await postChangeset(
        api,
        d.world.projectId,
        tab.id,
        {
          replace: {
            elements: tab.elements,
            kind: tab.kind === 'sheet' ? 'sheet' : 'board',
            name: tab.name,
            ...(tab.theme ? { theme: tab.theme } : {}),
          },
          summary: `Add ${tab.name}`,
        },
        client,
      );
    made.push(`${tab.kind === 'sheet' ? 'Sheet' : 'Board'} tab "${tab.name}" (${tab.id})`);
    const sheet = d.sheets.find((s) => s.tabId === tab.id);
    // The headers are a head start: the first response writes any it finds missing, so a miss here is said, not fatal.
    if (sheet)
      await syncSheetHeaders(api, d, sheet.sheetId, { title: tab.name }, client).catch(() =>
        made.push(`its header row is written by the first response`),
      );
  }
  // A sheet form's existing sheet gains a column for each question it lacks one for, read only when the form now asks
  // for a header it did not (a sheet read loads the project's sheets).
  const target = d.form.sheet;
  const had = new Set(before ? sheetHeaders(before).map((h) => h.header.toLowerCase()) : []);
  const newHeader = sheetHeaders(d.form).some((h) => !had.has(h.header.toLowerCase()));
  const switched = before?.sheet?.sheetId !== target?.sheetId;
  if (target && (newHeader || switched) && !d.newTabs.some((t) => t.id === target.tabId))
    await syncSheetHeaders(api, d, target.sheetId, null, client).catch(() =>
      made.push(`the sheet's new columns are written by the first response`),
    );
  for (const board of d.changedBoards.values()) {
    const changed = await changeBoard(
      api,
      d.world.projectId,
      // A board is changed only when it confines its types, so it names them.
      { board: board.elementId, types: board.types! },
      client,
    );
    made.push(
      changed.ok
        ? `"${board.tabName}" now takes the form's card type`
        : `"${board.tabName}" could not take the form's card type: ${changed.message}`,
    );
  }
  return made;
}
