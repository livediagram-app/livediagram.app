// Webhooks' outbox (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"): a pending delivery per (webhook,
// event), written by a statement that rides the batch recording the event, so no write path can forget one and none
// waits on the network. After the response the request wakes the dispatcher (durable-object.ts), whose alarm sends.
//
// A mention is the one event not handed to its item's scope: each row names the webhook scope it may go to (the
// mentioned person's own, or the item's team's), worked out by mentions.ts before the batch.
//
// Each statement reads the event's item scope and the scope's live webhooks through indexes: with none listening it
// writes nothing. `queuedCount` moves on whenever a statement is built, so a request knows (by comparing before and
// after) whether it might have queued something and is worth a wake; a concurrent request in the same isolate can only
// add a spare wake, never take one away.

import { WEBHOOK_EVENTS, WEBHOOK_PENDING_MAX, type CardMove } from '@liveworkspace/index-client';
import type { Env } from '../env';
import { DISPATCHER_NAME, WEBHOOK_FRESH_MS } from './config';

const LISTENED: ReadonlySet<string> = new Set(WEBHOOK_EVENTS);

/** Whether some webhook could listen for a Timeline event of this type. */
export const isListened = (type: string) => LISTENED.has(type);

let queued = 0;
export const queuedCount = () => queued;

// The live webhooks of `scope` (the item's, by default) listening for `type`, under their pending cap. `w` and the
// event's columns come from the statement around it; `?4` is WEBHOOK_PENDING_MAX.
const listening = (
  type: string,
  scope = 'i.scope',
) => `JOIN webhooks w ON w.scope = ${scope} AND w.paused_at IS NULL
  WHERE instr(w.events, ',' || ${type} || ',') > 0
    AND (SELECT COUNT(*) FROM (SELECT 1 FROM webhook_deliveries p
         WHERE p.webhook_id = w.id AND p.state = 'pending' LIMIT ?4)) < ?4`;

/** The statement queuing these Timeline events for their item scope's webhooks; it goes after the events' own. */
export function webhookOutboxStatement(
  db: D1Database,
  eventIds: readonly string[],
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  return db
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
         (webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, next_at)
       SELECT w.id, e.id, e.type, e.app, e.item_id, e.title, e.actor_id, e.actor_name, e.detail, e.occurred_at, ?1
       FROM json_each(?2) j
       JOIN timeline_events e ON e.id = j.value
       JOIN items i ON i.id = e.item_id
       ${listening('e.type')}
         AND e.occurred_at >= ?1 - ?3`,
    )
    .bind(now, JSON.stringify(eventIds), WEBHOOK_FRESH_MS, WEBHOOK_PENDING_MAX);
}

/** The id of a card move's delivery: the same however often the plan sends it. */
export const cardMoveId = (itemId: string, move: Pick<CardMove, 'cardId' | 'at'>) =>
  `cmv:${itemId}:${move.cardId}:${move.at}`;

/** The statement queuing a plan's card moves for its scope's webhooks (they are not Timeline events). */
export function cardMovesStatement(
  db: D1Database,
  itemId: string,
  moves: readonly CardMove[],
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  const rows = moves.map((m) => ({
    id: cardMoveId(itemId, m),
    name: m.actorName ?? null,
    at: m.at,
    detail: JSON.stringify({
      cardId: m.cardId,
      cardKey: m.cardKey === null ? null : String(m.cardKey),
      card: m.card,
      from: m.from,
      to: m.to,
    }),
  }));
  return db
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
         (webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, next_at)
       SELECT w.id, j.value ->> '$.id', 'card_moved', i.app, i.id, i.title, NULL, j.value ->> '$.name',
              j.value ->> '$.detail', j.value ->> '$.at', ?1
       FROM items i JOIN json_each(?2) j
       ${listening("'card_moved'")}
         AND i.id = ?5 AND (j.value ->> '$.at') >= ?1 - ?3`,
    )
    .bind(now, JSON.stringify(rows), WEBHOOK_FRESH_MS, WEBHOOK_PENDING_MAX, itemId);
}

/** A form's new responses as the plan pushes them (`PUT /app/items/:id/forms/:tabId`). */
export type FormResponses = { heading: string; responses: number; latestAt: number };

/**
 * The statement queuing a live form's new responses for its plan's scope's webhooks: one delivery for the rise from
 * the count the index holds to `form.responses`, nothing when it didn't rise or the form was never pushed. It reads
 * the held count, so it goes before the statement that stores the new one, in the same batch. The detail is the
 * form's heading and the counts, never an answer.
 */
export function formResponseStatement(
  db: D1Database,
  itemId: string,
  tabId: string,
  form: FormResponses,
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  return db
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
         (webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, next_at)
       SELECT w.id, 'frm:' || ?2 || ':' || ?5 || ':' || CAST(?6 AS INTEGER), 'form_response', i.app, i.id, i.title,
              NULL, NULL,
              json_object('form', ?7, 'responses', CAST(CAST(?6 - f.responses AS INTEGER) AS TEXT),
                          'total', CAST(CAST(?6 AS INTEGER) AS TEXT)),
              ?8, ?1
       FROM collab_forms f JOIN items i ON i.id = f.item_id
       ${listening("'form_response'")}
         AND f.item_id = ?2 AND f.tab_id = ?5 AND ?6 > f.responses AND ?8 >= ?1 - ?3`,
    )
    .bind(
      now,
      itemId,
      WEBHOOK_FRESH_MS,
      WEBHOOK_PENDING_MAX,
      tabId,
      form.responses,
      form.heading,
      Math.min(form.latestAt, now),
    );
}

/** One mention's delivery to the webhooks of one scope (mentions.ts decides which scopes may hear it). */
export type MentionDelivery = {
  // `mn:<item>:<tab>:<element>:<comments>:<person>`: the same however often the push is sent.
  id: string;
  scope: string;
  actorId: string | null;
  actorName: string | null;
  detail: { text: string; on: string; mentionedId: string };
  at: number;
};

/** The statement queuing a collab push's mentions, each for the live webhooks of the scope it names. */
export function mentionsStatement(
  db: D1Database,
  itemId: string,
  rows: readonly MentionDelivery[],
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  return db
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
         (webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, next_at)
       SELECT w.id, j.value ->> '$.id', 'mention', i.app, i.id, i.title, j.value ->> '$.actorId',
              j.value ->> '$.actorName', j.value ->> '$.detail', j.value ->> '$.at', ?1
       FROM items i JOIN json_each(?2) j
       ${listening("'mention'", "(j.value ->> '$.scope')")}
         AND i.id = ?5 AND (j.value ->> '$.at') >= ?1 - ?3`,
    )
    .bind(
      now,
      JSON.stringify(rows.map((r) => ({ ...r, detail: JSON.stringify(r.detail) }))),
      WEBHOOK_FRESH_MS,
      WEBHOOK_PENDING_MAX,
      itemId,
    );
}

/** Send Test's `ping`, due now, written only while the webhook is not paused (no row written: it was paused). The
 *  check is in the statement, so a pause landing after the route read the webhook can't leave a row behind. */
export function pingStatement(db: D1Database, webhookId: string, name: string, now = Date.now()) {
  queued++;
  return db
    .prepare(
      `INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, item_id, title, occurred_at, next_at)
       SELECT ?1, ?2, 'ping', 'liveworkspace', NULL, ?3, ?4, ?4
       WHERE EXISTS (SELECT 1 FROM webhooks WHERE id = ?1 AND paused_at IS NULL)`,
    )
    .bind(webhookId, `ping:${crypto.randomUUID()}`, name, now);
}

/** The one dispatcher. */
export function dispatcherOf(env: Env) {
  return env.WEBHOOKS!.get(env.WEBHOOKS!.idFromName(DISPATCHER_NAME));
}

/**
 * After a request that may have queued deliveries: wakes the dispatcher when one is due. One indexed read, and a call
 * only when something waits. Never throws (it runs after the answer).
 */
export async function kickWebhooks(env: Env, now = Date.now()): Promise<boolean> {
  if (!env.WEBHOOKS) return false;
  try {
    const due = await env.INDEX_DB.prepare(
      `SELECT 1 AS due FROM webhook_deliveries WHERE state = 'pending' AND next_at <= ? LIMIT 1`,
    )
      .bind(now + 1_000)
      .first();
    if (!due) return false;
    await dispatcherOf(env).kick();
    return true;
  } catch (error) {
    console.warn('[index] webhooks kick failed', String(error));
    return false;
  }
}
