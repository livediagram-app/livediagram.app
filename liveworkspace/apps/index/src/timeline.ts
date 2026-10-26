// The Timeline (liveworkspace/docs/one-explorer-contracts.md "Timeline"): what happened to the items a person
// reaches as owner or team member, newest first, in every app or one.
//
// Recording. The index writes its own events (created, renamed, moved, trashed, restored, shared,
// unshared, favourited, synced, taken_offline) in the same batch as the change, each statement reading the
// item's app, name and scope from its row. From an item's collab push it writes commented,
// comment_resolved, action_assigned and action_done (collab-push.ts). An app reports `edited` from its
// server (PUT /app/items/:id/events): one event per person, item and UTC day, whose time moves on with each
// report, which also counts the day towards the person's Most Used; and image_uploaded (PUT
// /app/people/events), one per person, app and day, counting. liveworkspace accounts reports its team and
// API token events (POST /internal/timeline), under TIMELINE_PLATFORM, each with the scopes that see it.
// An event about no item (`item_id` NULL) keeps its own app and title.
//
// Reading. Each event has a row per scope that sees it (the item's `p:<owner>` or `t:<team>`; a favourite,
// only its person's), carrying the app and time. A page is one statement: for each of the person's scopes
// (their own, and each team's: at most 1 + DELEGATED_TEAMS_MAX), one index range of at most limit + 1 rows,
// by scope, then app when filtered, then time (filtered, a second range for TIMELINE_PLATFORM's events, which
// every app's view shows); then the newest limit + 1 of those, joined to their events and items. Nothing is
// read per event.

import {
  ACCOUNT_EVENT_AHEAD_MS,
  ACCOUNT_EVENT_SCOPES_MAX,
  ACCOUNT_TIMELINE_EVENT_TYPES,
  APP_EVENTS_MAX,
  APP_PERSON_EVENT_TYPES,
  APP_TIMELINE_EVENT_TYPES,
  TIMELINE_PLATFORM,
  TIMELINE_DISMISS_MAX,
  TIMELINE_LIMIT_MAX,
  TIMELINE_NEW_CAP,
  TIMELINE_PAGE,
  isApp,
  type AccountTimelineEvent,
  type App,
  type AppPersonEvent,
  type AppTimelineEvent,
  type TimelineApp,
  type TimelineEvent,
  type TimelineEventType,
} from '@liveworkspace/index-client';
import { unionAll } from '@liveworkspace/api-kit/d1-compound';
import { isMergeCaller, scopesOf, teamScope, type Person } from './auth';
import { decodeCursor, encodeCursor, isId } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { inTeamNow } from './fresh-teams';
import { badRequest, forbidden, json, noContent, notFound, readObject, unauthorized } from './http';
import { useDayOf, useDayStatements } from './items';
import { ITEM_COLUMNS, directAccess, toItem, type Access, type ItemRow } from './rows';

type Db = D1Database;

// A name an app reports for whoever did it, cut to this.
const ACTOR_NAME_MAX = 200;
// A report from further ahead than this is taken as now: a clock running fast can't pin an event to the
// top of everyone's Timeline (nor an item to the top of every list, app-routes.ts's summary push).
export const FUTURE_SLACK_MS = 5 * 60 * 1000;

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

/** One event of a batch written whole (bulkEventStatements): its scopes named, its title given. */
export type BulkEvent = {
  id: string;
  app: TimelineApp;
  // Null for an event about no item.
  itemId: string | null;
  type: TimelineEventType;
  actorId: string | null;
  actorName?: string | null;
  title: string;
  detail?: Record<string, string | null> | null;
  at: number;
  scopes: string[];
};

/**
 * Any number of events in three statements, whatever the count: the events, then a scope row per (scope,
 * event), then the scope rows' times for an event sent again later. Sending one again (same id) moves its
 * time on and takes its newest title and detail, so a retry never makes a second card.
 */
export function bulkEventStatements(db: Db, events: readonly BulkEvent[]): D1PreparedStatement[] {
  if (events.length === 0) return [];
  const rows = events.map((e) => ({
    id: e.id,
    app: e.app,
    item: e.itemId,
    actor: e.actorId,
    name: e.actorName ?? null,
    type: e.type,
    title: e.title,
    detail: e.detail ? JSON.stringify(e.detail) : null,
    at: e.at,
  }));
  const pairs = events.flatMap((e) => [...new Set(e.scopes)].map((scope) => [scope, e.id]));
  return [
    db
      .prepare(
        `INSERT INTO timeline_events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.app'), json_extract(value, '$.item'),
           json_extract(value, '$.actor'), json_extract(value, '$.name'), json_extract(value, '$.type'),
           json_extract(value, '$.title'), json_extract(value, '$.detail'), json_extract(value, '$.at')
         FROM json_each(?) WHERE true
         ON CONFLICT (id) DO UPDATE SET
           occurred_at = MAX(timeline_events.occurred_at, excluded.occurred_at),
           title = excluded.title,
           detail = COALESCE(excluded.detail, timeline_events.detail),
           actor_name = COALESCE(excluded.actor_name, timeline_events.actor_name)`,
      )
      .bind(JSON.stringify(rows)),
    db
      .prepare(
        `INSERT OR IGNORE INTO timeline_event_scopes (scope, event_id, app, occurred_at)
         SELECT json_extract(p.value, '$[0]'), e.id, e.app, e.occurred_at
         FROM json_each(?) p JOIN timeline_events e ON e.id = json_extract(p.value, '$[1]')`,
      )
      .bind(JSON.stringify(pairs)),
    db
      .prepare(
        `UPDATE timeline_event_scopes SET occurred_at = (
           SELECT occurred_at FROM timeline_events WHERE id = timeline_event_scopes.event_id)
         WHERE event_id IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify(events.map((e) => e.id))),
  ];
}

/** The id of a person's `edited` event on an item for the day of `at`. */
export const editedEventId = (itemId: string, personId: string, at: number) =>
  `ed:${itemId}:${personId}:${useDayOf(at)}`;

export type TimelineSpec = {
  app?: App;
  // One item's own history (its History dialog): only its events, in whichever of the person's scopes see them.
  item?: string;
  // One team's activity (its Team Activity): only the team's scope, checked by the route against the accounts Worker.
  team?: string;
  limit: number;
  cursor?: { at: number; id: string };
};

export type BuiltQuery = { sql: string; args: unknown[] };

/**
 * One page of one item's history: its events newest first, through the events' item index, each kept when one of
 * the person's scopes sees it and they haven't removed it. An item's events are few, so this reads at most the
 * page plus what the person can't see or removed.
 */
function buildItemHistoryQuery(person: Person, spec: TimelineSpec & { item: string }): BuiltQuery {
  const scopes = scopesOf(person);
  const args: unknown[] = [person.id, spec.item, ...scopes, person.id];
  let cursor = '';
  if (spec.cursor) {
    cursor = ' AND (e.occurred_at < ? OR (e.occurred_at = ? AND e.id < ?))';
    args.push(spec.cursor.at, spec.cursor.at, spec.cursor.id);
  }
  args.push(spec.limit + 1);
  const sql = `SELECT s.seen_at, x.* FROM (
      SELECT (SELECT last_seen_at FROM timeline_scope_state WHERE person_id = ?) AS seen_at
    ) s LEFT JOIN (
      SELECT e.id AS e_id, e.app AS e_app, e.item_id AS e_item_id, e.actor_id AS e_actor_id,
             e.actor_name AS e_actor_name, e.type AS e_type, e.title AS e_title, e.detail AS e_detail,
             e.occurred_at AS e_occurred_at, ${ITEM_COLUMNS}
      FROM timeline_events e JOIN items i ON i.id = e.item_id
      WHERE e.item_id = ?
        AND EXISTS (SELECT 1 FROM timeline_event_scopes sc
                    WHERE sc.event_id = e.id AND sc.scope IN (${scopes.map(() => '?').join(', ')}))
        AND NOT EXISTS (SELECT 1 FROM timeline_dismissals d WHERE d.person_id = ? AND d.event_id = e.id)${cursor}
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?
    ) x ON 1`;
  return { sql, args };
}

/** One page of a person's Timeline as one statement (exported for its plan test). */
export function buildTimelineQuery(person: Person, spec: TimelineSpec): BuiltQuery {
  if (spec.item) return buildItemHistoryQuery(person, { ...spec, item: spec.item });
  const take = spec.limit + 1;
  const args: unknown[] = [person.id];
  const ranges: string[] = [];
  // Filtered to one app, the account's own events (teams, tokens) show too: a second range per scope.
  const apps: (TimelineApp | null)[] = spec.app ? [spec.app, TIMELINE_PLATFORM] : [null];
  // A team's activity reads the team's scope alone: one range (two with an app), never a compound past D1's limit.
  const scopes = spec.team ? [teamScope(spec.team)] : scopesOf(person);
  for (const scope of scopes) {
    for (const app of apps) {
      // An event the person removed from their Timeline is skipped in the range; removals are rare, so the
      // range reads at most limit + 1 rows plus those.
      let sql = `SELECT event_id FROM timeline_event_scopes s WHERE scope = ?
      AND NOT EXISTS (SELECT 1 FROM timeline_dismissals d WHERE d.person_id = ? AND d.event_id = s.event_id)`;
      args.push(scope, person.id);
      if (app) {
        sql += ' AND app = ?';
        args.push(app);
      }
      if (spec.cursor) {
        sql += ' AND (occurred_at < ? OR (occurred_at = ? AND event_id < ?))';
        args.push(spec.cursor.at, spec.cursor.at, spec.cursor.id);
      }
      sql += ' ORDER BY occurred_at DESC, event_id DESC LIMIT ?';
      args.push(take);
      ranges.push(`SELECT event_id FROM (${sql})`);
    }
  }
  args.push(take);
  const sql = `SELECT s.seen_at, x.* FROM (
      SELECT (SELECT last_seen_at FROM timeline_scope_state WHERE person_id = ?) AS seen_at
    ) s LEFT JOIN (
      SELECT e.id AS e_id, e.app AS e_app, e.item_id AS e_item_id, e.actor_id AS e_actor_id,
             e.actor_name AS e_actor_name, e.type AS e_type, e.title AS e_title, e.detail AS e_detail,
             e.occurred_at AS e_occurred_at, ${ITEM_COLUMNS}
      FROM timeline_events e LEFT JOIN items i ON i.id = e.item_id
      WHERE e.id IN (${unionAll(ranges)})
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?
    ) x ON 1`;
  return { sql, args };
}

type EventRow = ItemRow & {
  seen_at: number | null;
  e_id: string | null;
  e_app: TimelineApp;
  e_item_id: string | null;
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
const NO_EXTRAS = { favourite: false, lastOpenedAt: null, hiddenFromRecent: false };

function toEvent(row: EventRow, person: Person): TimelineEvent {
  // An event about no item: a team's, a token's, images uploaded, an item taken offline.
  const item =
    row.id === null || row.id === undefined
      ? null
      : toItem(row, directAccess(row, person) ?? LINK_VIEW, NO_EXTRAS);
  return {
    id: row.e_id!,
    app: row.e_app,
    type: row.e_type,
    actorId: row.e_actor_id,
    actorName: row.e_actor_name,
    itemId: row.e_item_id,
    title: row.e_title,
    detail: parseDetail(row.e_detail),
    occurredAt: row.e_occurred_at,
    item,
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

/**
 * How many events someone else did since the person last looked, across their scopes (one app's, or every
 * app's), counted to at most TIMELINE_NEW_CAP + 1: each scope reads at most that many rows of its index range,
 * newest first, back to the last look. Never looked: 0.
 */
export function timelineNewQuery(person: Person, app: App | null, now: number): BuiltQuery {
  const take = TIMELINE_NEW_CAP + 1;
  const args: unknown[] = [person.id];
  const ranges: string[] = [];
  const apps: (TimelineApp | null)[] = app ? [app, TIMELINE_PLATFORM] : [null];
  for (const scope of scopesOf(person)) {
    for (const one of apps) {
      let sql = `SELECT s.event_id FROM timeline_event_scopes s JOIN timeline_events e ON e.id = s.event_id
      WHERE s.scope = ?`;
      args.push(scope);
      if (one) {
        sql += ' AND s.app = ?';
        args.push(one);
      }
      sql += ` AND s.occurred_at > (SELECT seen FROM st) AND s.occurred_at <= ?
      AND (e.actor_id IS NULL OR e.actor_id != ?)
      AND NOT EXISTS (SELECT 1 FROM timeline_dismissals d WHERE d.person_id = ? AND d.event_id = s.event_id)
      ORDER BY s.occurred_at DESC LIMIT ?`;
      args.push(now, person.id, person.id, take);
      ranges.push(`SELECT event_id FROM (${sql})`);
    }
  }
  args.push(take);
  const sql = `WITH st AS (SELECT last_seen_at AS seen FROM timeline_scope_state WHERE person_id = ?)
    SELECT COUNT(*) AS n FROM (SELECT DISTINCT event_id FROM (${unionAll(ranges)}) LIMIT ?)`;
  return { sql, args };
}

// GET /timeline, POST /timeline/seen, POST /timeline/dismiss.
export async function handleTimeline(ctx: PersonContext): Promise<Response> {
  const { request, env, url, segments, person } = ctx;
  if (segments.length === 2 && segments[1] === 'dismiss' && request.method === 'POST') {
    // readObject, like every other route: an oversized body is refused before it is parsed.
    const ids = (await readObject(request))?.ids;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > TIMELINE_DISMISS_MAX ||
      !ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 300)
    ) {
      return badRequest('invalid_events');
    }
    const unique = [...new Set(ids as string[])];
    // Only events that exist: an id from nowhere adds nothing.
    await env.INDEX_DB.prepare(
      `INSERT OR IGNORE INTO timeline_dismissals (person_id, event_id, created_at)
       SELECT ?, id, ? FROM timeline_events WHERE id IN (SELECT value FROM json_each(?))`,
    )
      .bind(person.id, Date.now(), JSON.stringify(unique))
      .run();
    return noContent();
  }
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
  const itemParam = url.searchParams.get('item');
  if (itemParam !== null && !isId(itemParam)) return badRequest('invalid_query');
  const teamParam = url.searchParams.get('team');
  // One team's or one item's, never both.
  if (teamParam !== null && (!isId(teamParam) || itemParam !== null)) {
    return badRequest('invalid_query');
  }
  // Read against the accounts Worker, as every team filter is: a member who just left is refused at once.
  if (teamParam !== null && !(await inTeamNow(env, person, teamParam))) {
    return forbidden('not_team_member');
  }
  const page = await listTimeline(env, person, {
    app: appParam ? (appParam as App) : undefined,
    ...(itemParam ? { item: itemParam } : {}),
    ...(teamParam ? { team: teamParam } : {}),
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

// ---------- Events about people rather than an item, from an app ----------------------------------------------

// Images one report may count.
const COUNT_MAX = 1000;

/** The id of a person's `image_uploaded` event in one app for the day of `at`. */
export const imagesEventId = (app: App, personId: string, at: number) =>
  `im:${app}:${personId}:${useDayOf(at)}`;

/**
 * PUT /app/people/events from an app's server: up to APP_EVENTS_MAX `image_uploaded` reports. Each adds its
 * count to the person's event for that app and UTC day (one card a day, "3 images"), whose time moves on.
 * Only the person sees it.
 */
export async function pushPersonEvents(
  env: Env,
  app: App,
  body: Record<string, unknown>,
): Promise<Response> {
  const list = body.events;
  if (!Array.isArray(list) || list.length > APP_EVENTS_MAX) return badRequest('invalid_events');
  const now = Date.now();
  const byId = new Map<string, AppPersonEvent & { count: number }>();
  for (const value of list) {
    const e = value as Record<string, unknown> | null;
    if (!e || typeof e !== 'object') return badRequest('invalid_events');
    if (!(APP_PERSON_EVENT_TYPES as readonly unknown[]).includes(e.type)) {
      return badRequest('invalid_events');
    }
    const count = e.count === undefined ? 1 : e.count;
    if (!isId(e.actorId) || !isTime(e.at)) return badRequest('invalid_events');
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > COUNT_MAX) {
      return badRequest('invalid_events');
    }
    const at = Math.min(Math.floor(e.at), now + FUTURE_SLACK_MS);
    const id = imagesEventId(app, e.actorId, at);
    const seen = byId.get(id);
    byId.set(id, {
      type: 'image_uploaded',
      actorId: e.actorId,
      at: Math.max(at, seen?.at ?? 0),
      count: count + (seen?.count ?? 0),
    });
  }
  if (byId.size === 0) return noContent();
  const db = env.INDEX_DB;
  const rows = [...byId].map(([id, e]) => ({ id, actor: e.actorId, at: e.at, count: e.count }));
  await db.batch([
    db
      .prepare(
        `INSERT INTO timeline_events (id, app, item_id, actor_id, type, title, detail, occurred_at)
         SELECT json_extract(value, '$.id'), ?, NULL, json_extract(value, '$.actor'), 'image_uploaded', '',
           json_object('count', CAST(json_extract(value, '$.count') AS TEXT)), json_extract(value, '$.at')
         FROM json_each(?) WHERE true
         ON CONFLICT (id) DO UPDATE SET
           occurred_at = MAX(timeline_events.occurred_at, excluded.occurred_at),
           detail = json_object('count', CAST(
             COALESCE(CAST(json_extract(timeline_events.detail, '$.count') AS INTEGER), 0)
             + CAST(json_extract(excluded.detail, '$.count') AS INTEGER) AS TEXT))`,
      )
      .bind(app, JSON.stringify(rows)),
    db
      .prepare(
        `INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at)
         SELECT 'p:' || e.actor_id, e.id, e.app, e.occurred_at
         FROM json_each(?) j JOIN timeline_events e ON e.id = json_extract(j.value, '$.id') WHERE true
         ON CONFLICT (scope, event_id) DO UPDATE SET occurred_at = excluded.occurred_at`,
      )
      .bind(JSON.stringify(rows)),
  ]);
  return noContent();
}

// ---------- Teams and API tokens, from liveworkspace accounts --------------------------------------------------

const EVENT_ID_MAX = 300;
const TITLE_MAX = 200;
const DETAIL_KEYS_MAX = 12;
const DETAIL_VALUE_MAX = 500;
const SCOPE = /^[pt]:.+$/;

function parseDetailInput(value: unknown): Record<string, string | null> | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > DETAIL_KEYS_MAX) return undefined;
  const out: Record<string, string | null> = {};
  for (const [key, v] of entries) {
    if (v !== null && typeof v !== 'string') return undefined;
    out[key] = v === null ? null : v.slice(0, DETAIL_VALUE_MAX);
  }
  return out;
}

export function parseAccountEvent(value: unknown, now: number): AccountTimelineEvent | null {
  const e = value as Record<string, unknown> | null;
  if (!e || typeof e !== 'object') return null;
  if (!(ACCOUNT_TIMELINE_EVENT_TYPES as readonly unknown[]).includes(e.type)) return null;
  if (typeof e.id !== 'string' || e.id.length === 0 || e.id.length > EVENT_ID_MAX) return null;
  if (e.actorId !== null && e.actorId !== undefined && !isId(e.actorId)) return null;
  const name = e.actorName ?? null;
  if (name !== null && typeof name !== 'string') return null;
  if (typeof e.title !== 'string' || !isTime(e.at)) return null;
  const detail = parseDetailInput(e.detail);
  if (detail === undefined) return null;
  const scopes = e.scopes;
  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    scopes.length > ACCOUNT_EVENT_SCOPES_MAX ||
    !scopes.every((s) => typeof s === 'string' && s.length <= EVENT_ID_MAX && SCOPE.test(s))
  ) {
    return null;
  }
  return {
    id: e.id,
    type: e.type as AccountTimelineEvent['type'],
    actorId: (e.actorId as string | null | undefined) ?? null,
    actorName: name ? name.slice(0, ACTOR_NAME_MAX) : null,
    title: e.title.slice(0, TITLE_MAX),
    detail,
    // A token's expiry is dated ahead (Upcoming), at most a little past the warning's week.
    at: Math.min(Math.floor(e.at), now + ACCOUNT_EVENT_AHEAD_MS),
    scopes: scopes as string[],
  };
}

/**
 * POST /internal/timeline from liveworkspace accounts (its key, as for the merge): up to APP_EVENTS_MAX team
 * and token events in three statements. Each event's id is accounts' own and stable, so a batch sent again
 * (accounts resends until it lands) changes nothing.
 */
export async function handleAccountTimeline(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  if (!(await isMergeCaller(request, env))) return unauthorized();
  const body = await readObject(request);
  const list = body?.events;
  if (!Array.isArray(list) || list.length === 0 || list.length > APP_EVENTS_MAX) {
    return badRequest('invalid_events');
  }
  const now = Date.now();
  const events: BulkEvent[] = [];
  for (const value of list) {
    const event = parseAccountEvent(value, now);
    if (!event) return badRequest('invalid_events');
    events.push({ ...event, app: TIMELINE_PLATFORM, itemId: null });
  }
  await env.INDEX_DB.batch(bulkEventStatements(env.INDEX_DB, events));
  return noContent();
}
