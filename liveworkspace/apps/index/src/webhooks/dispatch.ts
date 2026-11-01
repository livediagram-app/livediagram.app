// Sending what is due (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"), run by the dispatcher's alarm
// (durable-object.ts), never in a request: at most DISPATCH_BATCH deliveries a run, DISPATCH_CONCURRENCY webhooks at
// once, each webhook's in order. Before a team webhook sends, its creator must still be an admin of the team; before
// any sends, its host must still resolve only to public addresses. A delivery that fails is tried again after the
// next of RETRY_DELAYS_MS, the webhook's later deliveries waiting behind it; one that runs out of tries, or meets an
// answer that won't change (a redirect, a 4xx), is given up, and FAILING_PAUSE_AFTER of those in a row pause it.

import { importSealKey, unseal } from '@liveworkspace/api-kit/sealed';
import {
  isApp,
  WEBHOOK_DELIVERIES_KEPT,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  type WebhookDeliveryType,
  type WebhookKind,
  type WebhookPauseReason,
} from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { appOrigin, type Env } from '../env';
import type { AdminTeams } from './access';
import { parseWebhookUrl, resolvesPublic, type Resolve } from './address';
import {
  ACCESS_RETRY_MS,
  DELIVERY_TIMEOUT_MS,
  DISPATCH_BATCH,
  DISPATCH_CONCURRENCY,
  FAILING_PAUSE_AFTER,
  RETRY_DELAYS_MS,
} from './config';
import { bodyFor, type DeliveryEvent } from './messages';
import { signatureOf } from './sign';

export type DispatchDeps = {
  now: () => number;
  fetch: typeof fetch;
  resolve: Resolve;
  adminTeams: AdminTeams;
};

export type DispatchResult = {
  delivered: number;
  failed: number;
  retrying: number;
  // When the alarm should run next: now when more was due than one run sends, the soonest retry, or null for nothing.
  nextAt: number | null;
};

type DueRow = {
  id: number;
  webhook_id: string;
  event_id: string;
  type: WebhookDeliveryType;
  app: string;
  item_id: string | null;
  title: string;
  actor_id: string | null;
  actor_name: string | null;
  detail: string | null;
  occurred_at: number;
  attempts: number;
  scope: string;
  kind: WebhookKind;
  url_sealed: string;
  secret_sealed: string | null;
  created_by: string;
};

// What one try came to.
type Outcome =
  | { kind: 'delivered'; status: number }
  | { kind: 'retry'; status: number | null; error: string | null }
  | { kind: 'final'; status: number | null; error: string | null; pause?: WebhookPauseReason };

/** The webhook's id bound into each sealed value, so one copied to another row doesn't open. */
export const urlContext = (webhookId: string) => `${webhookId}:url`;
export const secretContext = (webhookId: string) => `${webhookId}:secret`;

function parseDetail(text: string | null): Record<string, string | null> | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, string | null>) : null;
  } catch {
    return null;
  }
}

// The item's link in its app (a card's opens the card), or null for none.
function itemUrl(env: Env, row: DueRow, detail: Record<string, string | null> | null) {
  if (!row.item_id || !isApp(row.app)) return null;
  const origin = appOrigin(env, row.app);
  if (!origin) return null;
  const url = `${origin}${APP_ITEMS[row.app].itemPath}${encodeURIComponent(row.item_id)}`;
  return detail?.cardId ? `${url}#item=${encodeURIComponent(detail.cardId)}` : url;
}

const eventOf = (env: Env, row: DueRow): DeliveryEvent => {
  const detail = parseDetail(row.detail);
  return {
    eventId: row.event_id,
    type: row.type,
    app: row.app,
    itemId: row.item_id,
    title: row.title,
    actorId: row.actor_id,
    actorName: row.actor_name,
    detail,
    occurredAt: row.occurred_at,
    url: itemUrl(env, row, detail),
  };
};

const retryable = (status: number) => status === 408 || status === 429 || status >= 500;

async function send(
  deps: DispatchDeps,
  url: string,
  row: DueRow,
  body: string,
  secret: string | null,
): Promise<Outcome> {
  const timestamp = Math.floor(deps.now() / 1000);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'liveworkspace-webhooks/1',
    [WEBHOOK_EVENT_HEADER]: row.type,
    [WEBHOOK_DELIVERY_HEADER]: row.event_id,
    [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
  };
  if (secret) headers[WEBHOOK_SIGNATURE_HEADER] = await signatureOf(secret, timestamp, body);
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: 'POST',
      headers,
      body,
      // Never followed: an endpoint can't bounce a delivery to an address the check would refuse.
      redirect: 'manual',
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return { kind: 'retry', status: null, error: timedOut ? 'timeout' : 'network' };
  }
  // The answer's body is never read.
  await res.body?.cancel().catch(() => undefined);
  const status = res.status;
  if (status >= 200 && status < 300) return { kind: 'delivered', status };
  if (status >= 300 && status < 400) return { kind: 'final', status, error: 'redirect' };
  if (status === 410) return { kind: 'final', status, error: null, pause: 'gone' };
  if (retryable(status)) return { kind: 'retry', status, error: null };
  return { kind: 'final', status, error: null };
}

function pauseStatements(
  db: D1Database,
  webhookId: string,
  reason: WebhookPauseReason,
  now: number,
) {
  return [
    db
      .prepare(
        'UPDATE webhooks SET paused_at = ?, paused_reason = ? WHERE id = ? AND paused_at IS NULL',
      )
      .bind(now, reason, webhookId),
    db
      .prepare(
        `UPDATE webhook_deliveries SET state = 'failed', error = 'paused', next_at = ?
         WHERE webhook_id = ? AND state = 'pending'`,
      )
      .bind(now, webhookId),
  ];
}

const finishStatement = (
  db: D1Database,
  row: DueRow,
  state: 'delivered' | 'failed',
  o: Outcome,
  now: number,
) =>
  db
    .prepare(
      `UPDATE webhook_deliveries SET state = ?, attempts = attempts + 1, status = ?, error = ?, last_at = ?
       WHERE id = ?`,
    )
    .bind(state, o.status, o.kind === 'delivered' ? null : o.error, now, row.id);

// A webhook's finished deliveries past its newest WEBHOOK_DELIVERIES_KEPT.
const trimStatement = (db: D1Database, webhookId: string) =>
  db
    .prepare(
      `DELETE FROM webhook_deliveries WHERE id IN (
         SELECT id FROM webhook_deliveries WHERE webhook_id = ?1 AND state <> 'pending'
         ORDER BY id DESC LIMIT -1 OFFSET ?2)`,
    )
    .bind(webhookId, WEBHOOK_DELIVERIES_KEPT);

type Counts = { delivered: number; failed: number; retrying: number };

/** One webhook's due deliveries, in order. */
async function runWebhook(
  env: Env,
  deps: DispatchDeps,
  key: CryptoKey,
  rows: DueRow[],
  admins: (personId: string) => Promise<ReadonlySet<string> | null>,
  hosts: Map<string, Promise<'public' | 'private' | 'unresolved'>>,
  counts: Counts,
): Promise<void> {
  const db = env.INDEX_DB;
  const head = rows[0]!;
  const now = deps.now();
  const ids = JSON.stringify(rows.map((r) => r.id));
  const holdAll = (until: number) =>
    db
      .prepare(
        `UPDATE webhook_deliveries SET next_at = MAX(next_at, ?) WHERE id IN (SELECT value FROM json_each(?))`,
      )
      .bind(until, ids);

  // A team's: its creator must still run the team. Accounts not answering holds them, uncounted.
  if (head.scope.startsWith('t:')) {
    const teams = await admins(head.created_by);
    if (!teams) {
      await holdAll(now + ACCESS_RETRY_MS).run();
      counts.retrying += rows.length;
      return;
    }
    if (!teams.has(head.scope.slice(2))) {
      await db.batch(pauseStatements(db, head.webhook_id, 'creator_left', now));
      counts.failed += rows.length;
      return;
    }
  }

  const url = await unseal(key, urlContext(head.webhook_id), head.url_sealed);
  const secret =
    head.kind === 'json' && head.secret_sealed
      ? await unseal(key, secretContext(head.webhook_id), head.secret_sealed)
      : null;
  const parsed = url ? parseWebhookUrl(url, head.kind) : null;
  const target = parsed?.ok ? parsed.url.href : null;
  let refused: Outcome | null = null;
  if (!parsed?.ok || (head.kind === 'json' && !secret)) {
    // Sealed under another key, or not a URL this kind takes any more: nothing to send to.
    refused = { kind: 'final', status: null, error: 'unreadable' };
  } else {
    let check = hosts.get(parsed.host);
    if (!check) {
      check = resolvesPublic(parsed.host, deps.resolve);
      hosts.set(parsed.host, check);
    }
    const answer = await check;
    if (answer === 'private') refused = { kind: 'final', status: null, error: 'private_address' };
    if (answer === 'unresolved') refused = { kind: 'retry', status: null, error: 'dns' };
  }

  const statements: D1PreparedStatement[] = [];
  let failures = 0;
  let succeeded = false;
  let pause: WebhookPauseReason | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const outcome =
      refused ?? (await send(deps, target!, row, bodyFor(row.kind, eventOf(env, row)), secret));
    const at = deps.now();
    if (outcome.kind === 'delivered') {
      statements.push(finishStatement(db, row, 'delivered', outcome, at));
      counts.delivered++;
      succeeded = true;
      failures = 0;
      continue;
    }
    const delay = outcome.kind === 'retry' ? RETRY_DELAYS_MS[row.attempts] : undefined;
    if (delay !== undefined) {
      // Tried again later, and the webhook's later deliveries wait behind it.
      const next = at + delay;
      statements.push(
        db
          .prepare(
            `UPDATE webhook_deliveries SET attempts = attempts + 1, status = ?, error = ?, last_at = ?, next_at = ?
             WHERE id = ?`,
          )
          .bind(outcome.status, outcome.error, at, next, row.id),
        db
          .prepare(
            `UPDATE webhook_deliveries SET next_at = MAX(next_at, ?)
             WHERE id IN (SELECT value FROM json_each(?))`,
          )
          .bind(next, JSON.stringify(rows.slice(i + 1).map((r) => r.id))),
      );
      counts.retrying += rows.length - i;
      break;
    }
    statements.push(finishStatement(db, row, 'failed', outcome, at));
    counts.failed++;
    failures++;
    if (outcome.kind === 'final' && outcome.pause) {
      pause = outcome.pause;
      break;
    }
  }
  // Given up in a row: added to the count, or the count starts again after a success.
  const gaveUp = db
    .prepare(
      `UPDATE webhooks SET failures = CASE WHEN ?2 THEN ?3 ELSE failures + ?3 END WHERE id = ?1
       RETURNING failures`,
    )
    .bind(head.webhook_id, succeeded ? 1 : 0, failures);
  const results = await db.batch([...statements, gaveUp, trimStatement(db, head.webhook_id)]);
  const total = (results[statements.length]?.results?.[0] as { failures?: number } | undefined)
    ?.failures;
  if (!pause && (total ?? 0) >= FAILING_PAUSE_AFTER) pause = 'failing';
  if (pause) await db.batch(pauseStatements(db, head.webhook_id, pause, deps.now()));
}

/** One run: sends what is due and says when to run next. Without WEBHOOK_KEY nothing can be opened, so nothing is sent. */
export async function dispatch(env: Env, deps: DispatchDeps): Promise<DispatchResult> {
  const counts: Counts = { delivered: 0, failed: 0, retrying: 0 };
  const key = await importSealKey(env.WEBHOOK_KEY);
  if (!key) return { ...counts, nextAt: null };
  const db = env.INDEX_DB;
  const now = deps.now();
  const due =
    (
      await db
        .prepare(
          `SELECT d.id, d.webhook_id, d.event_id, d.type, d.app, d.item_id, d.title, d.actor_id, d.actor_name,
                  d.detail, d.occurred_at, d.attempts, w.scope, w.kind, w.url_sealed, w.secret_sealed, w.created_by
           FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
           WHERE d.state = 'pending' AND d.next_at <= ? AND w.paused_at IS NULL
           ORDER BY d.next_at, d.id LIMIT ?`,
        )
        .bind(now, DISPATCH_BATCH)
        .all<DueRow>()
    ).results ?? [];
  const byWebhook = new Map<string, DueRow[]>();
  for (const row of due) {
    const list = byWebhook.get(row.webhook_id) ?? [];
    list.push(row);
    byWebhook.set(row.webhook_id, list);
  }
  // Asked once a run per person, and each host resolved once a run.
  const adminsCache = new Map<string, Promise<ReadonlySet<string> | null>>();
  const admins = (personId: string) => {
    let found = adminsCache.get(personId);
    if (!found) {
      found = deps.adminTeams(personId);
      adminsCache.set(personId, found);
    }
    return found;
  };
  const hosts = new Map<string, Promise<'public' | 'private' | 'unresolved'>>();
  const groups = [...byWebhook.values()];
  for (let i = 0; i < groups.length; i += DISPATCH_CONCURRENCY) {
    await Promise.all(
      groups
        .slice(i, i + DISPATCH_CONCURRENCY)
        .map((rows) => runWebhook(env, deps, key, rows, admins, hosts, counts)),
    );
  }
  if (due.length >= DISPATCH_BATCH) return { ...counts, nextAt: deps.now() };
  const next = await db
    .prepare(`SELECT MIN(next_at) AS next FROM webhook_deliveries WHERE state = 'pending'`)
    .first<{ next: number | null }>();
  return { ...counts, nextAt: next?.next ?? null };
}
