// The Timeline (liveworkspace/docs/one-explorer-contracts.md "Timeline"): what happened to the items a person
// reaches as owner or team member, newest first, in every app or one.
//
// Recording. The index writes its own events (created, renamed, moved, trashed, restored, shared,
// unshared, favourited) in the same batch as the change, each statement reading the item's app, name and
// scope from its row. An app reports `edited` from its server (PUT /app/items/:id/events): one event per
// person, item and UTC day, whose time moves on with each report, which also counts the day towards the
// person's Most Used.
//
// Reading. Each event has a row per scope that sees it (the item's `p:<owner>` or `t:<team>`; a favourite,
// only its person's), carrying the app and time. A page is one statement: for each of the person's scopes
// (their own, and each team's: at most 1 + DELEGATED_TEAMS_MAX), one index range of at most limit + 1 rows,
// by scope, then app when filtered, then time; then the newest limit + 1 of those, joined to their events
// and items. Nothing is read per event.

import {
  APP_EVENTS_MAX,
  APP_TIMELINE_EVENT_TYPES,
  TIMELINE_LIMIT_MAX,
  TIMELINE_PAGE,
  isApp,
  type App,
  type AppTimelineEvent,
  type TimelineEvent,
  type TimelineEventType,
} from '@liveworkspace/index-client';
import { scopesOf, type Person } from './auth';
import { decodeCursor, encodeCursor, isId } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { badRequest, json, noContent, notFound } from './http';
import { useDayOf, useDayStatements } from './items';
import { ITEM_COLUMNS, directAccess, toItem, type Access, type ItemRow } from './rows';

type Db = D1Database;

// A name an app reports for whoever did it, cut to this.
const ACTOR_NAME_MAX = 200;
// A report from further ahead than this is taken as now: a clock running fast can't pin an event to the
// top of everyone's Timeline.
const FUTURE_SLACK_MS = 5 * 60 * 1000;

export type EventInput = {
  itemId: string;
  type: TimelineEventType;
  actorId: string | null;
  actorName?: string | null;
  detail?: Record<string, string | null> | null;
  at: number;
  // Set for an event that extends itself (an `edited`): its id, the same for every report of it.
  id?: string;
  // Only this scope sees it (a favourite: `p:<person>`); otherwise the item's scope.
  scope?: string;
  // Only when the item matches this SQL on `items` (with its own binds): a favourite records only on an
  // item the person reaches.
  when?: { sql: string; args: unknown[] };
};

/** The statements that record one event; they go in the batch that makes the change. */
export function eventStatements(db: Db, event: EventInput): D1PreparedStatement[] {
  const id = event.id ?? crypto.randomUUID();
  const when = event.when ? ` AND ${event.when.sql}` : '';
  const statements = [
    db
      .prepare(
        `INSERT INTO timeline_events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
         SELECT ?, app, id, ?, ?, ?, title, ?, ? FROM items WHERE id = ?${when}
         ON CONFLICT (id) DO UPDATE SET
           occurred_at = MAX(timeline_events.occurred_at, excluded.occurred_at),
           title = excluded.title,
           actor_name = COALESCE(excluded.actor_name, timeline_events.actor_name)`,
      )
      .bind(
        id,
        event.actorId,
        event.actorName ?? null,
        event.type,
        event.detail ? JSON.stringify(event.detail) : null,
        event.at,
        event.itemId,
        ...(event.when?.args ?? []),
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO timeline_event_scopes (scope, event_id, app, occurred_at)
         SELECT COALESCE(?, i.scope), e.id, e.app, e.occurred_at
         FROM timeline_events e JOIN items i ON i.id = e.item_id WHERE e.id = ?`,
      )
      .bind(event.scope ?? null, id),
  ];
  // An event that moved on keeps every scope row's time with it.
  if (event.id) {
    statements.push(
      db
        .prepare(
          `UPDATE timeline_event_scopes
           SET occurred_at = (SELECT occurred_at FROM timeline_events WHERE id = ?1) WHERE event_id = ?1`,
        )
        .bind(id),
    );
  }
  return statements;
}

/**
 * An item that changes scope (into or out of a team, or to a new owner) takes its events with it, so who
 * sees its history is who reaches it now. Favourites stay with the person who starred it.
 */
export function moveScopeStatements(
  db: Db,
  itemId: string,
  from: string,
  to: string,
): D1PreparedStatement[] {
  if (from === to) return [];
  const events = `SELECT id FROM timeline_events WHERE item_id = ? AND type <> 'favourited'`;
  return [
    db
      .prepare(
        `UPDATE OR IGNORE timeline_event_scopes SET scope = ? WHERE scope = ? AND event_id IN (${events})`,
      )
      .bind(to, from, itemId),
    db
      .prepare(`DELETE FROM timeline_event_scopes WHERE scope = ? AND event_id IN (${events})`)
      .bind(from, itemId),
  ];
}

/** The id of a person's `edited` event on an item for the day of `at`. */
export const editedEventId = (itemId: string, personId: string, at: number) =>
  `ed:${itemId}:${personId}:${useDayOf(at)}`;

export type TimelineSpec = { app?: App; limit: number; cursor?: { at: number; id: string } };

export type BuiltQuery = { sql: string; args: unknown[] };

/** One page of a person's Timeline as one statement (exported for its plan test). */
export function buildTimelineQuery(person: Person, spec: TimelineSpec): BuiltQuery {
  const take = spec.limit + 1;
  const args: unknown[] = [person.id];
  const ranges: string[] = [];
  for (const scope of scopesOf(person)) {
    let sql = 'SELECT event_id FROM timeline_event_scopes WHERE scope = ?';
    args.push(scope);
    if (spec.app) {
      sql += ' AND app = ?';
      args.push(spec.app);
    }
    if (spec.cursor) {
      sql += ' AND (occurred_at < ? OR (occurred_at = ? AND event_id < ?))';
      args.push(spec.cursor.at, spec.cursor.at, spec.cursor.id);
    }
    sql += ' ORDER BY occurred_at DESC, event_id DESC LIMIT ?';
    args.push(take);
    ranges.push(`SELECT event_id FROM (${sql})`);
  }
  args.push(take);
  const sql = `SELECT s.seen_at, x.* FROM (
      SELECT (SELECT last_seen_at FROM timeline_scope_state WHERE person_id = ?) AS seen_at
    ) s LEFT JOIN (
      SELECT e.id AS e_id, e.actor_id AS e_actor_id, e.actor_name AS e_actor_name, e.type AS e_type,
             e.title AS e_title, e.detail AS e_detail, e.occurred_at AS e_occurred_at, ${ITEM_COLUMNS}
      FROM timeline_events e JOIN items i ON i.id = e.item_id
      WHERE e.id IN (${ranges.join(' UNION ALL ')})
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?
    ) x ON 1`;
  return { sql, args };
}

type EventRow = ItemRow & {
  seen_at: number | null;
  e_id: string | null;
  e_actor_id: string | null;
  e_actor_name: string | null;
  e_type: TimelineEventType;
  e_title: string;
  e_detail: string | null;
  e_occurred_at: number;
};

function parseDetail(text: string | null): Record<string, string | null> | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string | null>)
      : null;
  } catch {
    return null;
  }
}

// What the person may do with the item now: as owner or team member, or (a favourite of an item shared
// with them) view.
const LINK_VIEW: Access = { level: 'view', tabId: null, via: 'link', code: null };
const NO_EXTRAS = { favourite: false, tagIds: [], lastOpenedAt: null };

function toEvent(row: EventRow, person: Person): TimelineEvent {
  const access = directAccess(row, person) ?? LINK_VIEW;
  return {
    id: row.e_id!,
    app: row.app,
    type: row.e_type,
    actorId: row.e_actor_id,
    actorName: row.e_actor_name,
    itemId: row.id,
    title: row.e_title,
    detail: parseDetail(row.e_detail),
    occurredAt: row.e_occurred_at,
    item: toItem(row, access, NO_EXTRAS),
  };
}

export async function listTimeline(
  env: Env,
  person: Person,
  spec: TimelineSpec,
): Promise<{ events: TimelineEvent[]; nextCursor: string | null; seenAt: number | null }> {
  const { sql, args } = buildTimelineQuery(person, spec);
  const { results } = await env.INDEX_DB.prepare(sql)
    .bind(...args)
    .all<EventRow>();
  const seenAt = results[0]?.seen_at ?? null;
  const rows = results.filter((r) => r.e_id !== null);
  const more = rows.length > spec.limit;
  const page = more ? rows.slice(0, spec.limit) : rows;
  const last = page[page.length - 1];
  return {
    events: page.map((r) => toEvent(r, person)),
    nextCursor: more && last ? encodeCursor({ at: last.e_occurred_at, id: last.e_id! }) : null,
    seenAt,
  };
}

// GET /timeline, POST /timeline/seen.
export async function handleTimeline(ctx: PersonContext): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  if (segments.length === 2 && segments[1] === 'seen' && request.method === 'POST') {
    const seenAt = Date.now();
    await env.INDEX_DB.prepare(
      `INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES (?, ?)
       ON CONFLICT (person_id) DO UPDATE SET last_seen_at = MAX(last_seen_at, excluded.last_seen_at)`,
    )
      .bind(person.id, seenAt)
      .run();
    return json({ seenAt });
  }
  if (segments.length !== 1 || request.method !== 'GET') return notFound();
  const appParam = url.searchParams.get('app');
  if (appParam !== null && appParam !== '' && !isApp(appParam)) return badRequest('invalid_app');
  const limitText = url.searchParams.get('limit');
  const limit = limitText === null || limitText === '' ? TIMELINE_PAGE : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > TIMELINE_LIMIT_MAX) {
    return badRequest('invalid_query');
  }
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  if (cursor === null) return badRequest('invalid_cursor');
  const page = await listTimeline(env, person, {
    app: appParam ? (appParam as App) : undefined,
    limit,
    cursor,
  });
  return json(page);
}

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseAppEvent(value: unknown, now: number): AppTimelineEvent | null {
  const e = value as Record<string, unknown> | null;
  if (!e || typeof e !== 'object') return null;
  if (!(APP_TIMELINE_EVENT_TYPES as readonly unknown[]).includes(e.type)) return null;
  if (!isId(e.actorId) || !isTime(e.at)) return null;
  const name = e.actorName ?? null;
  if (name !== null && typeof name !== 'string') return null;
  return {
    type: e.type as AppTimelineEvent['type'],
    actorId: e.actorId,
    actorName: name ? name.slice(0, ACTOR_NAME_MAX) : null,
    at: Math.min(Math.floor(e.at), now + FUTURE_SLACK_MS),
  };
}

/**
 * PUT /app/items/:id/events from the item's own app: up to APP_EVENTS_MAX events in one batch. Each
 * `edited` lands on its person's event for that day, and counts the day towards their Most Used.
 */
export async function pushAppEvents(
  env: Env,
  itemId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const list = body.events;
  if (!Array.isArray(list) || list.length > APP_EVENTS_MAX) return badRequest('invalid_events');
  const now = Date.now();
  // One per event id, the latest kept: a batch of a day's edits by one person is one event.
  const byId = new Map<string, AppTimelineEvent>();
  for (const value of list) {
    const event = parseAppEvent(value, now);
    if (!event) return badRequest('invalid_events');
    const id = editedEventId(itemId, event.actorId, event.at);
    const seen = byId.get(id);
    if (!seen || seen.at <= event.at)
      byId.set(id, { ...event, actorName: event.actorName ?? seen?.actorName ?? null });
  }
  if (byId.size === 0) return noContent();
  const db = env.INDEX_DB;
  const statements: D1PreparedStatement[] = [];
  for (const [id, event] of byId) {
    statements.push(
      ...eventStatements(db, {
        id,
        itemId,
        type: event.type,
        actorId: event.actorId,
        actorName: event.actorName,
        at: event.at,
      }),
      ...useDayStatements(env, event.actorId, itemId, event.at),
    );
  }
  await db.batch(statements);
  return noContent();
}
