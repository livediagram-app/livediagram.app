// timeline — the Explorer's landing feed (migration 0042, spec/138).
//
// Every event is written inline on the write path that caused it.
// There are no scanners and no scan cron: unlike the system this shape
// was borrowed from, livediagram has no entities whose state drifts
// silently behind the API, so a "rescan for what I missed" pass would
// find nothing. The only non-inline writers are the daily crons that
// already compute the future-dated expiry warnings.
//
// Emit is fire-and-forget from every call site (wrapped in waitUntil):
// a missing timeline row is cosmetic, a failed diagram save is not.

import type { TimelineEvent, TimelineScopeRef } from '@livediagram/api-schema';
import type { Env } from '../types';

export type TimelineEventDraft = {
  actorId: string | null;
  sourceType: string;
  sourceId: string;
  eventType: string;
  // '' for one-shot events. See dedupeKeyForDay for the coalesced case.
  dedupeKey?: string;
  title: string;
  description?: string | null;
  occurredAt?: number;
  snapshot?: Record<string, unknown>;
};

// The dedupe key for an event that should collapse to one row per
// actor per UTC day — the coalesced diagram-editing event, and image
// uploads. UTC rather than local because the row is shared by an
// audience in many timezones; the day boundary has to be the same for
// all of them or the same save writes two rows.
export function dedupeKeyForDay(actorId: string | null, at: number): string {
  return `${actorId ?? 'system'}:${new Date(at).toISOString().slice(0, 10)}`;
}

// Write one event and attach it to every scope that should see it.
//
// Idempotent twice over: the UNIQUE key on
// (source_type, source_id, event_type, dedupe_key) means a retry or a
// backfill that overlaps a live emit updates the existing row, and the
// scope rows are INSERT OR IGNORE against their composite primary key.
//
// The UPDATE on conflict is what makes the coalesced editing event
// work: the day's first save inserts, and every later save that day
// pushes `occurred_at` forward and refreshes the snapshot. That is a
// deliberate departure from a strictly additive model, and it is only
// safe because nothing user-authored (a star, a dismissal) hangs off
// these rows yet — see spec/138 §4.2.
export async function emitTimelineEvent(
  env: Env,
  draft: TimelineEventDraft,
  scopes: TimelineScopeRef[],
): Promise<void> {
  if (scopes.length === 0) return;
  const now = Date.now();
  const occurredAt = draft.occurredAt ?? now;
  const dedupeKey = draft.dedupeKey ?? '';
  const snapshot = JSON.stringify(draft.snapshot ?? {});
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO timeline_events
       (id, actor_id, source_type, source_id, event_type, dedupe_key,
        title, description, occurred_at, snapshot, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT (source_type, source_id, event_type, dedupe_key) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       snapshot = excluded.snapshot,
       occurred_at = MAX(timeline_events.occurred_at, excluded.occurred_at)`,
  )
    .bind(
      id,
      draft.actorId,
      draft.sourceType,
      draft.sourceId,
      draft.eventType,
      dedupeKey,
      draft.title,
      draft.description ?? null,
      occurredAt,
      snapshot,
      now,
    )
    .run();

  // Re-read rather than trusting `id`: on a conflict the row that
  // survived is the ORIGINAL one, whose id we never generated.
  const row = await env.DB.prepare(
    `SELECT id FROM timeline_events
      WHERE source_type = ?1 AND source_id = ?2 AND event_type = ?3 AND dedupe_key = ?4`,
  )
    .bind(draft.sourceType, draft.sourceId, draft.eventType, dedupeKey)
    .first<{ id: string }>();
  if (!row) return;

  await attachEventToScopes(env, row.id, scopes, now);
}

// Add scope memberships for an existing event. Split out because the
// team-invite flow needs it on its own: an invite is created against an
// email address, so at emit time there is nobody to scope it to. The
// membership lands later, in the lazy email-claim step that fills in
// the invitee's user_id (spec/138 §4.4).
export async function attachEventToScopes(
  env: Env,
  eventId: string,
  scopes: TimelineScopeRef[],
  at = Date.now(),
): Promise<void> {
  if (scopes.length === 0) return;
  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO timeline_event_scopes (event_id, scope_type, scope_id, added_at)
     VALUES (?1, ?2, ?3, ?4)`,
  );
  await env.DB.batch(scopes.map((s) => stmt.bind(eventId, s.scopeType, s.scopeId, at)));
}

// Look up an event by its natural key. Used by the invite flow, which
// emits scope-less and attaches the membership on a later request.
export async function findTimelineEventId(
  env: Env,
  sourceType: string,
  sourceId: string,
  eventType: string,
  dedupeKey = '',
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT id FROM timeline_events
      WHERE source_type = ?1 AND source_id = ?2 AND event_type = ?3 AND dedupe_key = ?4`,
  )
    .bind(sourceType, sourceId, eventType, dedupeKey)
    .first<{ id: string }>();
  return row?.id ?? null;
}

type TimelineRow = {
  id: string;
  actor_id: string | null;
  source_type: string;
  source_id: string;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: number;
  snapshot: string;
};

function rowToEvent(row: TimelineRow): TimelineEvent {
  let snapshot: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.snapshot) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      snapshot = parsed as Record<string, unknown>;
    }
  } catch {
    // A row written by a future worker with a shape we can't parse is
    // still worth showing — title and description carry the meaning,
    // the snapshot only enriches it. Fall through with {}.
  }
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    actorId: row.actor_id,
    snapshot,
  };
}

export type ReadTimelineOptions = {
  scope: TimelineScopeRef;
  limit: number;
  // "<occurredAt>:<eventId>" from the previous page.
  cursor?: string | null;
  from?: number | null;
  to?: number | null;
  sourceTypes?: string[];
};

export type ReadTimelineResult = {
  items: TimelineEvent[];
  nextCursor?: string;
};

// One page of a scope's feed, newest first.
//
// Paging is keyset, not OFFSET: the feed grows at the head while a user
// reads it, and an offset page would silently skip or repeat rows as it
// shifts. The cursor tiebreaks on event id because several events can
// share a millisecond (a team invite fans out to twelve people in one
// request), and ordering by occurred_at alone would make the page
// boundary non-deterministic.
export async function readTimeline(
  env: Env,
  opts: ReadTimelineOptions,
): Promise<ReadTimelineResult> {
  const binds: unknown[] = [opts.scope.scopeType, opts.scope.scopeId];
  let where = 's.scope_type = ?1 AND s.scope_id = ?2';

  if (opts.cursor) {
    const parsed = parseCursor(opts.cursor);
    if (parsed) {
      binds.push(parsed.occurredAt, parsed.occurredAt, parsed.id);
      where += ` AND (e.occurred_at < ?${binds.length - 2} OR (e.occurred_at = ?${binds.length - 1} AND e.id < ?${binds.length}))`;
    }
  }
  if (typeof opts.from === 'number') {
    binds.push(opts.from);
    where += ` AND e.occurred_at >= ?${binds.length}`;
  }
  if (typeof opts.to === 'number') {
    binds.push(opts.to);
    where += ` AND e.occurred_at <= ?${binds.length}`;
  }
  if (opts.sourceTypes && opts.sourceTypes.length > 0) {
    const placeholders = opts.sourceTypes.map((t) => {
      binds.push(t);
      return `?${binds.length}`;
    });
    where += ` AND e.source_type IN (${placeholders.join(', ')})`;
  }

  // Fetch one extra row to learn whether another page exists, rather
  // than running a second COUNT over the same predicate.
  binds.push(opts.limit + 1);
  const res = await env.DB.prepare(
    `SELECT e.id, e.actor_id, e.source_type, e.source_id, e.event_type,
            e.title, e.description, e.occurred_at, e.snapshot
       FROM timeline_event_scopes s
       JOIN timeline_events e ON e.id = s.event_id
      WHERE ${where}
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT ?${binds.length}`,
  )
    .bind(...binds)
    .all<TimelineRow>();

  const rows = res.results ?? [];
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(rowToEvent),
    nextCursor: hasMore && last ? `${last.occurred_at}:${last.id}` : undefined,
  };
}

function parseCursor(raw: string): { occurredAt: number; id: string } | null {
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const occurredAt = Number(raw.slice(0, at));
  const id = raw.slice(at + 1);
  if (!Number.isFinite(occurredAt) || !id) return null;
  return { occurredAt, id };
}

// ---------------------------------------------------------------------
// Scope state
// ---------------------------------------------------------------------

export type TimelineScopeState = {
  backfilledAt: number | null;
  lastRefreshedAt: number | null;
};

export async function getScopeState(
  env: Env,
  scope: TimelineScopeRef,
): Promise<TimelineScopeState | null> {
  const row = await env.DB.prepare(
    'SELECT backfilled_at, last_refreshed_at FROM timeline_scope_state WHERE scope_type = ?1 AND scope_id = ?2',
  )
    .bind(scope.scopeType, scope.scopeId)
    .first<{ backfilled_at: number | null; last_refreshed_at: number | null }>();
  if (!row) return null;
  return { backfilledAt: row.backfilled_at, lastRefreshedAt: row.last_refreshed_at };
}

export async function markScopeRefreshed(env: Env, scope: TimelineScopeRef): Promise<number> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO timeline_scope_state (scope_type, scope_id, last_refreshed_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT (scope_type, scope_id) DO UPDATE SET last_refreshed_at = excluded.last_refreshed_at`,
  )
    .bind(scope.scopeType, scope.scopeId, now)
    .run();
  return now;
}

export async function markScopeBackfilled(env: Env, scope: TimelineScopeRef): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO timeline_scope_state (scope_type, scope_id, backfilled_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT (scope_type, scope_id) DO UPDATE SET backfilled_at = excluded.backfilled_at`,
  )
    .bind(scope.scopeType, scope.scopeId, Date.now())
    .run();
}

// ---------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------

// Hard-delete every event ABOUT a source entity. The FK cascade on
// timeline_event_scopes.event_id takes the memberships with them.
//
// Call this BEFORE emitting the entity's own `*_deleted` tombstone, so
// the tombstone survives: a deleted diagram collapses from a run of
// bubbles to exactly one row saying it was deleted, which is the row
// that answers "what happened to it?" (spec/138 §3.5). Every future
// entity's delete path should call this rather than writing the DELETE
// inline.
//
// Two predicates, because "about a diagram" is wider than "keyed on the
// diagram id". A comment event's source_id is the COMMENT's id, an
// action's is the ACTION's, a share link's is `<diagramId>:<role>` —
// they all describe a diagram without being keyed on one. Matching only
// source_id left those behind, each rendering a bubble that linked to a
// 404. The second clause reads the `<sourceType>Id` the emitters put in
// every snapshot for exactly this purpose.
//
// The JSON predicate can't use an index, so this is a scan of the rows
// with this source_type. Acceptable: entity deletion is rare and the
// table is bounded by a 365-day retention window. If it ever isn't,
// the fix is a real `about_id` column, not a cleverer query.
export async function markTimelineEventsDeletedBySource(
  env: Env,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM timeline_events
      WHERE source_type = ?1
        AND (source_id = ?2 OR json_extract(snapshot, '$.' || ?3) = ?2)`,
  )
    .bind(sourceType, sourceId, `${sourceType}Id`)
    .run();
}

// Account deletion. The FK cascade makes the order safe regardless;
// the statements are explicit so the intent reads from this file.
export async function deleteTimelineForOwner(env: Env, ownerId: string): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM timeline_event_scopes WHERE scope_type = 'user' AND scope_id = ?1",
  )
    .bind(ownerId)
    .run();
  await env.DB.prepare('DELETE FROM timeline_events WHERE actor_id = ?1').bind(ownerId).run();
  await env.DB.prepare(
    "DELETE FROM timeline_scope_state WHERE scope_type = 'user' AND scope_id = ?1",
  )
    .bind(ownerId)
    .run();
}

// Guest -> Clerk migration on sign-up (spec/138 §9). Moves the guest's
// feed, the events they authored, and the scope-state row — the last so
// the backfill doesn't run a second time against the new id and
// duplicate what just migrated.
export async function migrateTimelineOwner(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<void> {
  // OR IGNORE, then a sweep: a row may already exist under the target
  // id (the user signed in on this browser before), and the composite
  // primary key would make a bare UPDATE fail outright. The survivor is
  // the authoritative account-side row; the guest leftover is dropped.
  await env.DB.prepare(
    `UPDATE OR IGNORE timeline_event_scopes SET scope_id = ?1
      WHERE scope_type = 'user' AND scope_id = ?2`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare(
    "DELETE FROM timeline_event_scopes WHERE scope_type = 'user' AND scope_id = ?1",
  )
    .bind(fromOwnerId)
    .run();
  await env.DB.prepare('UPDATE timeline_events SET actor_id = ?1 WHERE actor_id = ?2')
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare(
    `UPDATE OR IGNORE timeline_scope_state SET scope_id = ?1
      WHERE scope_type = 'user' AND scope_id = ?2`,
  )
    .bind(toOwnerId, fromOwnerId)
    .run();
  await env.DB.prepare(
    "DELETE FROM timeline_scope_state WHERE scope_type = 'user' AND scope_id = ?1",
  )
    .bind(fromOwnerId)
    .run();
}

// Daily retention sweep (spec/138 §3.5). Runs alongside the change_log
// prune in the same cron; 365 days here (TIMELINE_RETENTION_MS) against
// that one's 90. Signature matches the other sweeps so it slots into
// the shared `scheduleSweep` helper rather than growing its own.
//
// Guards on `occurred_at`, so the forward-dated expiry warnings are
// never swept early — they sit in the future, which is the furthest
// thing from stale.
export async function deleteOldTimelineEvents(env: Env, cutoff: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM timeline_events WHERE occurred_at < ?1')
    .bind(cutoff)
    .run();
  return res.meta?.changes ?? 0;
}
