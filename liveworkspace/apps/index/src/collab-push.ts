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
//
// A form push that raises its response count queues a `form_response` for the plan's own webhooks, in the batch that
// stores the count (webhooks/outbox.ts formResponseStatement).
import { timelinePersonKeys } from './event-key';
import {
  COLLAB_EVENTS_MAX,
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  type App,
  type CollabActionInput,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import type { Env } from './env';
import { badRequest, noContent, readObject } from './http';
import { bulkEventStatements, type BulkEvent } from './timeline';
import { LABEL_MAX, clip, nullableId, parseAction, parseThread } from './collab-parse';

export { parseAction, parseCard, parseColumn, parseThread } from './collab-parse';
export { formByCode, formSeen, parseForm, pushForm, pushFormSeen } from './collab-forms';

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
    for (const id of new Set([...t.participantIds, ...t.mentionedIds, ...(t.agentIds ?? [])]))
      people.push([t.elementId, id]);
  }

  const db = env.INDEX_DB;
  const key = [app, itemId, tabId] as const;
  const now = Date.now();
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
  // An archived item keeps no Inbox (blueprints/archive.md): its push is taken and dropped.
  if (item?.scope.startsWith('a:')) return noContent();
  const events = item
    ? collabEvents(
        { app, itemId, tabId, ...item },
        (threadRead?.results ?? []) as HeldThread[],
        (actionRead?.results ?? []) as HeldAction[],
        [...threads.values()],
        [...actions.values()],
        now,
        await timelinePersonKeys(
          [...actions.values()].flatMap((a) => (a.assigneeId ? [a.assigneeId] : [])),
        ),
      )
    : [];
  const retracted =
    item && threads.size < COLLAB_MAX_THREADS
      ? retractedComments(itemId, tabId, (threadRead?.results ?? []) as HeldThread[], threads)
      : [];
  await db.batch([
    ...bulkEventStatements(db, events),
    ...(retracted.length > 0 ? [retractStatement(db, itemId, retracted)] : []),
    ...collabRowStatements(db, key, tabName, threads, actions, people),
  ]);
  return noContent();
}

// The columns a push sets on a thread's or an action's row beyond its key, compared to tell a changed row.
const THREAD_COLUMNS = [
  'tab_name',
  'element_label',
  'resolved',
  'comment_count',
  'participant_ids',
  'mentioned_ids',
  'latest_text',
  'latest_author_name',
  'latest_author_color',
  'card',
  'first_at',
  'latest_at',
] as const;
const ACTION_COLUMNS = [
  'tab_name',
  'element_label',
  'name',
  'description',
  'status',
  'assignee_id',
  'assignee_name',
  'assigner_id',
  'assigner_name',
  'team_id',
  'card',
  'created_at',
  'updated_at',
] as const;

// An upsert's update of a row whose columns differ, and only then: a row pushed as it is held writes nothing.
const updateIfChanged = (table: string, columns: readonly string[]): string =>
  `DO UPDATE SET ${columns.map((c) => `${c} = excluded.${c}`).join(', ')}
   WHERE ${columns.map((c) => `${table}.${c} IS NOT excluded.${c}`).join(' OR ')}`;

/** The statements that make one tab's rows match a push (blueprints/inbox.md "The pushes"): a row the push no longer
 *  holds is deleted, a new one inserted, a held one updated only where a column differs. A push sent again writes
 *  nothing, and one that changes one row of a thousand writes one, on the platform's one database. Each table is one
 *  statement through json_each, under D1's bound-parameter cap whatever the count. */
export function collabRowStatements(
  db: D1Database,
  key: readonly [App, string, string],
  tabName: string,
  threads: ReadonlyMap<string, CollabThreadInput>,
  actions: ReadonlyMap<string, CollabActionInput>,
  people: readonly [string, string][],
): D1PreparedStatement[] {
  const [, itemId, tabId] = key;
  const threadRows = JSON.stringify([...threads.values()]);
  const actionRows = JSON.stringify([...actions.values()]);
  const peopleRows = JSON.stringify(people);
  return [
    db
      .prepare(
        `DELETE FROM collab_threads WHERE app = ?1 AND item_id = ?2 AND tab_id = ?3
         AND element_id NOT IN (SELECT json_extract(value, '$.elementId') FROM json_each(?4))`,
      )
      .bind(...key, threadRows),
    db
      .prepare(
        `DELETE FROM collab_thread_people WHERE item_id = ?1 AND tab_id = ?2
         AND (app, element_id, person_id) NOT IN
           (SELECT ?3, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?4))`,
      )
      .bind(itemId, tabId, key[0], peopleRows),
    db
      .prepare(
        `DELETE FROM collab_actions WHERE app = ?1 AND item_id = ?2 AND tab_id = ?3
         AND (element_id, action_id) NOT IN
           (SELECT json_extract(value, '$.elementId'), json_extract(value, '$.actionId') FROM json_each(?4))`,
      )
      .bind(...key, actionRows),
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
         FROM json_each(?) WHERE true
         ON CONFLICT (app, item_id, tab_id, element_id) ${updateIfChanged('collab_threads', THREAD_COLUMNS)}`,
      )
      .bind(...key, tabName, threadRows),
    db
      .prepare(
        `INSERT OR IGNORE INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         SELECT ?, ?, ?, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)`,
      )
      .bind(...key, peopleRows),
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
         FROM json_each(?) WHERE true
         ON CONFLICT (app, item_id, tab_id, element_id, action_id) ${updateIfChanged('collab_actions', ACTION_COLUMNS)}`,
      )
      .bind(...key, tabName, actionRows),
  ];
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
  // Each assignee's key for an `action_assigned` event's id (event-key.ts), never their id.
  personKeys: ReadonlyMap<string, string>,
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
        id: `aa:${itemId}:${tabId}:${a.elementId}:${a.actionId}:${personKeys.get(a.assigneeId)}`,
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
