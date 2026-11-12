// An Incoming Webhook rule's secret and the calls that start it, inside the plan's room
// (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint automations.md "Phase 3"). The secret is made
// here and shown once; the plan keeps only its SHA-256 hash (`automation_hooks`, the schema's step V20), its last 4
// characters, when it was made and last used, and its rate limit's minute. A call proves it holds the secret by
// `Authorization: Bearer lwh_…` or by an HMAC-SHA256 of its raw body in `X-Liveplanner-Signature: sha256=<hex>`, both
// compared in constant time. Every refusal before the proof (no plan, no rule, a rule off or of another trigger, no
// secret made, a wrong one) is the same 401, after the same work, so a caller learns nothing of what exists. A call
// that passes is counted in its rule's minute (60), checked against the plan's day (1,000 runs), read (its cards by
// number, the values the rule names), and queued as one `incoming` event per card, or one with no card. Nothing here
// logs or answers the secret, its hash, a signature or the body.
import {
  AUTOMATION_RUNS_PER_DAY,
  INCOMING_WEBHOOK_PERSON,
  WEBHOOK_CALLS_PER_MINUTE,
  WEBHOOK_SECRET_BYTES,
  WEBHOOK_SECRET_PREFIX,
  isTrashed,
  readHookBody,
  webhookPathsIn,
  webhookValues,
  type AutomationEvent,
  type AutomationRule,
} from '@liveplanner/items';
import type { AutomationHookInfo } from '@liveplanner/api-schema';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { readItems } from '../../db/items';
import { appBaseUrl } from '../../email/client';
import type { PlanEnv } from '../../types';
import { runsToday } from './automation-log';
import { enqueueStatement, type PlanAutomations } from './automation-queue';
import type { Sql } from './automation-store';
import { reportServerEvent } from '../../server-telemetry';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNATURE_PREFIX = 'sha256=';
// What an unknown rule's proof is checked against, so a refusal takes the same work as a wrong secret's.
const NO_HASH = '0'.repeat(64);

// A call as the worker read it: the raw body (its bytes, as signed) and the two headers that may prove it.
export type HookCall = { body: Uint8Array; authorization: string | null; signature: string | null };
// The room's answer, made into a response by the worker (routes/automation-hook-routes.ts).
export type HookAnswer = { status: number; body: Record<string, unknown>; retryAfter?: number };

const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (text: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

function bytesOfHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** HMAC-SHA256 of `body` keyed with the secret's hash, as hex: equal to the HMAC keyed with the secret itself, since
 *  the secret is longer than the hash's 64-byte block (RFC 2104 §2). */
export async function signatureOf(hash: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bytesOfHex(hash),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, body));
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A new secret: `lwh_` and 64 random bytes, base64url (90 characters). */
export const newHookSecret = (): string =>
  `${WEBHOOK_SECRET_PREFIX}${base64url(crypto.getRandomValues(new Uint8Array(WEBHOOK_SECRET_BYTES)))}`;

// ---- Storage ---------------------------------------------------------------------------------------------------------

type HookRow = { hash: string; last4: string; made_at: number; used_at: number | null };

function hookRow(sql: Sql, ruleId: string): HookRow | null {
  const row = sql
    .exec('SELECT hash, last4, made_at, used_at FROM automation_hooks WHERE rule_id = ?', ruleId)
    .toArray()[0] as unknown as HookRow | undefined;
  return row ?? null;
}

/** The rule's address, on the app's own origin. */
export const hookUrl = (env: PlanEnv, planId: string, ruleId: string): string =>
  `${appBaseUrl(env)}/api/hooks/automations/${encodeURIComponent(planId)}/${encodeURIComponent(ruleId)}`;

const infoOf = (url: string, row: HookRow | undefined): AutomationHookInfo => ({
  url,
  secret: row
    ? {
        last4: row.last4,
        madeAt: Number(row.made_at),
        usedAt: row.used_at === null ? null : Number(row.used_at),
      }
    : null,
});

/** Every Incoming Webhook rule's address and secret as an Editor sees them, by rule. Never the hash. */
export function hookInfos(
  env: PlanEnv,
  planId: string,
  sql: Sql,
  rules: readonly AutomationRule[],
): Map<string, AutomationHookInfo> {
  const incoming = rules.filter((r) => r.trigger.kind === 'incoming_webhook');
  const out = new Map<string, AutomationHookInfo>();
  if (incoming.length === 0) return out;
  const rows = sql
    .exec('SELECT rule_id, last4, made_at, used_at FROM automation_hooks')
    .toArray() as unknown as (HookRow & { rule_id: string })[];
  const byRule = new Map(rows.map((r) => [r.rule_id, r]));
  for (const rule of incoming)
    out.set(rule.id, infoOf(hookUrl(env, planId, rule.id), byRule.get(rule.id)));
  return out;
}

/** A new secret for the rule, replacing any it had (Regenerate: the old one stops at once). Answers the secret,
 *  which is never kept, and the hook as the list shows it. */
export async function makeHookSecret(
  env: PlanEnv,
  planId: string,
  sql: Sql,
  ruleId: string,
  now: number,
): Promise<{ secret: string; hook: AutomationHookInfo }> {
  const secret = newHookSecret();
  const row: HookRow = {
    hash: await sha256Hex(secret),
    last4: secret.slice(-4),
    made_at: now,
    used_at: null,
  };
  sql.exec(
    `INSERT INTO automation_hooks (rule_id, hash, last4, made_at, used_at, window_at, window_calls)
     VALUES (?, ?, ?, ?, NULL, 0, 0)
     ON CONFLICT (rule_id) DO UPDATE SET hash = excluded.hash, last4 = excluded.last4,
       made_at = excluded.made_at, used_at = NULL, window_at = 0, window_calls = 0`,
    ruleId,
    row.hash,
    row.last4,
    now,
  );
  return { secret, hook: infoOf(hookUrl(env, planId, ruleId), row) };
}

// ---- A call ----------------------------------------------------------------------------------------------------------

/** Whether the call proves it holds the secret whose hash is `hash` (null: none, checked against a dummy all the
 *  same). The Bearer is hashed and compared; else the signature is worked out and compared; both in constant time. */
export async function provesSecret(call: HookCall, hash: string | null): Promise<boolean> {
  const stored = hash ?? NO_HASH;
  const auth = call.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  let ok = false;
  if (bearer) ok = await timingSafeEqual(await sha256Hex(bearer), stored);
  else if (call.signature?.startsWith(SIGNATURE_PREFIX)) {
    const sent = call.signature.slice(SIGNATURE_PREFIX.length).trim().toLowerCase();
    ok = await timingSafeEqual(await signatureOf(stored, call.body), sent);
  }
  return ok && hash !== null;
}

const UNAUTHORIZED: HookAnswer = { status: 401, body: { error: 'webhook_unauthorized' } };

const log = (answer: string, queued = 0) => console.info('[automations] hook', { answer, queued });

// The rule's minute: this call counted in it, and the last use stamped, in one statement (every SET reads the row as
// it was). Answers the calls so far and when the minute started.
function countCall(sql: Sql, ruleId: string, now: number): { calls: number; since: number } {
  const row = sql
    .exec(
      `UPDATE automation_hooks SET used_at = ?,
         window_calls = CASE WHEN window_at + ? > ? THEN window_calls + 1 ELSE 1 END,
         window_at = CASE WHEN window_at + ? > ? THEN window_at ELSE ? END
       WHERE rule_id = ? RETURNING window_at, window_calls`,
      now,
      MINUTE_MS,
      now,
      MINUTE_MS,
      now,
      now,
      ruleId,
    )
    .toArray()[0];
  return { calls: Number(row?.['window_calls'] ?? 0), since: Number(row?.['window_at'] ?? now) };
}

// The cards the call names, by number, that the plan holds out of the Trash, in the order named.
async function namedCards(
  env: PlanEnv,
  planId: string,
  numbers: readonly number[],
): Promise<{ id: string; key: number }[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT id FROM items WHERE plan_id = ? AND item_key IN (SELECT value FROM json_each(?))`,
  )
    .bind(planId, JSON.stringify(numbers))
    .all<{ id: string }>();
  const ids = (res.results ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const items = (await readItems(env, planId, ids)).filter((i) => !isTrashed(i));
  const byKey = new Map(items.map((i) => [i.key, i]));
  return numbers.flatMap((n) => {
    const item = byKey.get(n);
    return item ? [{ id: item.id, key: item.key }] : [];
  });
}

function parsed(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body));
  } catch {
    return undefined;
  }
}

/** One call to the rule's address, as the room answers it (`schema`: whether the plan has one; an id nothing has
 *  written has none, and is answered without making one). */
export async function answerHookCall(
  input: { env: PlanEnv; planId: string; automations: PlanAutomations; schema: boolean },
  ruleId: string,
  call: HookCall,
  now: number,
): Promise<HookAnswer> {
  const { env, planId, automations } = input;
  const rule = input.schema ? automations.store.get(ruleId) : null;
  const live = rule?.enabled && rule.trigger.kind === 'incoming_webhook' ? rule : null;
  const row = live ? hookRow(automations.sql(), ruleId) : null;
  // Counted only once the address names a live webhook rule, so strangers trying addresses count nothing.
  const defer = (p: Promise<void>) => automations.deps()?.defer(p);
  if (!(await provesSecret(call, row?.hash ?? null)) || !live) {
    log('unauthorized');
    if (live) defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookUnauthorized'));
    return UNAUTHORIZED;
  }
  const sql = automations.sql();
  const minute = countCall(sql, ruleId, now);
  if (minute.calls > WEBHOOK_CALLS_PER_MINUTE) {
    log('rate_limited');
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookRateLimited'));
    return {
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: Math.max(1, Math.ceil((minute.since + MINUTE_MS - now) / 1000)),
    };
  }
  if (runsToday(sql, now) >= AUTOMATION_RUNS_PER_DAY) {
    log('budget');
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookBudget'));
    const midnight = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
    return {
      status: 429,
      body: { error: 'automation_budget_spent' },
      retryAfter: Math.max(1, Math.ceil((midnight - now) / 1000)),
    };
  }
  const read = readHookBody(parsed(call.body));
  if ('error' in read) {
    log('invalid');
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookInvalid'));
    return { status: 400, body: { error: 'webhook_body_invalid', message: read.error } };
  }
  const cards = read.cards.length ? await namedCards(env, planId, read.cards) : null;
  const webhook = webhookValues(read.payload, webhookPathsIn(live.steps));
  const callId = crypto.randomUUID();
  const event = (cardId: string): AutomationEvent => ({
    id: `w:${callId}:${cardId || '-'}`,
    kind: 'incoming',
    cardId,
    by: INCOMING_WEBHOOK_PERSON,
    role: 'system',
    ruleId,
    webhook,
    cards: read.cards.length,
    at: now,
  });
  const events = cards ? cards.map((c) => event(c.id)) : [event('')];
  defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookAccepted'));
  if (events.length === 0) {
    log('accepted');
    return { status: 202, body: { queued: 0 } };
  }
  const res = await enqueueStatement(env.PLAN_DB, events, now).run();
  const queued = Number(res.meta.changes ?? 0);
  automations.queued(events.length - queued);
  log('accepted', queued);
  return { status: 202, body: { queued } };
}
