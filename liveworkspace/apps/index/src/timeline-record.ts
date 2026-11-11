// Recording the Timeline (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): the statements that
// write an item event in the same batch as the change it records, one at a time, for a move of a whole scope, or
// in bulk. Re-exported from ./timeline; see its header for what is recorded and when.
import type { TimelineApp, TimelineEventType } from '@liveworkspace/index-client';
import { useDayOf } from './items';
import { isListened, webhookOutboxStatement } from './webhooks/outbox';
import { accountAuditStatement, isAuditedItemEvent, itemAuditStatement } from './team-audit';

type Db = D1Database;

// A name an app reports for whoever did it, cut to this.
export const ACTOR_NAME_MAX = 200;
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
  // Handed to the item scope's webhooks that listen for it (webhooks/outbox.ts), in the same batch.
  if (isListened(event.type)) statements.push(webhookOutboxStatement(db, [id]));
  // Copied into its team's audit log, in the same batch (team-audit.ts).
  const audit = isAuditedItemEvent(event.type)
    ? itemAuditStatement(db, id, event.auditTeams)
    : null;
  if (audit) statements.push(audit);
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
  const listened = events.filter((e) => e.itemId !== null && isListened(e.type)).map((e) => e.id);
  // A team's own events go in its audit log too (team-audit.ts), in the same batch.
  const audit = accountAuditStatement(db, events);
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
    // Handed to their item scopes' webhooks that listen (webhooks/outbox.ts), in the same batch.
    ...(listened.length > 0 ? [webhookOutboxStatement(db, listened)] : []),
    ...(audit ? [audit] : []),
  ];
}

/** The id of a person's `edited` event on an item for the day of `at`, by their key (event-key.ts). */
export const editedEventId = (itemId: string, personKey: string, at: number) =>
  `ed:${itemId}:${personKey}:${useDayOf(at)}`;
