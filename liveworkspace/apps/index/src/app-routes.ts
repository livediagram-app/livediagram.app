// What an item pushes (liveworkspace/docs/one-explorer-contracts.md "What an item pushes"), from its app's
// server with the app's key: the summary derived from its content, each tab's comment threads and
// actions for the Inbox, and its Timeline events (timeline.ts). Only the item's own app may push for it.

import {
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  SUMMARY_MAX_BYTES,
  type App,
  type CollabActionInput,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { callerApp } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, fail, noContent, notFound, readObject, unauthorized } from './http';
import { handleAppPeople } from './notices';
import { pushAppEvents } from './timeline';

// Shown text is cut to these rather than refused.
const LABEL_MAX = 200;
const TEXT_MAX = 500;
// People named on one thread.
const PEOPLE_MAX = 100;

const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null;
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= PEOPLE_MAX && value.every(isId)
    ? [...new Set(value)]
    : null;
const nullableId = (value: unknown): value is string | null => value === null || isId(value);

function parseThread(value: unknown): CollabThreadInput | null {
  const t = value as Record<string, unknown> | null;
  if (!t || typeof t !== 'object') return null;
  const participantIds = idList(t.participantIds);
  const mentionedIds = idList(t.mentionedIds ?? []);
  const elementLabel = clip(t.elementLabel, LABEL_MAX);
  const latestText = clip(t.latestText, TEXT_MAX);
  const latestAuthorName = clip(t.latestAuthorName, LABEL_MAX);
  if (
    !isId(t.elementId) ||
    elementLabel === null ||
    typeof t.resolved !== 'boolean' ||
    !isCount(t.commentCount) ||
    !participantIds ||
    !mentionedIds ||
    latestText === null ||
    latestAuthorName === null ||
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
    firstAt: t.firstAt,
    latestAt: t.latestAt,
  };
}

const STATUSES = new Set(['open', 'done', 'wont-do']);

function parseAction(value: unknown): CollabActionInput | null {
  const a = value as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return null;
  const elementLabel = clip(a.elementLabel, LABEL_MAX);
  const name = clip(a.name, LABEL_MAX);
  if (
    !isId(a.elementId) ||
    !isId(a.actionId) ||
    elementLabel === null ||
    name === null ||
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
    status: a.status as CollabActionInput['status'],
    assigneeId: (a.assigneeId as string | null | undefined) ?? null,
    assignerId: a.assignerId,
    teamId: (a.teamId as string | null | undefined) ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export async function handleApp(request: Request, env: Env, segments: string[]): Promise<Response> {
  const app = await callerApp(request, env);
  if (!app) return unauthorized();
  // /app/people/:id/count (notices.ts).
  if (segments[1] === 'people') return handleAppPeople(request, env, app, segments);
  // /app/items/:id/summary, /app/items/:id/collab/:tabId, /app/items/:id/events
  if (segments[1] !== 'items' || !isId(segments[2]) || request.method !== 'PUT') return notFound();
  const itemId = segments[2];
  const item = await env.INDEX_DB.prepare('SELECT app FROM items WHERE id = ?')
    .bind(itemId)
    .first<{ app: App }>();
  if (!item) return notFound();
  if (item.app !== app) return fail(403, 'wrong_app');

  if (segments.length === 4 && segments[3] === 'summary') {
    const body = await readObject(request);
    if (!body) return badRequest();
    const summary = body.summary;
    if (
      !summary ||
      typeof summary !== 'object' ||
      Array.isArray(summary) ||
      !isTime(body.updatedAt)
    ) {
      return badRequest('invalid_summary');
    }
    const text = JSON.stringify(summary);
    if (new TextEncoder().encode(text).length > SUMMARY_MAX_BYTES)
      return badRequest('invalid_summary');
    // A push that arrives late never moves updatedAt back.
    await env.INDEX_DB.prepare(
      'UPDATE items SET summary = ?, updated_at = MAX(updated_at, ?) WHERE id = ?',
    )
      .bind(text, Math.floor(body.updatedAt), itemId)
      .run();
    return noContent();
  }

  if (segments.length === 4 && segments[3] === 'events') {
    const body = await readObject(request);
    if (!body) return badRequest();
    return pushAppEvents(env, itemId, body);
  }

  if (segments.length === 5 && segments[3] === 'collab' && isId(segments[4])) {
    return pushCollab(request, env, app, itemId, segments[4]);
  }
  return notFound();
}

// Replaces one tab's threads and actions in one batch. Rows go in through json_each, a statement per
// table whatever the count.
async function pushCollab(
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
  await db.batch([
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
        `INSERT INTO collab_threads (app, item_id, tab_id, element_id, element_label, resolved, comment_count,
           participant_ids, mentioned_ids, latest_text, latest_author_name, first_at, latest_at)
         SELECT ?, ?, ?, json_extract(value, '$.elementId'), json_extract(value, '$.elementLabel'),
           json_extract(value, '$.resolved'), json_extract(value, '$.commentCount'),
           json_extract(value, '$.participantIds'), json_extract(value, '$.mentionedIds'),
           json_extract(value, '$.latestText'), json_extract(value, '$.latestAuthorName'),
           json_extract(value, '$.firstAt'), json_extract(value, '$.latestAt')
         FROM json_each(?)`,
      )
      .bind(...key, JSON.stringify([...threads.values()])),
    db
      .prepare(
        `INSERT OR IGNORE INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
         SELECT ?, ?, ?, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)`,
      )
      .bind(...key, JSON.stringify(people)),
    db
      .prepare(
        `INSERT INTO collab_actions (app, item_id, tab_id, element_id, action_id, element_label, name, status,
           assignee_id, assigner_id, team_id, created_at, updated_at)
         SELECT ?, ?, ?, json_extract(value, '$.elementId'), json_extract(value, '$.actionId'),
           json_extract(value, '$.elementLabel'), json_extract(value, '$.name'), json_extract(value, '$.status'),
           json_extract(value, '$.assigneeId'), json_extract(value, '$.assignerId'),
           json_extract(value, '$.teamId'), json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt')
         FROM json_each(?)`,
      )
      .bind(...key, JSON.stringify([...actions.values()])),
  ]);
  return noContent();
}
