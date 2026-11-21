// Connections' outbox (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"): a pending delivery per message a
// connection is asked to send, written by the request that asks, so none waits on the network. A connection hears no
// events: the only deliveries are a rule's send (`automation`) and Send Test's (`ping`). After the response the
// request wakes the dispatcher (durable-object.ts), whose alarm sends.
//
// `queuedCount` moves on whenever a statement is built, so a request knows (by comparing before and after) whether it
// might have queued something and is worth a wake; a concurrent request in the same isolate can only add a spare
// wake, never take one away.

import { WEBHOOK_PENDING_MAX, type WebhookPauseReason } from '@liveworkspace/index-client';
import type { Env } from '../env';
import { DISPATCHER_NAME } from './config';
import type { AutomationDetail } from './messages';

let queued = 0;
export const queuedCount = () => queued;

// When a new delivery is first due: now, or, while the webhook's newest pending one waits for a retry, not before it,
// so one webhook's deliveries go in order (webhooks.md "Delivery"). A retry holds every later one to its own time
// (dispatch.ts), so the newest pending row's time is the latest: one seek on (webhook_id, state, id).
const dueAt = (now: string, webhook: string) =>
  `MAX(${now}, COALESCE((SELECT p.next_at FROM webhook_deliveries p WHERE p.webhook_id = ${webhook}
     AND p.state = 'pending' ORDER BY p.id DESC LIMIT 1), ${now}))`;

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
 * The statement queuing automation sends (webhooks.md "Automation sends"): each addressed to the one connection it
 * names, and no other hears it. No actor (`Automation` by name). The item, the connection being live and the pending
 * cap are checked again inside the insert, so a pause or a burst landing after the push's read can't put a row past
 * them. The count is read once, before any row is written, so each row adds `ahead`, its place among the push's
 * sends to the same connection.
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
