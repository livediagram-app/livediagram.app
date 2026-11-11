// The Timeline (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): what happened to the items a person
// reaches as owner or team member, newest first, in every app or one.
//
// Webhooks. Every item event a webhook can listen for (webhooks/outbox.ts isListened) adds one statement to the batch
// recording it, queuing a delivery for each of the item scope's webhooks that listens (none, usually: an indexed
// probe that writes nothing).
//
// Recording. The index writes its own events (created, renamed, moved, trashed, restored, shared,
// unshared, favourited, synced, taken_offline) in the same batch as the change, each statement reading the
// item's app, name and scope from its row. The team-level ones also go in the team's audit log, in the same batch
// (team-audit.ts). From an item's collab push it writes commented,
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
  TIMELINE_PLATFORM,
  TIMELINE_DISMISS_MAX,
  TIMELINE_LIMIT_MAX,
  TIMELINE_NEW_CAP,
  TIMELINE_PAGE,
  isApp,
  type App,
  type TimelineApp,
  type TimelineEvent,
  type TimelineEventType,
} from '@liveworkspace/index-client';
import { unionAll } from '@liveworkspace/api-kit/d1-compound';
import { scopesOf, teamScope, type Person } from './auth';
import { decodeCursor, encodeCursor, isId } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { inTeamNow } from './fresh-teams';
import { badRequest, forbidden, json, noContent, notFound, readObject } from './http';
import { ITEM_COLUMNS, directAccess, toItem, type Access, type ItemRow } from './rows';

export {
  FUTURE_SLACK_MS,
  bulkEventStatements,
  editedEventId,
  eventStatements,
  moveScopeStatements,
} from './timeline-record';
export type { BulkEvent, EventInput } from './timeline-record';
export {
  handleAccountTimeline,
  imagesEventId,
  parseAccountEvent,
  pushAppEvents,
  pushPersonEvents,
} from './timeline-push';

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
 * Numbered parameters (`?1`, `?2`, …), each value bound once however often the SQL names it. D1 refuses a statement
 * binding more than 100, and the Timeline's ranges repeat the person, the app, the cursor and the page size per
 * scope: bound per range, someone in seven teams passed it. Now only the scopes grow, one each (at most 51).
 */
function numbered(): { args: unknown[]; param: (value: unknown) => string } {
  const args: unknown[] = [];
  return {
    args,
    param: (value) => {
      args.push(value);
      return `?${args.length}`;
    },
  };
}

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
  const { args, param } = numbered();
  const pid = param(person.id);
  const take = param(spec.limit + 1);
  const cursor = spec.cursor ? { at: param(spec.cursor.at), id: param(spec.cursor.id) } : null;
  const ranges: string[] = [];
  // Filtered to one app, the account's own events (teams, tokens) show too: a second range per scope.
  const apps = spec.app ? [param(spec.app), param(TIMELINE_PLATFORM)] : [null];
  // A team's activity reads the team's scope alone: one range (two with an app), never a compound past D1's limit.
  const scopes = spec.team ? [teamScope(spec.team)] : scopesOf(person);
  for (const scope of scopes) {
    const sc = param(scope);
    for (const app of apps) {
      // An event the person removed from their Timeline is skipped in the range; removals are rare, so the
      // range reads at most limit + 1 rows plus those.
      let sql = `SELECT event_id FROM timeline_event_scopes s WHERE scope = ${sc}
      AND NOT EXISTS (SELECT 1 FROM timeline_dismissals d WHERE d.person_id = ${pid} AND d.event_id = s.event_id)`;
      if (app) sql += ` AND app = ${app}`;
      if (cursor) {
        sql += ` AND (occurred_at < ${cursor.at} OR (occurred_at = ${cursor.at} AND event_id < ${cursor.id}))`;
      }
      sql += ` ORDER BY occurred_at DESC, event_id DESC LIMIT ${take}`;
      ranges.push(`SELECT event_id FROM (${sql})`);
    }
  }
  const sql = `SELECT s.seen_at, x.* FROM (
      SELECT (SELECT last_seen_at FROM timeline_scope_state WHERE person_id = ${pid}) AS seen_at
    ) s LEFT JOIN (
      SELECT e.id AS e_id, e.app AS e_app, e.item_id AS e_item_id, e.actor_id AS e_actor_id,
             e.actor_name AS e_actor_name, e.type AS e_type, e.title AS e_title, e.detail AS e_detail,
             e.occurred_at AS e_occurred_at, ${ITEM_COLUMNS}
      FROM timeline_events e LEFT JOIN items i ON i.id = e.item_id
      WHERE e.id IN (${unionAll(ranges)})
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT ${take}
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
  const { args, param } = numbered();
  const pid = param(person.id);
  const take = param(TIMELINE_NEW_CAP + 1);
  const until = param(now);
  const ranges: string[] = [];
  const apps = app ? [param(app), param(TIMELINE_PLATFORM)] : [null];
  for (const scope of scopesOf(person)) {
    const sc = param(scope);
    for (const one of apps) {
      let sql = `SELECT s.event_id FROM timeline_event_scopes s JOIN timeline_events e ON e.id = s.event_id
      WHERE s.scope = ${sc}`;
      if (one) sql += ` AND s.app = ${one}`;
      sql += ` AND s.occurred_at > (SELECT seen FROM st) AND s.occurred_at <= ${until}
      AND (e.actor_id IS NULL OR e.actor_id != ${pid})
      AND NOT EXISTS (SELECT 1 FROM timeline_dismissals d WHERE d.person_id = ${pid} AND d.event_id = s.event_id)
      ORDER BY s.occurred_at DESC LIMIT ${take}`;
      ranges.push(`SELECT event_id FROM (${sql})`);
    }
  }
  const sql = `WITH st AS (SELECT last_seen_at AS seen FROM timeline_scope_state WHERE person_id = ${pid})
    SELECT COUNT(*) AS n FROM (SELECT DISTINCT event_id FROM (${unionAll(ranges)}) LIMIT ${take})`;
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
