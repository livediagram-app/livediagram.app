// Describe a Plan's count per account (docs/specs/026-plan/describe-a-plan.md "Limits and cost"; blueprint
// describe-a-plan.md "The count"). No plan exists on the server when Start Planning asks, so the plan's own AI steps
// can't cap it: each account has PLAN_DRAFT_PER_DAY drafts a UTC day, wherever it asks.
//
// The count lives in one instance of the worker's existing PLAN_ROOM Durable Object per account (no new binding,
// class or migration), under a name no plan id can take: plan ids are server-minted UUIDs, and none starts with `~`.
// The instance only ever holds the one storage key below, never a plan schema, so nothing that reads a plan (a route,
// the index's pushes, the upkeep alarm) has anything to do there. It keeps no request, no reply and no account id:
// only the day and how many.

import { PLAN_DRAFT_PER_DAY } from '@liveplanner/items';
import type { Env } from './types';

/** The storage key of the count, `{ day, count }`. */
export const PLAN_DRAFT_COUNT_KEY = 'plan-drafts';

/** The PLAN_ROOM instance that keeps an account's count. */
export const planDraftCountName = (accountId: string): string => `~plan-drafts:${accountId}`;

/** The UTC day `now` falls on, as `YYYY-MM-DD`: the count starts again from zero on a new one. */
export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

type CountStorage = Pick<DurableObjectStorage, 'get' | 'put'>;

/** The room's side: count one draft against `day`, unless `cap` is already spent. True when it may go ahead. A
 *  Durable Object runs one request's storage calls without another's between them, so two at once can't both take
 *  the last one. */
export async function spendPlanDraftIn(
  storage: CountStorage,
  day: string,
  cap: number,
): Promise<boolean> {
  const at = await storage.get<{ day: string; count: number }>(PLAN_DRAFT_COUNT_KEY);
  const count = at?.day === day ? at.count : 0;
  if (count >= cap) return false;
  await storage.put(PLAN_DRAFT_COUNT_KEY, { day, count: count + 1 });
  return true;
}

type CountRpc = { spendPlanDraft(day: string, cap: number): Promise<boolean> };

/**
 * Count one draft for `accountId` against today's cap: `true` to go ahead, `false` at the cap, `'unavailable'` when
 * the count can't be reached or there is no PLAN_ROOM. Unlike a cap that keeps a service running, this one guards a
 * bill: a fault refuses the draft rather than lifting the cap.
 */
export async function spendPlanDraft(
  env: Pick<Env, 'PLAN_ROOM'>,
  accountId: string,
  now: number = Date.now(),
): Promise<boolean | 'unavailable'> {
  const ns = env.PLAN_ROOM as Env['PLAN_ROOM'] | undefined;
  if (!ns) return 'unavailable';
  try {
    const store = ns.get(ns.idFromName(planDraftCountName(accountId))) as unknown as CountRpc;
    return await store.spendPlanDraft(utcDay(now), PLAN_DRAFT_PER_DAY);
  } catch (err) {
    console.warn(
      '[plan-draft] count_unavailable',
      err instanceof Error ? err.message : String(err),
    );
    return 'unavailable';
  }
}
