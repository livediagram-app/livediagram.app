// Importing a board from another tool (docs/specs/026-plan/tracker-import.md "Agents"): a Trello, Asana, Jira or
// Linear export read and planned as the editor's Import dialog does (@liveplanner/items tracker-import), then written
// through the api: into a new Board tab of a plan (the card type, the tab, then the cards in as few writes as the
// request cap allows), or as a new plan (one create, the cards past its room after it). A preview writes nothing.
import type { ApiClient } from '@liveworkspace/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ItemTypesRequest,
  type ItemsBulkRequest,
} from '@liveplanner/api-schema';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEMS_MAX,
  PLAN_TITLE_MAX,
  TRACKER_FILE_MAX_BYTES,
  TRACKER_SOURCE_NAMES,
  assignedPeople,
  cleanText,
  isTrackerRefusal,
  planTrackerImport,
  readTrackerFile,
  trackerDoneMessage,
  trackerRefusalMessage,
  trackerSummary,
  type ItemTypeDef,
  type TrackerBoard,
  type TrackerImportPlan,
  type TrackerPreview,
  type TrackerSource,
} from '@liveplanner/items';
import { importBatches, withImportedThreads, type ImportedCreate } from '@liveplanner/project';
import { parseCsv } from '@liveplanner/sheets';
import { apiRefusalOf } from './api-refusal';
import {
  CARD_TYPES_SAVE_ATTEMPTS,
  isCardTypesStale,
  itemTypesPath,
  readPlanState,
} from './plan-state';
import { itemsPath, tabPath } from '../verbs/shared';

export interface TrackerImportInput {
  // The export's text.
  content: string;
  // Its file name: a CSV board takes its title from it.
  fileName?: string;
  // The tool it came from; read from the file when absent.
  source?: TrackerSource;
  // The plan to add a Board tab to; a new plan when absent.
  projectId?: string;
  // The board's (and a new plan's) name, in place of the file's.
  name?: string;
  preview?: boolean;
}

export type TrackerImportResult =
  | {
      ok: true;
      // False for a preview.
      written: boolean;
      // The plan it went into; null for a preview of a new plan.
      projectId: string | null;
      newPlan: boolean;
      tabId: string | null;
      preview: TrackerPreview;
      // "Imported 120 cards from Trello", or a preview's footer line.
      summary: string;
    }
  | { ok: false; code: string; message: string };

type Client = 'mcp' | 'cli';

const refuse = (code: string, message: string) => ({ ok: false as const, code, message });

// The file as a board, or why it cannot be imported.
export function readTrackerInput(
  input: Pick<TrackerImportInput, 'content' | 'fileName' | 'source' | 'name'>,
): TrackerBoard | { ok: false; code: string; message: string } {
  if (new TextEncoder().encode(input.content).length > TRACKER_FILE_MAX_BYTES)
    return refuse(
      'file_too_large',
      'That file is too big to import. Imports read files up to 20 MB.',
    );
  const board = readTrackerFile(input.content, (text) => parseCsv(text).rows, input.fileName);
  if (isTrackerRefusal(board)) return refuse(board.refusal, trackerRefusalMessage(board));
  if (input.source && input.source !== board.source)
    return refuse(
      'source_mismatch',
      `That file is a ${TRACKER_SOURCE_NAMES[board.source]} export, not ${TRACKER_SOURCE_NAMES[input.source]}. Leave source out to read it as it is.`,
    );
  const name = cleanText(input.name, PLAN_TITLE_MAX);
  return name ? { ...board, title: name } : board;
}

async function postBatches(
  api: ApiClient,
  projectId: string,
  batches: readonly ImportedCreate[][],
): Promise<void> {
  for (const items of batches) {
    const body: ItemsBulkRequest = { items };
    await api.json(`${itemsPath(projectId)}/bulk`, { method: 'POST', body: JSON.stringify(body) });
  }
}

function boardTab(plan: TrackerImportPlan, tabId: string) {
  return { id: tabId, name: plan.title, kind: 'board' as const, elements: [plan.board] };
}

// A new plan: one create carrying the tab, the card type and every card its request has room for.
async function importAsPlan(
  api: ApiClient,
  board: TrackerBoard,
  newId: () => string,
  client: Client,
): Promise<TrackerImportResult> {
  const projectId = newId();
  const plan = planTrackerImport(board, {
    types: [],
    statuses: [],
    people: [],
    members: [],
    room: ITEMS_MAX,
    boardId: crypto.randomUUID(),
  });
  const tabId = crypto.randomUUID();
  const head = {
    id: projectId,
    name: plan.title,
    source: client,
    tabs: [{ ...boardTab(plan, tabId), defaultTextSize: 'sm' }],
    itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: [plan.type] },
  };
  const creates = withImportedThreads(plan.creates, {
    projectId,
    sourceName: plan.sourceName,
    now: Date.now(),
  });
  const batches = importBatches(creates, new TextEncoder().encode(JSON.stringify(head)).length);
  // The create carries the first write's cards (none, when its own room was spent); the rest follow it.
  await api.json('/projects', {
    method: 'POST',
    body: JSON.stringify({ ...head, items: batches.slice(0, 1).flat() }),
  });
  await postBatches(api, projectId, batches.slice(1));
  return done(plan, projectId, tabId, true);
}

function done(
  plan: TrackerImportPlan,
  projectId: string,
  tabId: string,
  newPlan: boolean,
): TrackerImportResult {
  return {
    ok: true,
    written: true,
    projectId,
    newPlan,
    tabId,
    preview: plan.preview,
    summary: trackerDoneMessage(plan.preview, plan.creates.length),
  };
}

// The plan's import, planned against its cards, boards and card types as they are now.
async function planIn(api: ApiClient, projectId: string, board: TrackerBoard) {
  const state = await readPlanState(api, projectId);
  const plan = planTrackerImport(board, {
    types: state.plan.types,
    statuses: state.plan.statuses,
    people: assignedPeople(state.items),
    // An API token never reads a team's people (apps/api routes/teams.ts), so an agent matches people by name.
    members: [],
    room: ITEMS_MAX - state.items.length,
    boardId: crypto.randomUUID(),
  });
  return { plan, state };
}

// The card type saved: the plan's catalogue with it added or merged, at the revision read. 'stale' when another change
// landed first.
async function saveType(
  api: ApiClient,
  projectId: string,
  types: readonly ItemTypeDef[],
  type: ItemTypeDef,
  rev: number,
): Promise<'saved' | 'stale'> {
  const own = types.find((t) => t.id === type.id);
  if (own && JSON.stringify(own) === JSON.stringify(type)) return 'saved';
  const body: ItemTypesRequest = {
    itemTypes: {
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: own ? types.map((t) => (t.id === type.id ? type : t)) : [...types, type],
    },
    expectedRev: rev,
  };
  try {
    await api.json(itemTypesPath(projectId), { method: 'PUT', body: JSON.stringify(body) });
    return 'saved';
  } catch (err) {
    if (isCardTypesStale(err)) return 'stale';
    throw err;
  }
}

async function importIntoPlan(
  api: ApiClient,
  projectId: string,
  board: TrackerBoard,
  client: Client,
  preview: boolean,
): Promise<TrackerImportResult> {
  for (let attempt = 1; ; attempt += 1) {
    const { plan, state } = await planIn(api, projectId, board);
    if (preview)
      return {
        ok: true,
        written: false,
        projectId,
        newPlan: false,
        tabId: null,
        preview: plan.preview,
        summary: plan.preview.reason ?? trackerSummary(plan.preview, 'tab'),
      };
    if (!plan.preview.fits)
      return refuse(
        plan.creates.length > ITEMS_MAX - state.items.length ? 'items_full' : 'item_types_full',
        `${plan.preview.reason} Leave projectId out to import it as a new plan.`,
      );
    const saved = await saveType(
      api,
      projectId,
      state.plan.types,
      plan.type,
      state.plan.itemTypesRev,
    );
    if (saved === 'stale') {
      if (attempt < CARD_TYPES_SAVE_ATTEMPTS) continue;
      return refuse('item_types_stale', 'The card types kept changing. Try again.');
    }
    const tabId = crypto.randomUUID();
    const tab = boardTab(plan, tabId);
    const change: ChangesetRequest = {
      replace: { kind: 'board', name: tab.name, elements: tab.elements },
      summary: `Import the ${plan.title} board from ${plan.sourceName}`,
    };
    await api.json(`${tabPath(projectId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(change),
    });
    const creates = withImportedThreads(plan.creates, {
      projectId,
      sourceName: plan.sourceName,
      now: Date.now(),
    });
    await postBatches(api, projectId, importBatches(creates));
    return done(plan, projectId, tabId, false);
  }
}

export async function importTrackerBoard(
  api: ApiClient,
  input: TrackerImportInput,
  client: Client,
  newId: () => string = () => crypto.randomUUID(),
): Promise<TrackerImportResult> {
  const board = readTrackerInput(input);
  if ('ok' in board) return board;
  try {
    if (input.projectId)
      return await importIntoPlan(api, input.projectId, board, client, !!input.preview);
    if (input.preview) {
      const plan = planTrackerImport(board, {
        types: [],
        statuses: [],
        people: [],
        members: [],
        room: ITEMS_MAX,
        boardId: 'preview',
      });
      return {
        ok: true,
        written: false,
        projectId: null,
        newPlan: true,
        tabId: null,
        preview: plan.preview,
        summary: trackerSummary(plan.preview, 'plan'),
      };
    }
    return await importAsPlan(api, board, newId, client);
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}

// What import_board and `board import` answer: the plan and tab, and the preview's columns, fields, people, comments
// and what was left out.
export function trackerImportAnswer(
  result: Extract<TrackerImportResult, { ok: true }>,
  url: string | null,
) {
  const p = result.preview;
  return {
    written: result.written,
    projectId: result.projectId,
    newPlan: result.newPlan,
    tabId: result.tabId,
    title: p.title,
    source: p.sourceName,
    columns: p.columns,
    fields: p.fields,
    cards: p.cards,
    comments: p.comments.count,
    people: { onPlan: p.people.onPlan, named: p.people.named },
    leftOut: p.skips.map((s) => ({ reason: s.label, count: s.count })),
    fits: p.fits,
    ...(p.reason ? { reason: p.reason } : {}),
    summary: result.summary,
    url,
  };
}
