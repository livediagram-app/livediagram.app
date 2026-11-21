// An Incoming Webhook rule's secret and the calls that start it, inside the plan's room
// (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint automations.md "Phase 3"). The secret is made
// here and shown once; the plan keeps only its SHA-256 hash (`automation_hooks`, the schema's step V20), its last 4
// characters, when it was made and last used, and its rate limit's minute. A call proves it holds the secret by
// `Authorization: Bearer lwh_…` or by an HMAC-SHA256 of `<timestamp>.<body>` in `X-Liveplanner-Signature:
// sha256=<hex>` with the unix seconds in `X-Liveworkspace-Timestamp`, both compared in constant time. A signed call more
// than 5 minutes off, or one whose signature the rule took in the last 10 minutes (a replay), fails the proof. Every
// refusal before the proof (no plan, no rule, a rule off or of another trigger, no secret made, a wrong one, a stale
// or replayed signature) is the same 401, after the same work, so a caller learns nothing of what exists. A call
// that passes is counted in its rule's minute (60), checked against the plan's day (1,000 runs), read (its cards by
// number, the values the rule names), and queued as one `incoming` event per card, or one with no card. Nothing here
// logs or answers the secret, its hash, a signature or the body. The secret's making, its proof and the rule's minute
// are @liveworkspace/automations/room's (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The room
// entry"); the plan's address, the cards a call names and the answer are here.
import {
  AUTOMATION_RUNS_PER_DAY,
  INCOMING_WEBHOOK_PERSON,
  WEBHOOK_CALLS_PER_MINUTE,
  isTrashed,
  readHookBody,
  webhookPathsIn,
  webhookValues,
  type AutomationEvent,
  type AutomationRule,
} from '@liveplanner/items';
import type { AutomationHookInfo } from '@liveplanner/api-schema';
import {
  HOOK_UNAUTHORIZED as UNAUTHORIZED,
  countHookCall,
  hookHash,
  hookInfos as hooksOf,
  hookJson,
  hookReplayed,
  hookRetryAfter,
  makeHookSecret as makeSecret,
  provesSecret,
  takeHookSignature,
  type HookAnswer,
  type HookCall,
} from '@liveworkspace/automations/room';
import { readItems } from '../../db/items';
import { appBaseUrl } from '../../email/client';
import type { PlanEnv } from '../../types';
import { runsToday } from './automation-log';
import { enqueueStatement, type PlanAutomations } from './automation-queue';
import type { Sql } from './automation-store';
import { reportServerEvent } from '../../server-telemetry';

export {
  newHookSecret,
  provesSecret,
  sha256Hex,
  signatureOf,
  type HookAnswer,
  type HookCall,
} from '@liveworkspace/automations/room';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rule's address, on the app's own origin. */
export const hookUrl = (env: PlanEnv, planId: string, ruleId: string): string =>
  `${appBaseUrl(env)}/api/hooks/automations/${encodeURIComponent(planId)}/${encodeURIComponent(ruleId)}`;

/** Every Incoming Webhook rule's address and secret as an Editor sees them, by rule. Never the hash. */
export const hookInfos = (
  env: PlanEnv,
  planId: string,
  sql: Sql,
  rules: readonly AutomationRule[],
): Map<string, AutomationHookInfo> => hooksOf((ruleId) => hookUrl(env, planId, ruleId), sql, rules);

/** A new secret for the rule, replacing any it had (Regenerate: the old one stops at once). Answers the secret,
 *  which is never kept, and the hook as the list shows it. */
export const makeHookSecret = (
  env: PlanEnv,
  planId: string,
  sql: Sql,
  ruleId: string,
  now: number,
): Promise<{ secret: string; hook: AutomationHookInfo }> =>
  makeSecret((id) => hookUrl(env, planId, id), sql, ruleId, now);

// ---- A call ----------------------------------------------------------------------------------------------------------

const log = (answer: string, queued = 0) => console.info('[automations] hook', { answer, queued });

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

/** One call to the rule's address, as the room answers it (`schema`: whether the plan has one; an id nothing has
 *  written has none, and is answered without making one). */
export async function answerHookCall(
  input: {
    env: PlanEnv;
    planId: string;
    automations: PlanAutomations;
    schema: boolean;
    // The plan is archived or in the Trash (plan-standing.ts): the call is taken and nothing runs.
    putAway?: boolean;
  },
  ruleId: string,
  call: HookCall,
  now: number,
): Promise<HookAnswer> {
  const { env, planId, automations } = input;
  const rule = input.schema ? automations.store.get(ruleId) : null;
  const live = rule?.enabled && rule.trigger.kind === 'incoming_webhook' ? rule : null;
  const hash = live ? hookHash(automations.sql(), ruleId) : null;
  // Counted only once the address names a live webhook rule, so strangers trying addresses count nothing.
  const defer = (p: Promise<void>) => automations.deps()?.defer(p);
  // A replay is read with no await before its signature is kept below, so two copies of one call never both pass.
  const proved = await provesSecret(call, hash, now);
  if (!proved || !live || hookReplayed(automations.sql(), ruleId, call, now)) {
    log('unauthorized');
    if (live) defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookUnauthorized'));
    return UNAUTHORIZED;
  }
  if (input.putAway) {
    log('put_away');
    return { status: 202, body: { queued: 0 } };
  }
  const sql = automations.sql();
  const minute = countHookCall(sql, ruleId, now);
  if (minute.calls > WEBHOOK_CALLS_PER_MINUTE) {
    log('rate_limited');
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookRateLimited'));
    return {
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: hookRetryAfter(minute.since, now),
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
  const read = readHookBody(hookJson(call.body));
  if ('error' in read) {
    log('invalid');
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationHookInvalid'));
    return { status: 400, body: { error: 'webhook_body_invalid', message: read.error } };
  }
  takeHookSignature(sql, ruleId, call, now);
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
