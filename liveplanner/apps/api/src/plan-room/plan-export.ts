// The plan for liveworkspace's data export (liveworkspace/docs/specs/003-accounts/data-export.md; docs/specs/015-api/
// api.md "Internal"): the export door's `csv` format, every Board tab's cards and every Sheet's cells as the editor's
// Download CSV writes them, and its `comments` format, every comment thread in the plan with each comment's real
// author. Both run inside the plan's Durable Object (plan-room.ts exportTables, exportComments) from the stored tabs,
// cards, card types, Sheets and threads. Read only: nothing is written or cached.
import {
  boardCsvRows,
  cardSourceOf,
  donePhase,
  normaliseBoardSetup,
  statusColumnsOfSetups,
  statusPhasesOf,
  typesOf,
  type IsDoneStatus,
  type Item,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@liveplanner/items';
import {
  elementThreads,
  migrateStoredTab,
  type CardThread,
  type Comment,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { Workbook, sheetCsvText, sheetFromJson, toCsv, type Sheet } from '@liveplanner/sheets';
import type {
  ExportComment,
  ExportCommentsResult,
  ExportTable,
  ExportTablesResult,
  ExportThread,
} from '@liveworkspace/index-app';
import { listHomeThreads } from '../db/card-threads';
import { listItems } from '../db/items';
import { listSheets } from '../db/sheets';
import type { PlanEnv } from '../types';
import { readContentTabRows, readPlanHead } from './plan-content';

// The locale a Sheet's values are shown in: the editor shows each person's own; the export, made for no one reader,
// shows the one the api's renders and agents use.
export const EXPORT_LOCALE = 'en-GB';

type StoredTab = { id: string; name: string; kind: Tab['kind']; elements: readonly Element[] };

async function readTabs(env: PlanEnv, planId: string): Promise<StoredTab[]> {
  return (await readContentTabRows(env, planId, null)).map((row) => {
    const body = migrateStoredTab(JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>);
    return { id: row.id, name: row.name, kind: body.kind, elements: body.elements ?? [] };
  });
}

const boardSetupsOf = (elements: readonly Element[]): unknown[] =>
  elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
  );

// ---------- csv ---------------------------------------------------------------------------------------------------

// What every board and Sheet reads from the plan as the editor's PlanContext holds it: its cards, card types, the
// statuses its boards name (each once, the first board's name winning, in tab order) and their done rule.
type PlanReads = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  isDone: IsDoneStatus;
};

async function planReads(
  env: PlanEnv,
  planId: string,
  itemTypes: ItemTypeCatalogue | null,
  tabs: StoredTab[],
): Promise<PlanReads> {
  const items = await listItems(env, planId);
  const setups = tabs.flatMap((t) => boardSetupsOf(t.elements));
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: typesOf(itemTypes),
    statusNames: new Map(statusColumnsOfSetups(setups)),
    isDone: donePhase(statusPhasesOf(setups)),
  };
}

// A Board tab's board as its Download CSV writes it (the editor's useBoardCsv.ts boardCsvText): its first Plan board,
// as the Export dialog's CSV takes it (lib/export-plan/tab-csv.ts). Null for a Board tab without a readable board.
function boardTable(tab: StoredTab, reads: PlanReads): ExportTable | null {
  const el = tab.elements.find((e) => e.type === 'shape' && e.shape === 'plan-board');
  const setup = el?.type === 'shape' ? normaliseBoardSetup(el.planBoard) : null;
  if (!setup) return null;
  const rows = boardCsvRows(setup, reads.items, reads.types, reads.statusNames, reads.isDone);
  return { name: tab.name, kind: 'board', csv: toCsv(rows, { safe: true }) };
}

// The Sheets a tab's Sheet elements draw, in canvas order (a copy not yet made draws none of its own).
const sheetIdsOf = (elements: readonly Element[]): string[] =>
  elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet?.sheetId
      ? [el.planSheet.sheetId]
      : [],
  );

// One workbook per tab, over the tab's Sheets (references reach only the tab's own), as the editor's sheet store
// builds it, with the plan's cards when a formula on the tab reads them.
// A tab none of whose Sheets is drawn is not worked out.
function workbooksOf(
  sheets: readonly Sheet[],
  drawn: ReadonlySet<string>,
  r: PlanReads,
): Map<string, Workbook> {
  const byTab = new Map<string, Sheet[]>();
  for (const s of sheets) {
    const list = byTab.get(s.tabId);
    if (list) list.push(s);
    else byTab.set(s.tabId, [s]);
  }
  const out = new Map<string, Workbook>();
  for (const [tabId, tabSheets] of byTab) {
    if (!tabSheets.some((s) => drawn.has(s.id))) continue;
    const wb = new Workbook({ sheets: tabSheets, locale: EXPORT_LOCALE });
    if (wb.usesCards()) {
      wb.setCards(
        cardSourceOf(r.items.values(), r.types, { statusNames: r.statusNames, isDone: r.isDone }),
      );
    }
    out.set(tabId, wb);
  }
  return out;
}

// Every Board tab's board and every Sheet a tab draws, in tab order, then canvas order; `not_found` for no plan. A
// Sheet no element draws (deleted, waiting to expire) is not exported; one drawn twice is exported once.
export async function exportPlanTables(env: PlanEnv, planId: string): Promise<ExportTablesResult> {
  const { meta, itemTypes } = await readPlanHead(env, planId);
  if (!meta) return { status: 'not_found' };
  const tabs = await readTabs(env, planId);
  const hasBoard = tabs.some((t) => t.kind === 'board');
  const drawn = new Set(tabs.flatMap((t) => sheetIdsOf(t.elements)));
  if (!hasBoard && drawn.size === 0) return { status: 'ok', tables: [] };
  const reads = await planReads(env, planId, itemTypes, tabs);
  const sheets =
    drawn.size === 0 ? [] : (await listSheets(env, planId)).map((json) => sheetFromJson(json));
  const sheetById = new Map(sheets.map((s) => [s.id, s]));
  const workbooks = workbooksOf(sheets, drawn, reads);
  const tables: ExportTable[] = [];
  const done = new Set<string>();
  for (const tab of tabs) {
    if (tab.kind === 'board') {
      const board = boardTable(tab, reads);
      if (board) tables.push(board);
    }
    for (const id of sheetIdsOf(tab.elements)) {
      const sheet = sheetById.get(id);
      if (!sheet || done.has(id)) continue;
      done.add(id);
      tables.push({
        name: sheet.title,
        kind: 'sheet',
        csv: sheetCsvText(workbooks.get(sheet.tabId)!, sheet),
      });
    }
  }
  return { status: 'ok', tables };
}

// ---------- comments ----------------------------------------------------------------------------------------------

// A stored comment with its real author: an id left empty (a comment another person's save carried before its
// author's own claimed it) is unknown.
const exportComment = (c: Comment): ExportComment => ({
  id: c.id,
  authorId: c.authorId || null,
  authorName: c.authorName || null,
  text: c.text ?? '',
  createdAt: Number.isFinite(c.createdAt) ? c.createdAt : null,
});

// Oldest first; a comment with no time keeps its place.
const oldestFirst = (comments: readonly Comment[]): ExportComment[] =>
  comments
    .map(exportComment)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.createdAt ?? 0) - (b.c.createdAt ?? 0) || a.i - b.i)
    .map(({ c }) => c);

// The threads on a tab's elements (docs/specs/024-agents/agent-presence.md "Comments"): each element's own and, on a
// Sheet, each cell's (docs/specs/029-sheets/sheet.md "Cell comments"), named by the element (and the cell).
function elementThreadsOf(tab: StoredTab): ExportThread[] {
  return tab.elements.flatMap((el) =>
    elementThreads(el).flatMap(({ cell, thread }) =>
      thread.comments?.length
        ? [
            {
              id: cell === undefined ? el.id : `${el.id}:${cell}`,
              tabId: tab.id,
              tabName: tab.name,
              on: el.id,
              resolved: thread.resolved === true,
              comments: oldestFirst(thread.comments),
            },
          ]
        : [],
    ),
  );
}

// A card's thread this plan stores (docs/specs/026-plan/items.md "Comments"), on no tab, pinned to the first of this
// plan's cards it is on (the card it was started on).
function cardThreadOf(planId: string, t: CardThread): ExportThread {
  const card = t.cards.find((c) => c.projectId === planId) ?? t.cards[0];
  return {
    id: t.id,
    tabId: null,
    tabName: null,
    on: card?.itemId ?? null,
    resolved: t.resolved,
    comments: oldestFirst(t.comments),
  };
}

// Every thread on the plan's tabs, in tab then canvas order, then every card thread it stores, oldest first; a thread
// shared in from another plan is that plan's. `not_found` for no plan.
export async function exportPlanComments(
  env: PlanEnv,
  planId: string,
): Promise<ExportCommentsResult> {
  const { meta } = await readPlanHead(env, planId);
  if (!meta) return { status: 'not_found' };
  const [tabs, cardThreads] = await Promise.all([
    readTabs(env, planId),
    listHomeThreads(env, planId),
  ]);
  cardThreads.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return {
    status: 'ok',
    threads: [
      ...tabs.flatMap(elementThreadsOf),
      ...cardThreads.map((t) => cardThreadOf(planId, t)),
    ],
  };
}
