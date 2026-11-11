// The Timeline's pushed events (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): an app's
// item events, its events about people rather than an item, and liveworkspace accounts' team and API token events,
// each checked before it is recorded. Re-exported from ./timeline.
import { timelinePersonKeys } from './event-key';
import {
  ACCOUNT_EVENT_AHEAD_MS,
  ACCOUNT_EVENT_SCOPES_MAX,
  ACCOUNT_TIMELINE_EVENT_TYPES,
  APP_EVENTS_MAX,
  APP_PERSON_EVENT_TYPES,
  APP_TIMELINE_EVENT_TYPES,
  TIMELINE_PLATFORM,
  type AccountTimelineEvent,
  type App,
  type AppPersonEvent,
  type AppTimelineEvent,
} from '@liveworkspace/index-client';
import { isMergeCaller } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, noContent, notFound, readObject, unauthorized } from './http';
import { useDayOf, useDayStatements } from './items';
import {
  ACTOR_NAME_MAX,
  type BulkEvent,
  FUTURE_SLACK_MS,
  bulkEventStatements,
  editedEventId,
  eventStatements,
} from './timeline-record';

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
  const events: AppTimelineEvent[] = [];
  for (const value of list) {
    const event = parseAppEvent(value, now);
    if (!event) return badRequest('invalid_events');
    events.push(event);
  }
  const keys = await timelinePersonKeys(events.map((e) => e.actorId));
  for (const event of events) {
    const id = editedEventId(itemId, keys.get(event.actorId)!, event.at);
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
      ...useDayStatements(env, event.actorId, itemId, event.at, 'edit'),
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
