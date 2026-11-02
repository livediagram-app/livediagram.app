// The plan as its Google Drive file (liveworkspace/docs/specs/005-drive/drive.md "The file", "Contracts > The apps";
// docs/specs/015-api/api.md "Internal"): the `liveplanner.project` envelope, every tab with its per-project folder,
// the cards, the card types and the Sheets. The export runs inside the plan's Durable Object, from the same tab read a
// copy makes (plan-content.ts readContentTabRows) and the item and sheet stores' own reads, stamped with the plan's
// last save so unchanged content is byte-identical. The import's file is read in the worker (readProjectFile: parsed,
// fresh tab ids with their links re-pointed as a copy re-points them, every store's limits) and written inside the new
// plan's object (importProjectFile) as a copy lands, then started as its owner's.

import {
  ITEMS_MAX,
  validateItemTypeCatalogue,
  type Item,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import {
  capElementActions,
  drawnCount,
  isValidTab,
  migrateIncomingTab,
  migrateStoredTab,
  parseProjectEnvelope,
  projectToEnvelopeText,
  threadForRoom,
  type CardThread,
  type EnvelopeSheet,
  type EnvelopeTab,
  type Tab,
} from '@liveplanner/project';
import {
  PROJECT_CELLS_MAX,
  PROJECT_SHEETS_MAX,
  SHEET_CELLS_MAX,
  SHEET_TITLE_MAX,
  isSheetId,
  sheetFromJson,
  validateSheetCreate,
  type SheetCellJson,
  type SheetJson,
} from '@liveplanner/sheets';
import { APP_FILE_FORMATS } from '@liveworkspace/drive/formats';
import type { ExportResult } from '@liveworkspace/index-app';
import { listItems } from '../db/items';
import { listSheets } from '../db/sheets';
import { MAX_TAB_BYTES, byteLength, logTabRefused } from '../limits';
import { capStoredName } from '../names';
import type { PlanEnv } from '../types';
import {
  COPY_PLAN,
  copiedThreads,
  importPlanCopy,
  initPlan,
  readContentTabRows,
  readPlanHead,
  remapTabDataLinks,
  type ContentTabRow,
  type PlanCopy,
} from './plan-content';

export const PROJECT_FILE_FORMAT = APP_FILE_FORMATS.liveplanner;

// ---------- Export ------------------------------------------------------------------------------------------------

// One stored tab as the envelope carries it: its body as every tab read settles it, its id and name, and its folder
// when it is in one. The row's own bookkeeping (revision, order, save time) stays behind: the order is the array's.
function envelopeTabOf(row: ContentTabRow): EnvelopeTab {
  const body = migrateStoredTab(JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>) as Omit<
    Tab,
    'id' | 'name'
  > & { folder?: unknown };
  const { folder: _stale, ...rest } = body;
  return { ...rest, id: row.id, name: row.name, ...(row.folder ? { folder: row.folder } : {}) };
}

// The file, or `unchanged` when the caller already holds this last save, or `not_found` for a plan not started.
// A card or Sheet write marks the plan saved as a tab write does, so `saved_at` versions all of it.
export async function exportProjectFile(
  env: PlanEnv,
  planId: string,
  ifVersion: number | null,
): Promise<ExportResult> {
  const { meta, savedAt, itemTypes } = await readPlanHead(env, planId);
  if (!meta) return { status: 'not_found' };
  if (ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  const [rows, items, sheets, threads] = await Promise.all([
    readContentTabRows(env, planId, null),
    listItems(env, planId),
    listSheets(env, planId),
    // Its cards' threads, without author ids: the file travels.
    copiedThreads(env, planId, null, null).then((all) => all.map(threadForRoom)),
  ]);
  // Cards in their key order, so the same store always writes the same bytes.
  items.sort((a, b) => a.key - b.key);
  return {
    status: 'ok',
    body: projectToEnvelopeText(
      { id: planId, name: meta.name },
      rows.map(envelopeTabOf),
      savedAt,
      items,
      itemTypes,
      sheets,
      threads,
    ),
    contentType: PROJECT_FILE_FORMAT.mimeType,
    version: savedAt,
  };
}

// ---------- Import ------------------------------------------------------------------------------------------------

// What a new plan is made of: its content as a copy carries it (fresh tab ids, links re-pointed; cards and Sheets
// keep their ids, as a copy's do, since each plan has its own stores).
export type ProjectFileContent = { copy: PlanCopy };

type Failure = 'invalid_file' | 'too_large';
export type ProjectFileRead =
  { ok: true; content: ProjectFileContent } | { ok: false; failure: Failure };

const fail = (failure: Failure): { ok: false; failure: Failure } => ({ ok: false, failure });

// The fields a tab read adds beside the body (tab-row.ts rowToTab), which a file written from a tab read carries;
// the body is stored without them.
const ROW_FIELDS = ['projectId', 'orderIndex', 'updatedAt', 'rev', 'folder'] as const;

const MAX_ID = 200;
const NOBODY = { id: '', name: 'Someone', color: '#94a3b8' };

// SQLite's length() of stored text: characters, not UTF-16 units (db/sheets.ts recountStatement).
const sqlLength = (text: string | null) => (text === null ? 0 : [...text].length);

function tabsOf(tabs: EnvelopeTab[], tabIdMap: Map<string, string>): PlanCopy['tabs'] | Failure {
  const out: PlanCopy['tabs'] = [];
  for (const [index, incoming] of tabs.entries()) {
    const tab = migrateIncomingTab(incoming);
    if (!isValidTab(tab)) return 'invalid_file';
    const folder = typeof incoming.folder === 'string' ? incoming.folder.trim() || null : null;
    const body: Record<string, unknown> = { ...tab, elements: capElementActions(tab.elements) };
    delete body.id;
    delete body.name;
    for (const field of ROW_FIELDS) delete body[field];
    const data = remapTabDataLinks(JSON.stringify(body), tabIdMap);
    const bytes = byteLength(data);
    const id = tabIdMap.get(tab.id)!;
    if (bytes > MAX_TAB_BYTES) {
      logTabRefused('drive-import', id, bytes);
      return 'too_large';
    }
    out.push({
      id,
      name: capStoredName(tab.name, null, 'tab') || 'Untitled',
      orderIndex: index,
      folder,
      data,
      elementCount: drawnCount(tab),
    });
  }
  return out;
}

// Cards as the item store's rows (db/items.ts): ids and keys unique, as the store's keys require.
function itemRowsOf(items: Item[]): Record<string, unknown>[] | Failure {
  if (items.length > ITEMS_MAX) return 'too_large';
  const ids = new Set<string>();
  const keys = new Set<number>();
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item.id || item.id.length > MAX_ID || ids.has(item.id) || keys.has(item.key))
      return 'invalid_file';
    if (!Number.isSafeInteger(item.key) || item.key < 1) return 'invalid_file';
    ids.add(item.id);
    keys.add(item.key);
    rows.push({
      id: item.id,
      type: item.type,
      item_key: item.key,
      rank: item.rank,
      fields: JSON.stringify(item.fields),
      rev: Number.isSafeInteger(item.rev) ? item.rev : 1,
      created_at: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      updated_at: Number.isFinite(item.updatedAt) ? item.updatedAt : 0,
      created_by: JSON.stringify(item.createdBy ?? NOBODY),
      updated_by: JSON.stringify(item.updatedBy ?? NOBODY),
    });
  }
  return rows;
}

// Sheets as the sheet store's rows (db/sheets.ts), each checked as a create checks one (validateSheetCreate), under
// the copied tab's new id; a Sheet on no tab of the file is malformed.
function sheetRowsOf(
  sheets: EnvelopeSheet[],
  tabIdMap: Map<string, string>,
  now: number,
): Pick<PlanCopy, 'sheets' | 'cells'> | Failure {
  if (sheets.length > PROJECT_SHEETS_MAX) return 'too_large';
  const out: Pick<PlanCopy, 'sheets' | 'cells'> = { sheets: [], cells: [] };
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const raw of sheets) {
    const tabId = tabIdMap.get(raw.tabId);
    const title = raw.title.trim();
    const titleKey = `${tabId}\u0000${title.toLowerCase()}`;
    if (!tabId || !isSheetId(raw.id) || ids.has(raw.id) || titles.has(titleKey))
      return 'invalid_file';
    if (!title || title.length > SHEET_TITLE_MAX) return 'invalid_file';
    if (!Array.isArray(raw.cells)) return 'invalid_file';
    if (raw.cells.length > SHEET_CELLS_MAX) return 'too_large';
    ids.add(raw.id);
    titles.add(titleKey);
    const sheet: SheetJson = {
      id: raw.id,
      tabId,
      title,
      layout: (raw.layout ?? { rows: [], cols: [] }) as SheetJson['layout'],
      cells: (raw.cells as SheetCellJson[]).filter((c) => c && (c.i || c.f)),
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: (raw.updatedBy as SheetJson['updatedBy']) ?? NOBODY,
    };
    try {
      const check = validateSheetCreate(sheetFromJson(sheet));
      if (!check.ok) return check.error === 'sheet_full' ? 'too_large' : 'invalid_file';
    } catch {
      return 'invalid_file';
    }
    let bytes = 0;
    for (const c of sheet.cells) {
      const input = c.i ? JSON.stringify(c.i) : null;
      const format = c.f ? JSON.stringify(c.f) : null;
      bytes += sqlLength(input) + sqlLength(format);
      out.cells.push({ sheet_id: sheet.id, row_id: c.r, col_id: c.c, input, format });
    }
    out.sheets.push({
      id: sheet.id,
      tab_id: tabId,
      title,
      layout: JSON.stringify(sheet.layout),
      cell_count: sheet.cells.length,
      cell_bytes: bytes,
      created_at: now,
      updated_by: JSON.stringify(sheet.updatedBy),
    });
  }
  if (out.cells.length > PROJECT_CELLS_MAX) return 'too_large';
  return out;
}

// Read a file's text as a new plan's content: another kind, an unreadable envelope, a malformed tab, card, type
// catalogue or Sheet is `invalid_file`; a tab past the tab cap, or a store past its own cap, `too_large`.
export function readProjectFile(text: string, now = Date.now()): ProjectFileRead {
  const parsed = parseProjectEnvelope(text);
  if (!parsed.ok) return fail('invalid_file');
  const { project } = parsed.envelope;
  // Every fresh tab id minted up front, so a link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(project.tabs.map((t) => [t.id, crypto.randomUUID()] as const));
  if (tabIdMap.size !== project.tabs.length) return fail('invalid_file');
  const tabs = tabsOf(project.tabs, tabIdMap);
  if (typeof tabs === 'string') return fail(tabs);
  let itemTypes: ItemTypeCatalogue | null = null;
  if (project.itemTypes) {
    const checked = validateItemTypeCatalogue(project.itemTypes);
    if (!checked.ok) return fail('invalid_file');
    itemTypes = checked.catalogue;
  }
  const items = itemRowsOf(project.items ?? []);
  if (typeof items === 'string') return fail(items);
  const sheets = sheetRowsOf(project.sheets ?? [], tabIdMap, now);
  if (typeof sheets === 'string') return fail(sheets);
  const maxKey = items.reduce((max, row) => Math.max(max, row.item_key as number), 0);
  return {
    ok: true,
    content: {
      copy: {
        itemTypes: itemTypes ? JSON.stringify(itemTypes) : null,
        itemsRev: items.length > 0 ? 1 : 0,
        itemsNextKey: maxKey + 1,
        tabs,
        items,
        ...sheets,
        ...threadsOf(project.threads ?? [], items),
      },
    },
  };
}

// A file's threads on the file's own cards, as a copy carries them (each named on COPY_PLAN until it lands); a thread
// on none of them is left behind.
function threadsOf(
  threads: readonly CardThread[],
  items: readonly Record<string, unknown>[],
): { threads?: CardThread[] } {
  const ids = new Set(items.map((i) => i.id as string));
  const kept = threads.flatMap((t) => {
    const cards = t.cards
      .filter((c) => ids.has(c.itemId))
      .map((c) => ({ projectId: COPY_PLAN, itemId: c.itemId, key: c.key }));
    return cards.length ? [{ ...threadForRoom(t), home: COPY_PLAN, cards }] : [];
  });
  return kept.length ? { threads: kept } : {};
}

export type ProjectFileImport = ProjectFileContent & { name: string; ownerId: string };

// Inside the new plan's object: its content lands as a copy's does (one transaction, refused when the plan already
// holds content), then its row is started as its owner's, with its name.
export async function importProjectFile(
  env: PlanEnv,
  planId: string,
  file: ProjectFileImport,
  now = Date.now(),
): Promise<void> {
  await importPlanCopy(env, planId, file.copy, now);
  await initPlan(env, planId, {
    name: file.name,
    ownerId: file.ownerId,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt: now,
    createdAt: now,
  });
}
