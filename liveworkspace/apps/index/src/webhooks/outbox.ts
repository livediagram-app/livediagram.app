// Webhooks' outbox (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"): a pending delivery per (webhook,
// event), written by a statement that rides the batch recording the event, so no write path can forget one and none
// waits on the network. After the response the request wakes the dispatcher (durable-object.ts), whose alarm sends.
//
// Each statement reads the event's item and that item's own live webhooks through an index: with none listening it
// writes nothing. `queuedCount` moves on whenever a statement is built, so a request knows (by comparing before and
// after) whether it might have queued something and is worth a wake; a concurrent request in the same isolate can only
// add a spare wake, never take one away.

import {
  WEBHOOK_EVENTS,
  WEBHOOK_PENDING_MAX,
  type CardMove,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
import type { Env } from '../env';
import { DISPATCHER_NAME, WEBHOOK_FRESH_MS } from './config';
import type { AutomationDetail } from './messages';

const LISTENED: ReadonlySet<string> = new Set(WEBHOOK_EVENTS);

/** Whether some webhook could listen for a Timeline event of this type. */
export const isListened = (type: string) => LISTENED.has(type);

let queued = 0;
export const queuedCount = () => queued;

// The item's own live webhooks listening for `type`, under their pending cap. A webhook holds its events comma-wrapped
// (`,shared,`). One set to Only Me (`who = 'me'`) hears only what its creator did: `actor` is the event's person, and
// an event without one (a form response) never reaches it. `w`, `i` and the event's columns come from the statement
// around it; `?4` is WEBHOOK_PENDING_MAX. The pending count is read once, before any row of the statement is written
// (SQLite fills an insert that reads its own table from a finished select), so a statement queuing several rows from a
// JSON list passes `ahead`, the row's place in it, and a batch stops at the cap rather than going past it. A place
// counts every earlier entry, listened for or not, so a list near the cap may stop a few short of it, never over.
const listening = (
  type: string,
  actor: string,
  ahead = '0',
) => `JOIN webhooks w ON w.item_id = i.id AND w.paused_at IS NULL
  WHERE instr(w.events, ',' || ${type} || ',') > 0
    AND (w.who = 'anyone' OR w.created_by = ${actor})
    AND (SELECT COUNT(*) FROM (SELECT 1 FROM webhook_deliveries p
         WHERE p.webhook_id = w.id AND p.state = 'pending' LIMIT ?4)) + ${ahead} < ?4`;

// When a new delivery is first due: now, or, while the webhook's newest pending one waits for a retry, not before it,
// so one webhook's deliveries go in order (webhooks.md "Delivery"). A retry holds every later one to its own time
// (dispatch.ts), so the newest pending row's time is the latest: one seek on (webhook_id, state, id).
const dueAt = (now: string, webhook: string) =>
  `MAX(${now}, COALESCE((SELECT p.next_at FROM webhook_deliveries p WHERE p.webhook_id = ${webhook}
     AND p.state = 'pending' ORDER BY p.id DESC LIMIT 1), ${now}))`;

/** The statement queuing these Timeline events for their item's own webhooks; it goes after the events' own. */
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
       SELECT w.id, e.id, e.type, e.app, e.item_id, e.title, e.actor_id, e.actor_name, e.detail, e.occurred_at,
              ${dueAt('?1', 'w.id')}
       FROM json_each(?2) j
       JOIN timeline_events e ON e.id = j.value
       JOIN items i ON i.id = e.item_id
       ${listening('e.type', 'e.actor_id', 'j.key')}
         AND e.occurred_at >= ?1 - ?3`,
    )
    .bind(now, JSON.stringify(eventIds), WEBHOOK_FRESH_MS, WEBHOOK_PENDING_MAX);
}

/** The id of a card move's delivery: the same however often the plan sends it. */
export const cardMoveId = (itemId: string, move: Pick<CardMove, 'cardId' | 'at'>) =>
  `cmv:${itemId}:${move.cardId}:${move.at}`;

/** The statement queuing a plan's card moves for its own webhooks (they are not Timeline events). */
export function cardMovesStatement(
  db: D1Database,
  itemId: string,
  moves: readonly CardMove[],
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  const rows = moves.map((m) => ({
    id: cardMoveId(itemId, m),
    by: m.actorId ?? null,
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
       SELECT w.id, j.value ->> '$.id', 'card_moved', i.app, i.id, i.title, j.value ->> '$.by', j.value ->> '$.name',
              j.value ->> '$.detail', j.value ->> '$.at', ${dueAt('?1', 'w.id')}
       FROM items i JOIN json_each(?2) j
       ${listening("'card_moved'", "(j.value ->> '$.by')", 'j.key')}
         AND i.id = ?5 AND (j.value ->> '$.at') >= ?1 - ?3`,
    )
    .bind(now, JSON.stringify(rows), WEBHOOK_FRESH_MS, WEBHOOK_PENDING_MAX, itemId);
}

/** A form's new responses as the plan pushes them (`PUT /app/items/:id/forms/:tabId`). */
export type FormResponses = { heading: string; responses: number; latestAt: number };

/**
 * The statement queuing a live form's new responses for its plan's own webhooks: one delivery for the rise from
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
              ?8, ${dueAt('?1', 'w.id')}
       FROM collab_forms f JOIN items i ON i.id = f.item_id
       ${listening("'form_response'", 'NULL')}
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

/** A webhook an automation send names, as the push reads it: whether it is paused, and how many wait (stopped at
 *  WEBHOOK_PENDING_MAX). */
export type AutomationTarget = {
  id: string;
  paused_at: number | null;
  paused_reason: WebhookPauseReason | null;
  pending: number;
};

/**
 * One round trip settling a push of automation sends: the named webhooks that are this item's own, and which of the
 * sends' deliveries are already written (a retried run's). `sends` pairs each webhook id with its delivery's id.
 */
export async function automationTargets(
  db: D1Database,
  itemId: string,
  sends: readonly { webhookId: string; id: string }[],
): Promise<{ webhooks: AutomationTarget[]; written: Set<string> }> {
  const pairs = JSON.stringify(sends.map((s) => ({ w: s.webhookId, e: s.id })));
  const [webhooks, written] = await db.batch([
    db
      .prepare(
        `SELECT w.id, w.paused_at, w.paused_reason,
                (SELECT COUNT(*) FROM (SELECT 1 FROM webhook_deliveries p
                 WHERE p.webhook_id = w.id AND p.state = 'pending' LIMIT ?3)) AS pending
         FROM webhooks w WHERE w.item_id = ?1 AND w.id IN (SELECT j.value ->> '$.w' FROM json_each(?2) j)`,
      )
      .bind(itemId, pairs, WEBHOOK_PENDING_MAX),
    db
      .prepare(
        `SELECT d.webhook_id || ' ' || d.event_id AS pair FROM json_each(?1) j
         JOIN webhook_deliveries d ON d.webhook_id = j.value ->> '$.w' AND d.event_id = j.value ->> '$.e'`,
      )
      .bind(pairs),
  ]);
  return {
    webhooks: (webhooks!.results ?? []) as AutomationTarget[],
    written: new Set(((written!.results ?? []) as { pair: string }[]).map((r) => r.pair)),
  };
}

/** An automation send the push settled as queued: its delivery's id, webhook, place among that webhook's queued ones
 *  in the push, time and detail. */
export type QueuedAutomationSend = {
  id: string;
  webhookId: string;
  ahead: number;
  at: number;
  detail: AutomationDetail;
};

/**
 * The statement queuing automation sends (webhooks.md "Automation sends"): each addressed to the one webhook it names,
 * so the webhook's events and Who Did It are not read, and no other webhook hears it. No actor (`Automation` by
 * name). The item, the webhook being live and the pending cap are checked again inside the insert, so a pause or a
 * burst landing after the push's read can't put a row past them.
 */
export function automationSendStatement(
  db: D1Database,
  itemId: string,
  sends: readonly QueuedAutomationSend[],
  now = Date.now(),
): D1PreparedStatement {
  queued++;
  const rows = sends.map((s) => ({
    id: s.id,
    w: s.webhookId,
    ahead: s.ahead,
    at: s.at,
    detail: JSON.stringify(s.detail),
  }));
  return db
    .prepare(
      `INSERT OR IGNORE INTO webhook_deliveries
         (webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, next_at)
       SELECT w.id, j.value ->> '$.id', 'automation', i.app, i.id, i.title, NULL, 'Automation',
              j.value ->> '$.detail', j.value ->> '$.at', ${dueAt('?1', 'w.id')}
       FROM json_each(?2) j
       JOIN webhooks w ON w.id = j.value ->> '$.w' AND w.item_id = ?3 AND w.paused_at IS NULL
       JOIN items i ON i.id = w.item_id
       WHERE (SELECT COUNT(*) FROM (SELECT 1 FROM webhook_deliveries p
              WHERE p.webhook_id = w.id AND p.state = 'pending' LIMIT ?4)) + (j.value ->> '$.ahead') < ?4`,
    )
    .bind(now, JSON.stringify(rows), itemId, WEBHOOK_PENDING_MAX);
}

/** Send Test's `ping`, due now (behind a retry the webhook is waiting on, as any delivery), written only while the webhook is not paused (no row written: it was paused). The
 *  check is in the statement, so a pause landing after the route read the webhook can't leave a row behind. */
export function pingStatement(db: D1Database, webhookId: string, name: string, now = Date.now()) {
  queued++;
  return db
    .prepare(
      `INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, item_id, title, occurred_at, next_at)
       SELECT ?1, ?2, 'ping', 'liveworkspace', NULL, ?3, ?4, ${dueAt('?4', '?1')}
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
