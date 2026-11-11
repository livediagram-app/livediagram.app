// The events apps and liveworkspace accounts report (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "The event log"): an app's `edited`, and accounts' team events for the team audit log, each checked before it is
// recorded (events.ts).
import { personEventKeys } from './event-key';
import {
  ACCOUNT_EVENT_TYPES,
  APP_EVENTS_MAX,
  APP_EVENT_TYPES,
  PLATFORM_APP,
  type AccountEvent,
  type AppEvent,
} from '@liveworkspace/index-client';
import { isMergeCaller } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, noContent, notFound, readObject, unauthorized } from './http';
import { useDayStatements } from './items';
import {
  ACTOR_NAME_MAX,
  type BulkEvent,
  FUTURE_SLACK_MS,
  bulkEventStatements,
  editedEventId,
  eventStatements,
} from './events';

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseAppEvent(value: unknown, now: number): AppEvent | null {
  const e = value as Record<string, unknown> | null;
  if (!e || typeof e !== 'object') return null;
  if (!(APP_EVENT_TYPES as readonly unknown[]).includes(e.type)) return null;
  if (!isId(e.actorId) || !isTime(e.at)) return null;
  const name = e.actorName ?? null;
  if (name !== null && typeof name !== 'string') return null;
  return {
    type: e.type as AppEvent['type'],
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
  const byId = new Map<string, AppEvent>();
  const events: AppEvent[] = [];
  for (const value of list) {
    const event = parseAppEvent(value, now);
    if (!event) return badRequest('invalid_events');
    events.push(event);
  }
  const keys = await personEventKeys(events.map((e) => e.actorId));
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

// ---------- Teams, from liveworkspace accounts -----------------------------------------------------------------

const EVENT_ID_MAX = 300;
const TITLE_MAX = 200;
const DETAIL_KEYS_MAX = 12;
const DETAIL_VALUE_MAX = 500;

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

// Kinds accounts used to send that nothing reads now (a team deleted, an API token's): taken and dropped, so an
// accounts Worker deployed before this one, or its outbox's backlog, is never refused and never retries forever.
// One release, then they go (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The event log").
const DROPPED_ACCOUNT_TYPES: ReadonlySet<unknown> = new Set([
  'team_deleted',
  'token_created',
  'token_revoked',
  'token_expiring',
]);

/** One account event as the index keeps it; `dropped` for a kind it takes but no longer keeps; null when malformed.
 *  An old Worker's `scopes` are ignored: the audit log reads the team from `detail.teamId`. */
export function parseAccountEvent(value: unknown, now: number): AccountEvent | 'dropped' | null {
  const e = value as Record<string, unknown> | null;
  if (!e || typeof e !== 'object') return null;
  const dropped = DROPPED_ACCOUNT_TYPES.has(e.type);
  if (!dropped && !(ACCOUNT_EVENT_TYPES as readonly unknown[]).includes(e.type)) return null;
  if (typeof e.id !== 'string' || e.id.length === 0 || e.id.length > EVENT_ID_MAX) return null;
  if (e.actorId !== null && e.actorId !== undefined && !isId(e.actorId)) return null;
  const name = e.actorName ?? null;
  if (name !== null && typeof name !== 'string') return null;
  if (typeof e.title !== 'string' || !isTime(e.at)) return null;
  const detail = parseDetailInput(e.detail);
  if (detail === undefined) return null;
  if (dropped) return 'dropped';
  return {
    id: e.id,
    type: e.type as AccountEvent['type'],
    actorId: (e.actorId as string | null | undefined) ?? null,
    actorName: name ? name.slice(0, ACTOR_NAME_MAX) : null,
    title: e.title.slice(0, TITLE_MAX),
    detail,
    at: Math.min(Math.floor(e.at), now + FUTURE_SLACK_MS),
  };
}

/**
 * POST /internal/events from liveworkspace accounts (its key, as for the merge): up to APP_EVENTS_MAX team events in two statements (the events, then their
 * teams' audit log rows). Each event's id is accounts' own and stable, so a batch sent again (accounts resends
 * until it lands) changes nothing.
 */
export async function handleAccountEvents(request: Request, env: Env): Promise<Response> {
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
    if (event !== 'dropped') events.push({ ...event, app: PLATFORM_APP, itemId: null });
  }
  if (events.length > 0) await env.INDEX_DB.batch(bulkEventStatements(env.INDEX_DB, events));
  return noContent();
}
