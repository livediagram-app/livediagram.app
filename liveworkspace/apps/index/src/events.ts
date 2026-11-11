// The event log (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The event log"): a short-lived record of
// what happened to items, feeding each item's History (history.ts), its webhooks (webhooks/outbox.ts) and its team's
// audit log (team-audit.ts). Kept EVENT_RETENTION_MS; the daily run sweeps older ones (sweepEvents).
//
// Recording. The index writes its own events (created, renamed, moved, trashed, restored, shared, unshared,
// favourited, synced) in the same batch as the change, each statement reading the item's app and name from its row.
// From an item's collab push it writes commented, comment_resolved, action_assigned and action_done (collab-push.ts);
// from who comes in through a share link, opened_by_visitor and copied_by_visitor (visitors.ts). An app reports
// `edited` from its server, and liveworkspace accounts its team events (event-push.ts). Every event a webhook can
// listen for adds one statement queuing its deliveries, and a team-level one one statement copying it into the team's
// audit log, both in the same batch.
import { EVENT_RETENTION_MS, type EventApp, type EventType } from '@liveworkspace/index-client';
import type { Env } from './env';
import { useDayOf } from './items';
import { isListened, webhookOutboxStatement } from './webhooks/outbox';
import { accountAuditStatement, isAuditedItemEvent, itemAuditStatement } from './team-audit';

type Db = D1Database;

// A name an app reports for whoever did it, cut to this.
export const ACTOR_NAME_MAX = 200;
// A report from further ahead than this is taken as now: a clock running fast can't pin an event to the
// top of an item's History (nor an item to the top of every list, app-routes.ts's summary push).
export const FUTURE_SLACK_MS = 5 * 60 * 1000;

export type EventInput = {
  itemId: string;
  type: EventType;
  actorId: string | null;
  actorName?: string | null;
  detail?: Record<string, string | null> | null;
  at: number;
  // Set for an event that extends itself (an `edited`): its id, the same for every report of it.
  id?: string;
  // Only when the item matches this SQL on `items` (with its own binds): a favourite records only on an
  // item the person reaches.
  when?: { sql: string; args: unknown[] };
  // The teams whose audit log it goes in (team-audit.ts), for a kind the log keeps: a move's, the team it left and
  // the one it went to (none: no team involved). Unset, the item's team.
  auditTeams?: readonly (string | null)[];
};

/** The statements that record one event; they go in the batch that makes the change. */
export function eventStatements(db: Db, event: EventInput): D1PreparedStatement[] {
  const id = event.id ?? crypto.randomUUID();
  const when = event.when ? ` AND ${event.when.sql}` : '';
  const statements = [
    db
      .prepare(
        `INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
         SELECT ?, app, id, ?, ?, ?, title, ?, ? FROM items WHERE id = ?${when}
         ON CONFLICT (id) DO UPDATE SET
           occurred_at = MAX(events.occurred_at, excluded.occurred_at),
           title = excluded.title,
           actor_name = COALESCE(excluded.actor_name, events.actor_name)`,
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
  ];
  // Handed to the item's webhooks that listen for it (webhooks/outbox.ts), in the same batch.
  if (isListened(event.type)) statements.push(webhookOutboxStatement(db, [id]));
  // Copied into its team's audit log, in the same batch (team-audit.ts).
  const audit = isAuditedItemEvent(event.type)
    ? itemAuditStatement(db, id, event.auditTeams)
    : null;
  if (audit) statements.push(audit);
  return statements;
}

/** One event of a batch written whole (bulkEventStatements), its title given. */
export type BulkEvent = {
  id: string;
  app: EventApp;
  // Null for an event about no item (a team's).
  itemId: string | null;
  type: EventType;
  actorId: string | null;
  actorName?: string | null;
  title: string;
  detail?: Record<string, string | null> | null;
  at: number;
};

/**
 * Any number of events in one statement, whatever the count, then their webhooks' and audit log's. Sending one
 * again (same id) moves its time on and takes its newest title and detail, so a retry never makes a second event.
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
  const listened = events.filter((e) => e.itemId !== null && isListened(e.type)).map((e) => e.id);
  // A team's own events go in its audit log too (team-audit.ts), in the same batch.
  const audit = accountAuditStatement(db, events);
  return [
    db
      .prepare(
        `INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.app'), json_extract(value, '$.item'),
           json_extract(value, '$.actor'), json_extract(value, '$.name'), json_extract(value, '$.type'),
           json_extract(value, '$.title'), json_extract(value, '$.detail'), json_extract(value, '$.at')
         FROM json_each(?) WHERE true
         ON CONFLICT (id) DO UPDATE SET
           occurred_at = MAX(events.occurred_at, excluded.occurred_at),
           title = excluded.title,
           detail = COALESCE(excluded.detail, events.detail),
           actor_name = COALESCE(excluded.actor_name, events.actor_name)`,
      )
      .bind(JSON.stringify(rows)),
    // Handed to their items' webhooks that listen (webhooks/outbox.ts), in the same batch.
    ...(listened.length > 0 ? [webhookOutboxStatement(db, listened)] : []),
    ...(audit ? [audit] : []),
  ];
}

/** The id of a person's `edited` event on an item for the day of `at`, by their key (event-key.ts). */
export const editedEventId = (itemId: string, personKey: string, at: number) =>
  `ed:${itemId}:${personKey}:${useDayOf(at)}`;

// The daily sweep: events older than EVENT_RETENTION_MS go, the oldest first, EVENT_SWEEP_CHUNK a statement through
// the time index (events_occurred), at most EVENT_SWEEP_ROUNDS statements a run, so one run is bounded however big
// the backlog; what is left waits a day. Each statement deletes by rowid, so it never holds more than a chunk.
export const EVENT_SWEEP_CHUNK = 500;
export const EVENT_SWEEP_ROUNDS = 40;

/** Deletes events past their 30 days; returns how many went and whether some are left for the next run. */
export async function sweepEvents(
  env: Env,
  now = Date.now(),
  { chunk = EVENT_SWEEP_CHUNK, rounds = EVENT_SWEEP_ROUNDS } = {},
): Promise<{ deleted: number; more: boolean }> {
  const statement = env.INDEX_DB.prepare(
    `DELETE FROM events WHERE rowid IN (
       SELECT rowid FROM events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
  ).bind(now - EVENT_RETENTION_MS, chunk);
  let deleted = 0;
  for (let round = 0; round < rounds; round++) {
    const changes = (await statement.run()).meta.changes ?? 0;
    deleted += changes;
    if (changes < chunk) return { deleted, more: false };
  }
  return { deleted, more: true };
}
