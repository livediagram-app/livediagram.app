// What an item pushes for the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"), from its app's server
// with the app's key: each tab's comment threads and actions, its cards and their threads (under COLLAB_CARDS_TAB),
// and each form's response count and who has seen how many. Shown text is cut rather than refused; ids and times
// must be well formed.
//
// The Timeline's collaboration events come from the same push (collabEvents): the index compares what a tab
// pushes with what it held, in the batch that replaces it, so every app that reports its Inbox reports them too.
// A thread with more comments than before is `commented`, one turned resolved `comment_resolved`, an action
// (or open card) with a new assignee `action_assigned` (seen by the assignee too), one turned done
// `action_done`. Each event's id is made from what it says, so a push sent again records nothing new, and
// anything dated before the item was made (a copy's threads) is not news. A deleted comment's words leave the
// Timeline with it (retractedComments): a thread with fewer comments than it held drops the `commented` events past
// its count, and one that is gone drops its `commented` and `comment_resolved` events too.

import {
  COLLAB_EVENTS_MAX,
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  type App,
  type CollabActionInput,
  type CollabCard,
  type CollabFormInput,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { isId, isPartId } from './codec';
import type { Env } from './env';
import { badRequest, json, noContent, notFound, readObject } from './http';
import { bulkEventStatements, type BulkEvent } from './timeline';

const LABEL_MAX = 200;
const TEXT_MAX = 500;
const COLOR_MAX = 32;
// People named on one thread.
const PEOPLE_MAX = 100;
// A form's response count is a count, not a list: anything past this is clearly wrong.
const RESPONSES_MAX = 10_000_000;

const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null;
const optionalText = (value: unknown, max: number): string | null | undefined =>
  value === undefined || value === null ? null : (clip(value, max) ?? undefined);
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= PEOPLE_MAX && value.every(isId)
    ? [...new Set(value)]
    : null;
const nullableId = (value: unknown): value is string | null => value === null || isId(value);
// A form's public code: letters, digits, `-` and `_`, as the app makes them.
const FORM_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/** A card's facts, or null for an element's row; undefined when malformed. */
export function parseCard(value: unknown): CollabCard | null | undefined {
  if (value === undefined || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c !== 'object' || Array.isArray(c)) return undefined;
  const type = clip(c.type, LABEL_MAX);
  const typeLabel = clip(c.typeLabel, LABEL_MAX);
  const title = clip(c.title, LABEL_MAX);
  const key = c.key === null || c.key === undefined ? null : c.key;
  if (type === null || typeLabel === null || title === null) return undefined;
  if (key !== null && !isCount(key)) return undefined;
  let board: CollabCard['board'] = null;
  if (c.board !== null && c.board !== undefined) {
    const b = c.board as Record<string, unknown>;
    const boardTitle = clip(b?.title, LABEL_MAX);
    const tabName = clip(b?.tabName, LABEL_MAX);
    if (!isPartId(b?.tabId) || !isPartId(b?.elementId) || boardTitle === null || tabName === null) {
      return undefined;
    }
    board = { tabId: b.tabId, elementId: b.elementId, title: boardTitle, tabName };
  }
  return { key, type, typeLabel, title, board };
}

export function parseThread(value: unknown): CollabThreadInput | null {
  const t = value as Record<string, unknown> | null;
  if (!t || typeof t !== 'object') return null;
  const participantIds = idList(t.participantIds);
  const mentionedIds = idList(t.mentionedIds ?? []);
  const elementLabel = clip(t.elementLabel, LABEL_MAX);
  const latestText = clip(t.latestText, TEXT_MAX);
  const latestAuthorName = clip(t.latestAuthorName, LABEL_MAX);
  const latestAuthorColor =
    t.latestAuthorColor === undefined ? '' : clip(t.latestAuthorColor, COLOR_MAX);
  const card = parseCard(t.card);
  if (
    !isPartId(t.elementId) ||
    elementLabel === null ||
    typeof t.resolved !== 'boolean' ||
    !isCount(t.commentCount) ||
    !participantIds ||
    !mentionedIds ||
    latestText === null ||
    latestAuthorName === null ||
    latestAuthorColor === null ||
    card === undefined ||
    !isTime(t.firstAt) ||
    !isTime(t.latestAt)
  ) {
    return null;
  }
  return {
    elementId: t.elementId,
    elementLabel,
    resolved: t.resolved,
    commentCount: t.commentCount,
    participantIds,
    mentionedIds,
    latestText,
    latestAuthorName,
    latestAuthorColor,
    latestAuthorId: isId(t.latestAuthorId) ? t.latestAuthorId : null,
    resolvedById: isId(t.resolvedById) ? t.resolvedById : null,
    firstAt: t.firstAt,
    latestAt: t.latestAt,
    card,
  };
}

const STATUSES = new Set(['open', 'done', 'wont-do']);

export function parseAction(value: unknown): CollabActionInput | null {
  const a = value as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return null;
  const elementLabel = clip(a.elementLabel, LABEL_MAX);
  const name = clip(a.name, LABEL_MAX);
  const description = a.description === undefined ? '' : clip(a.description, TEXT_MAX);
  const assigneeName = optionalText(a.assigneeName, LABEL_MAX);
  const assignerName = optionalText(a.assignerName, LABEL_MAX);
  const card = parseCard(a.card);
  if (
    !isPartId(a.elementId) ||
    !isPartId(a.actionId) ||
    elementLabel === null ||
    name === null ||
    description === null ||
    assigneeName === undefined ||
    assignerName === undefined ||
    card === undefined ||
    typeof a.status !== 'string' ||
    !STATUSES.has(a.status) ||
    !nullableId(a.assigneeId ?? null) ||
    !isId(a.assignerId) ||
    !nullableId(a.teamId ?? null) ||
    !isTime(a.createdAt) ||
    !isTime(a.updatedAt)
  ) {
    return null;
  }
  return {
    elementId: a.elementId,
    actionId: a.actionId,
    elementLabel,
    name,
    description,
    status: a.status as CollabActionInput['status'],
    assigneeId: (a.assigneeId as string | null | undefined) ?? null,
    assigneeName,
    assignerId: a.assignerId,
    assignerName,
    teamId: (a.teamId as string | null | undefined) ?? null,
    doneById: isId(a.doneById) ? a.doneById : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    card,
  };
}

/** Replaces one tab's threads and actions in one batch. Rows go in through json_each, a statement per table
 *  whatever the count. */
export async function pushCollab(
  request: Request,
  env: Env,
  app: App,
  itemId: string,
  tabId: string,
): Promise<Response> {
  const body = await readObject(request);
  if (!body || !Array.isArray(body.threads) || !Array.isArray(body.actions)) {
    return badRequest('invalid_collab');
  }
  if (body.threads.length > COLLAB_MAX_THREADS || body.actions.length > COLLAB_MAX_ACTIONS) {
    return badRequest('invalid_collab');
  }
  const tabName = body.tabName === undefined ? '' : clip(body.tabName, LABEL_MAX);
  // The Timeline: who may say who wrote, resolved or closed.
  for (const t of body.threads as Record<string, unknown>[]) {
    if (!nullableId(t?.latestAuthorId ?? null) || !nullableId(t?.resolvedById ?? null)) {
      return badRequest('invalid_collab');
    }
  }
  for (const a of body.actions as Record<string, unknown>[]) {
    if (!nullableId(a?.doneById ?? null)) return badRequest('invalid_collab');
  }
  if (tabName === null) return badRequest('invalid_collab');
  // Keyed by element (and action): a repeated key keeps its last entry.
  const threads = new Map<string, CollabThreadInput>();
  for (const value of body.threads) {
    const thread = parseThread(value);
    if (!thread) return badRequest('invalid_collab');
    threads.set(thread.elementId, thread);
  }
  const actions = new Map<string, CollabActionInput>();
  for (const value of body.actions) {
    const action = parseAction(value);
    if (!action) return badRequest('invalid_collab');
    actions.set(`${action.elementId}\u0000${action.actionId}`, action);
  }
  // Who is in each open thread, for the Inbox's "where I commented or am mentioned".
  const people: [string, string][] = [];
  for (const t of threads.values()) {
    if (t.resolved) continue;
    for (const id of new Set([...t.participantIds, ...t.mentionedIds]))
      people.push([t.elementId, id]);
  }

  const db = env.INDEX_DB;
  const key = [app, itemId, tabId];
  // What the tab held, to tell what changed: one round trip of three primary-key ranges.
  const [itemRead, threadRead, actionRead] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT title, scope, created_at FROM items WHERE id = ?').bind(itemId),
    db
      .prepare(
        `SELECT element_id, resolved, comment_count FROM collab_threads
         WHERE app = ? AND item_id = ? AND tab_id = ?`,
      )
      .bind(...key),
    db
      .prepare(
        `SELECT element_id, action_id, status, assignee_id FROM collab_actions
         WHERE app = ? AND item_id = ? AND tab_id = ?`,
      )
      .bind(...key),
  ]);
  const item = itemRead?.results[0] as HeldItem | undefined;
  const events = item
    ? collabEvents(
        { app, itemId, tabId, ...item },
        (threadRead?.results ?? []) as HeldThread[],
        (actionRead?.results ?? []) as HeldAction[],
        [...threads.values()],
        [...actions.values()],
        Date.now(),
      )
    : [];
  const retracted =
    item && threads.size < COLLAB_MAX_THREADS
      ? retractedComments(itemId, tabId, (threadRead?.results ?? []) as HeldThread[], threads)
      : [];
  await db.batch([
    ...bulkEventStatements(db, events),
    ...(retracted.length > 0 ? [retractStatement(db, itemId, retracted)] : []),
    db
      .prepare('DELETE FROM collab_threads WHERE app = ? AND item_id = ? AND tab_id = ?')
      .bind(...key),
    db
      .prepare('DELETE FROM collab_thread_people WHERE item_id = ? AND tab_id = ?')
      .bind(itemId, tabId),
    db
      .prepare('DELETE FROM collab_actions WHERE app = ? AND item_id = ? AND tab_id = ?')
      .bind(...key),
    db
      .prepare(
        `INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved,
           comment_count, participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
           card, first_at, latest_at)
         SELECT ?, ?, ?, ?, json_extract(value, '$.elementId'), json_extract(value, '$.elementLabel'),
           json_extract(value, '$.resolved'), json_extract(value, '$.commentCount'),
           json_extract(value, '$.participantIds'), json_extract(value, '$.mentionedIds'),
           json_extract(value, '$.latestText'), json_extract(value, '$.latestAuthorName'),
           json_extract(value, '$.latestAuthorColor'),
           CASE WHEN json_type(value, '$.card') = 'object' THEN json_extract(value, '$.card') END,
           json_extract(value, '$.firstAt'), json_extract(value, '$.latestAt')
         FROM json_each(?)`,
      )
      .bind(...key, tabName, JSON.stringify([...threads.values()])),
    db
      .prepare(
        `INSERT OR IGNORE INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         SELECT ?, ?, ?, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)`,
      )
      .bind(...key, JSON.stringify(people)),
    db
      .prepare(
        `INSERT INTO collab_actions (app, item_id, tab_id, tab_name, element_id, action_id, element_label, name,
           description, status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card, created_at,
           updated_at)
         SELECT ?, ?, ?, ?, json_extract(value, '$.elementId'), json_extract(value, '$.actionId'),
           json_extract(value, '$.elementLabel'), json_extract(value, '$.name'),
           json_extract(value, '$.description'), json_extract(value, '$.status'),
           json_extract(value, '$.assigneeId'), json_extract(value, '$.assigneeName'),
           json_extract(value, '$.assignerId'), json_extract(value, '$.assignerName'),
           json_extract(value, '$.teamId'),
           CASE WHEN json_type(value, '$.card') = 'object' THEN json_extract(value, '$.card') END,
           json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt')
         FROM json_each(?)`,
      )
      .bind(...key, tabName, JSON.stringify([...actions.values()])),
  ]);
  return noContent();
}

/** The comment events a push takes back: for each thread it held with more comments than it now has, its event id
 *  prefix and the count to keep (`commented` past it goes; a thread that is gone keeps nothing, its
 *  `comment_resolved` included). A push at the thread cap is never read as deletions (the oldest were cut). */
export function retractedComments(
  itemId: string,
  tabId: string,
  held: readonly HeldThread[],
  threads: ReadonlyMap<string, CollabThreadInput>,
): [prefix: string, keep: number][] {
  const out: [string, number][] = [];
  for (const was of held) {
    const now = threads.get(was.element_id)?.commentCount ?? 0;
    if (now >= was.comment_count) continue;
    out.push([`cm:${itemId}:${tabId}:${was.element_id}:`, now]);
    if (now === 0) out.push([`cr:${itemId}:${tabId}:${was.element_id}:`, 0]);
  }
  return out;
}

// One statement through the item's events (timeline_events_item): each event of these prefixes whose count is past
// what is kept. Its scope rows and dismissals go with it (ON DELETE CASCADE).
function retractStatement(db: D1Database, itemId: string, pairs: [string, number][]) {
  return db
    .prepare(
      `DELETE FROM timeline_events WHERE item_id = ?1 AND type IN ('commented', 'comment_resolved')
       AND EXISTS (SELECT 1 FROM json_each(?2) j
         WHERE substr(timeline_events.id, 1, length(json_extract(j.value, '$[0]'))) = json_extract(j.value, '$[0]')
           AND CAST(substr(timeline_events.id, length(json_extract(j.value, '$[0]')) + 1) AS INTEGER)
               > json_extract(j.value, '$[1]'))`,
    )
    .bind(itemId, JSON.stringify(pairs));
}

type HeldItem = { title: string; scope: string; created_at: number };
type HeldThread = { element_id: string; resolved: number; comment_count: number };
type HeldAction = {
  element_id: string;
  action_id: string;
  status: string;
  assignee_id: string | null;
};

/** The Timeline events one tab's push makes, against what the tab held (at most COLLAB_EVENTS_MAX, newest). */
export function collabEvents(
  item: { app: App; itemId: string; tabId: string } & HeldItem,
  heldThreads: readonly HeldThread[],
  heldActions: readonly HeldAction[],
  threads: readonly CollabThreadInput[],
  actions: readonly CollabActionInput[],
  now: number,
): BulkEvent[] {
  const { app, itemId, tabId } = item;
  const base = { app, itemId, title: item.title, scopes: [item.scope] };
  const at = (time: number) => Math.min(time, now);
  const events: BulkEvent[] = [];
  const oldThreads = new Map(heldThreads.map((t) => [t.element_id, t]));
  for (const t of threads) {
    const was = oldThreads.get(t.elementId);
    const before = was?.comment_count ?? 0;
    if (t.commentCount > before && t.latestAt >= item.created_at) {
      events.push({
        ...base,
        id: `cm:${itemId}:${tabId}:${t.elementId}:${t.commentCount}`,
        type: 'commented',
        actorId: t.latestAuthorId ?? null,
        actorName: t.latestAuthorName || null,
        detail: {
          text: t.latestText,
          count: String(t.commentCount - before),
          reply: t.commentCount > 1 ? '1' : null,
          on: t.card?.title ?? t.elementLabel,
        },
        at: at(t.latestAt),
      });
    }
    if (was && !was.resolved && t.resolved) {
      events.push({
        ...base,
        id: `cr:${itemId}:${tabId}:${t.elementId}:${t.commentCount}`,
        type: 'comment_resolved',
        actorId: t.resolvedById ?? null,
        detail: { text: t.latestText, on: t.card?.title ?? t.elementLabel },
        at: now,
      });
    }
  }
  const oldActions = new Map(heldActions.map((a) => [`${a.element_id}\u0000${a.action_id}`, a]));
  for (const a of actions) {
    const was = oldActions.get(`${a.elementId}\u0000${a.actionId}`);
    if (a.updatedAt < item.created_at) continue;
    const name = a.card?.title ?? a.name;
    if (a.assigneeId && a.status === 'open' && a.assigneeId !== (was?.assignee_id ?? null)) {
      events.push({
        ...base,
        id: `aa:${itemId}:${tabId}:${a.elementId}:${a.actionId}:${a.assigneeId}`,
        type: 'action_assigned',
        actorId: a.assignerId,
        actorName: a.assignerName ?? null,
        detail: { action: name, assigneeId: a.assigneeId, assigneeName: a.assigneeName ?? null },
        at: at(a.updatedAt),
        // The assignee sees it too, wherever the item is.
        scopes: [item.scope, `p:${a.assigneeId}`],
      });
    }
    if (was && was.status === 'open' && a.status === 'done') {
      events.push({
        ...base,
        id: `ad:${itemId}:${tabId}:${a.elementId}:${a.actionId}:${a.updatedAt}`,
        type: 'action_done',
        actorId: a.doneById ?? a.assigneeId ?? null,
        actorName: a.doneById ? null : (a.assigneeName ?? null),
        detail: { action: name },
        at: at(a.updatedAt),
      });
    }
  }
  if (events.length <= COLLAB_EVENTS_MAX) return events;
  return events.sort((x, y) => y.at - x.at).slice(0, COLLAB_EVENTS_MAX);
}

export function parseForm(value: unknown): CollabFormInput | null | undefined {
  if (value === null) return null;
  const f = value as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return undefined;
  const heading = clip(f.heading, LABEL_MAX);
  const boardTabId = f.boardTabId ?? null;
  const code = f.code ?? null;
  if (
    heading === null ||
    !(code === null || (typeof code === 'string' && FORM_CODE.test(code))) ||
    !(boardTabId === null || isPartId(boardTabId)) ||
    !isCount(f.responses) ||
    f.responses > RESPONSES_MAX ||
    !isTime(f.latestAt)
  ) {
    return undefined;
  }
  return {
    heading,
    boardTabId,
    responses: f.responses,
    latestAt: f.latestAt,
    ...(code === null ? {} : { code }),
  };
}

/** A form's response count (`{ form }`), or `{ form: null }` to take it off the Inbox with everyone's reads. A push
 * with a `code` names the live link's public code (`GET /app/forms/:code`); one without keeps the code it has. */
export async function pushForm(
  request: Request,
  env: Env,
  app: App,
  itemId: string,
  tabId: string,
): Promise<Response> {
  const body = await readObject(request);
  const form = body ? parseForm(body.form) : undefined;
  if (form === undefined) return badRequest('invalid_form');
  const db = env.INDEX_DB;
  if (form === null) {
    await db.batch([
      db.prepare('DELETE FROM collab_forms WHERE item_id = ? AND tab_id = ?').bind(itemId, tabId),
      db
        .prepare('DELETE FROM collab_form_reads WHERE item_id = ? AND tab_id = ?')
        .bind(itemId, tabId),
    ]);
    return noContent();
  }
  await db
    .prepare(
      `INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (item_id, tab_id) DO UPDATE SET heading = excluded.heading,
         board_tab_id = excluded.board_tab_id, responses = excluded.responses,
         latest_at = MAX(collab_forms.latest_at, excluded.latest_at),
         code = COALESCE(excluded.code, collab_forms.code)`,
    )
    .bind(
      app,
      itemId,
      tabId,
      form.heading,
      form.boardTabId,
      form.responses,
      form.latestAt,
      form.code ?? null,
    )
    .run();
  return noContent();
}

/** A person has seen a form's first `seen` responses. A seen count never goes back. */
export async function pushFormSeen(
  request: Request,
  env: Env,
  itemId: string,
  tabId: string,
): Promise<Response> {
  const body = await readObject(request);
  if (!body || !isId(body.personId) || !isCount(body.seen) || body.seen > RESPONSES_MAX) {
    return badRequest('invalid_form_seen');
  }
  await env.INDEX_DB.prepare(
    `INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen) VALUES (?, ?, ?, ?)
     ON CONFLICT (person_id, item_id, tab_id) DO UPDATE SET seen = MAX(seen, excluded.seen)`,
  )
    .bind(body.personId, itemId, tabId, body.seen)
    .run();
  return noContent();
}

/** The item and tab a live form's public code names, for the app that pushed it (`GET /app/forms/:code`). */
export async function formByCode(env: Env, app: App, code: string): Promise<Response> {
  if (!FORM_CODE.test(code)) return notFound();
  const row = await env.INDEX_DB.prepare(
    'SELECT item_id, tab_id FROM collab_forms WHERE code = ? AND app = ?',
  )
    .bind(code, app)
    .first<{ item_id: string; tab_id: string }>();
  return row ? json({ itemId: row.item_id, tabId: row.tab_id }) : notFound();
}

/** How many of a form's responses a person has seen (`GET /app/items/:id/forms/:tabId/seen/:personId`). */
export async function formSeen(
  env: Env,
  itemId: string,
  tabId: string,
  personId: string,
): Promise<Response> {
  const row = await env.INDEX_DB.prepare(
    'SELECT seen FROM collab_form_reads WHERE person_id = ? AND item_id = ? AND tab_id = ?',
  )
    .bind(personId, itemId, tabId)
    .first<{ seen: number }>();
  return json({ seen: row?.seen ?? 0 });
}
