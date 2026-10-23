// What an item pushes for the Inbox (liveworkspace/docs/one-explorer-contracts.md "Inbox"), from its app's server
// with the app's key: each tab's comment threads and actions, its cards and their threads (under COLLAB_CARDS_TAB),
// and each form's response count and who has seen how many. Shown text is cut rather than refused; ids and times
// must be well formed.

import {
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  type App,
  type CollabActionInput,
  type CollabCard,
  type CollabFormInput,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, noContent, readObject } from './http';

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
    if (!isId(b?.tabId) || !isId(b?.elementId) || boardTitle === null || tabName === null) {
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
    !isId(t.elementId) ||
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
    !isId(a.elementId) ||
    !isId(a.actionId) ||
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

export function parseForm(value: unknown): CollabFormInput | null | undefined {
  if (value === null) return null;
  const f = value as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return undefined;
  const heading = clip(f.heading, LABEL_MAX);
  const boardTabId = f.boardTabId ?? null;
  if (
    heading === null ||
    !nullableId(boardTabId) ||
    !isCount(f.responses) ||
    f.responses > RESPONSES_MAX ||
    !isTime(f.latestAt)
  ) {
    return undefined;
  }
  return { heading, boardTabId, responses: f.responses, latestAt: f.latestAt };
}

/** A form's response count (`{ form }`), or `{ form: null }` to take it off the Inbox with everyone's reads. */
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
      `INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (item_id, tab_id) DO UPDATE SET heading = excluded.heading,
         board_tab_id = excluded.board_tab_id, responses = excluded.responses,
         latest_at = MAX(collab_forms.latest_at, excluded.latest_at)`,
    )
    .bind(app, itemId, tabId, form.heading, form.boardTabId, form.responses, form.latestAt)
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
