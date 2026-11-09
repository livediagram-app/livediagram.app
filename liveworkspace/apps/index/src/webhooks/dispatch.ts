// Sending what is due (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"), run by the dispatcher's alarm
// (durable-object.ts), never in a request: at most DISPATCH_BATCH deliveries a run, DISPATCH_CONCURRENCY webhooks at
// once, each webhook's in order. Before a webhook sends, its creator must still be able to edit all of its document
// (creatorCanEdit); before any sends, its host must still resolve only to public addresses. A delivery that fails is tried again after the
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
import type { PersonTeams } from '../accounts-access';
import { LIVE_LINK } from '../rows';
import { parseWebhookUrl, resolvesPublic, type Resolve } from './address';
import {
  ACCESS_RETRY_MS,
  DELIVERY_TIMEOUT_MS,
  DISPATCH_BATCH,
  DISPATCH_CONCURRENCY,
  DISPATCH_MIN_GAP_MS,
  FAILING_PAUSE_AFTER,
  RETRY_DELAYS_MS,
} from './config';
import { bodyFor, type DeliveryEvent } from './messages';
import { signatureOf } from './sign';

export type DispatchDeps = {
  now: () => number;
  fetch: typeof fetch;
  resolve: Resolve;
  personTeams: PersonTeams;
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
  // The webhook's document (a ping's own item_id is empty), its owner and team.
  document_id: string;
  owner_id: string;
  team_id: string | null;
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

/**
 * Whether a webhook's creator can still edit all of its document, as the access rule says (access.ts): its owner (a
 * personal one), a member of its team now, or holding a live Editor link to every tab under Shared. Null when accounts
 * can't say whether they are still in the team.
 */
async function creatorCanEdit(
  env: Env,
  head: Pick<DueRow, 'document_id' | 'owner_id' | 'team_id' | 'created_by'>,
  teamsOf: (personId: string) => Promise<ReadonlySet<string> | null>,
  now: number,
): Promise<boolean | null> {
  if (head.team_id === null && head.owner_id === head.created_by) return true;
  const link = await env.INDEX_DB.prepare(
    `SELECT 1 FROM shared_with sw
     JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
     WHERE sw.person_id = ? AND sw.item_id = ? AND sl.level = 'edit' AND sl.tab_id IS NULL AND ${LIVE_LINK('sl')}`,
  )
    .bind(head.created_by, head.document_id, now)
    .first();
  if (link) return true;
  if (head.team_id === null) return false;
  const teams = await teamsOf(head.created_by);
  return teams && teams.has(head.team_id);
}

/** One webhook's due deliveries, in order. */
async function runWebhook(
  env: Env,
  deps: DispatchDeps,
  key: CryptoKey,
  rows: DueRow[],
  teamsOf: (personId: string) => Promise<ReadonlySet<string> | null>,
  hosts: Map<string, Promise<'public' | 'private' | 'unresolved'>>,
  counts: Counts,
): Promise<void> {
  const db = env.INDEX_DB;
  const head = rows[0]!;
  const now = deps.now();
  // Every pending delivery of the webhook from `fromId` on waits until then, the ones past this run's batch too, so
  // none overtakes the one held (webhooks.md "Delivery": in order).
  const holdFrom = (until: number, fromId: number) =>
    db
      .prepare(
        `UPDATE webhook_deliveries SET next_at = MAX(next_at, ?1)
         WHERE webhook_id = ?2 AND state = 'pending' AND id >= ?3`,
      )
      .bind(until, head.webhook_id, fromId);

  // Its creator must still edit the whole document. Accounts not answering holds them, uncounted.
  const can = await creatorCanEdit(env, head, teamsOf, now);
  if (can === null) {
    await holdFrom(now + ACCESS_RETRY_MS, head.id).run();
    counts.retrying += rows.length;
    return;
  }
  if (!can) {
    await db.batch(pauseStatements(db, head.webhook_id, 'creator_left', now));
    counts.failed += rows.length;
    return;
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
        holdFrom(next, row.id + 1),
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
                  d.detail, d.occurred_at, d.attempts, w.item_id AS document_id, i.owner_id, i.team_id, w.kind,
                  w.url_sealed, w.secret_sealed, w.created_by
           FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id JOIN items i ON i.id = w.item_id
           -- In order per webhook: a row waits while an earlier one of its webhook is not yet due.
           WHERE d.state = 'pending' AND d.next_at <= ?1 AND w.paused_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM webhook_deliveries p
                             WHERE p.webhook_id = d.webhook_id AND p.state = 'pending' AND p.id < d.id
                               AND p.next_at > ?1)
           ORDER BY d.id LIMIT ?2`,
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
  const teamsCache = new Map<string, Promise<ReadonlySet<string> | null>>();
  const teamsOf = (personId: string) => {
    let found = teamsCache.get(personId);
    if (!found) {
      found = deps.personTeams(personId);
      teamsCache.set(personId, found);
    }
    return found;
  };
  const hosts = new Map<string, Promise<'public' | 'private' | 'unresolved'>>();
  const groups = [...byWebhook.values()];
  for (let i = 0; i < groups.length; i += DISPATCH_CONCURRENCY) {
    await Promise.all(
      groups
        .slice(i, i + DISPATCH_CONCURRENCY)
        .map((rows) => runWebhook(env, deps, key, rows, teamsOf, hosts, counts)),
    );
  }
  if (due.length >= DISPATCH_BATCH) return { ...counts, nextAt: deps.now() };
  // Only what the due read can take: a pending row on a paused webhook is never sent, so it must not set the alarm
  // either (it would loop). The due index in order, stopping at the first webhook not paused.
  const next = await db
    .prepare(
      `SELECT d.next_at AS next FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
       WHERE d.state = 'pending' AND w.paused_at IS NULL ORDER BY d.next_at LIMIT 1`,
    )
    .first<{ next: number }>();
  return {
    ...counts,
    nextAt: next ? Math.max(next.next, deps.now() + DISPATCH_MIN_GAP_MS) : null,
  };
}
