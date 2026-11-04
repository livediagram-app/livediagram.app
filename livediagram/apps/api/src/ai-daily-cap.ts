// The deployment's daily cap on reader requests (docs/specs/021-event-storming/note-reader.md "Security").
//
// The per-IP limiter bounds one address to 20 a minute, which is still 28,800 a day, and guests are admitted, so on
// its own nothing bounds the provider bill. This counts every request the rest of the gate admitted, across the
// whole deployment, per UTC day. The count lives in one instance of the worker's existing PERSON_STORE Durable
// Object (no new binding, secret or migration), under a name no person id can take: ids are server-minted
// (`guest_<uuid>` or an account id), and none starts with `~`.

import type { Env } from './types';

/** Reader requests a UTC day when `AI_DAILY_CAP` is unset or not a positive whole number. */
export const AI_DAILY_CAP_DEFAULT = 1000;

/** The PERSON_STORE instance that keeps the count. */
export const AI_DAILY_BUDGET_STORE = '~ai-daily-budget';

/** The cap in force: `AI_DAILY_CAP` when it is a positive whole number, else the default. */
export function aiDailyCap(raw: string | undefined): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return AI_DAILY_CAP_DEFAULT;
  const n = Number(raw.trim());
  return n > 0 && Number.isSafeInteger(n) ? n : AI_DAILY_CAP_DEFAULT;
}

/** The UTC day `now` falls on, as `YYYY-MM-DD`: the count starts again from zero on a new one. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

// The store's side of it, one RPC: count this request against `day`, unless `cap` is already spent.
type BudgetRpc = { spendAiBudget(day: string, cap: number): Promise<boolean> };

/**
 * Count one reader request against today's cap. True when it is admitted. A store that cannot be reached admits it
 * (and says so in the log): a cap that failed closed would switch the reader off on an infrastructure hiccup, and the
 * per-IP limiter still runs. A deployment without the binding has no cap, as one without AI_RATE_LIMITER has no
 * limiter.
 */
export async function spendAiDailyBudget(
  env: Pick<Env, 'PERSON_STORE' | 'AI_DAILY_CAP'>,
  now: number = Date.now(),
): Promise<boolean> {
  const ns = env.PERSON_STORE as Env['PERSON_STORE'] | undefined;
  if (!ns) return true;
  try {
    const store = ns.get(ns.idFromName(AI_DAILY_BUDGET_STORE)) as unknown as BudgetRpc;
    return await store.spendAiBudget(utcDay(now), aiDailyCap(env.AI_DAILY_CAP));
  } catch (err) {
    console.warn('ai daily cap unavailable, admitting', err instanceof Error ? err.message : err);
    return true;
  }
}
