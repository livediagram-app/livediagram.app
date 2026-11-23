// What an item's tier sets of its Automations, in every app (liveworkspace/docs/specs/018-automations/automations.md
// "Runs, limits and loops"; liveworkspace/docs/specs/019-subscription/subscription.md "Tiers and limits"). With Pro on,
// Automation Runs and Automation Rules are the OWNER's, over everything they own in every app (owner, 2026-11-22):
// runs are spent from the owner's month as they go (item/run.ts), and the item's rule count is told to the service,
// which sums it with the owner's other items and refuses one that would pass their total. An item keeps its fixed
// bounds beside them on every tier: 1,000 runs a UTC day and 50 rules, abuse bounds that offer no upgrade. A guest's
// item holds at most Free's rules itself, as nothing is counted against an account for it. With Pro off the tier is
// null or off and only the fixed bounds hold.
//
// Who is told what (019 "What a collaborator is told"): the owner's numbers are the owner's and the owning team's
// alone; a guest's item names no owner, and says it is a guest's.
import {
  nextMonthStart,
  refusedByService,
  tierRefusal,
  type ItemTier,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { AUTOMATION_RULES_MAX, AUTOMATION_RUNS_PER_DAY } from '../limits';
import type { AutomationLimits, RunsUsed } from './automation-store';

/** The item's own bounds: the fixed runs a day and rules, and Free's rules for a guest's item. */
export const automationLimitsOf = (tier: Pick<ItemTier, 'limit' | 'guest'>): AutomationLimits => ({
  runsPerDay: AUTOMATION_RUNS_PER_DAY,
  rulesMax: tier.guest
    ? Math.min(AUTOMATION_RULES_MAX, tier.limit('automationRules', AUTOMATION_RULES_MAX))
    : AUTOMATION_RULES_MAX,
});

/** What the Rules list says of the item's tier, beside its rules. */
export type AutomationsListTier = {
  runsPerDay: number;
  rulesMax: number;
  owner?: OwnerScope;
  guest?: true;
};

type Limited = { readonly runsPerDay: number; readonly rulesMax: number };

/** `tier`: the item's, with Pro on; null with it off. */
export function listTier(store: Limited, tier: ItemTier | null): AutomationsListTier {
  return {
    runsPerDay: store.runsPerDay,
    rulesMax: store.rulesMax,
    ...(tier?.owner ? { owner: tier.owner } : {}),
    ...(tier?.guest ? { guest: true as const } : {}),
  };
}

/** Why a rule may not be added or switched on: the numbers to say it in, and whether it is the owner's total
 *  (`owner`, worded as a tier's limit) or the item's own bound. */
export type RulesFull = { used: number; max: number; owner: boolean };

type Counting = Pick<ItemTier, 'count' | 'recheck'>;
type Told = Awaited<ReturnType<Counting['count']>>;

/**
 * Whether one more rule may be added to the item that holds `held`: null when it may. The item's own bound first,
 * then (with Pro on, for an owner's item) the owner's total, asked of the service and recorded when it is taken. A
 * refusal is asked about once more first (ItemTier `recheck`: the owner may have upgraded a moment ago). Where the
 * service refuses the request itself (never the owner's total), the rule is added: the item's own 50 bound it, as
 * runs go ahead uncounted.
 */
export async function rulesAtLimit(
  store: Limited,
  tier: Counting | null,
  held: number,
  itemId: string,
): Promise<RulesFull | null> {
  if (held >= store.rulesMax) return { used: held, max: store.rulesMax, owner: false };
  if (!tier) return null;
  const ask = () => tier.count('rules', itemId, held + 1, true);
  const refused = (t: Told) => !!t && !t.ok && !refusedByService(t);
  let told: Told = await ask();
  if (refused(told) && (await tier.recheck())) told = await ask();
  if (!refused(told)) return null;
  // The item's own count told as it stands (the service may never have heard it), so the total said is the true one.
  const stands = await tier.count('rules', itemId, held);
  // Refused at a limit: never an unlimited one.
  return { used: stands?.used ?? told!.used, max: told!.limit!, owner: true };
}

/**
 * Whether a rule that is off may not be switched on: the item holds more than its own bound, or the owner holds more
 * rules than their tier allows (they kept them when it dropped). At the limit exactly, every rule may be on. The
 * count told is the one the item holds, never a new one.
 */
export async function rulesOverLimit(
  store: Limited,
  tier: Counting | null,
  held: number,
  itemId: string,
): Promise<RulesFull | null> {
  if (held > store.rulesMax) return { used: held, max: store.rulesMax, owner: false };
  if (!tier) return null;
  const over = (told: Told): told is NonNullable<Told> & { limit: number } =>
    !!told && told.limit !== null && told.used > told.limit;
  let told: Told = await tier.count('rules', itemId, held);
  if (over(told) && (await tier.recheck())) told = await tier.count('rules', itemId, held);
  return over(told) ? { used: told.used, max: told.limit, owner: true } : null;
}

/** An item going for good: its rules leave the owner's total (019 "Meters": item counts). Nothing with Pro off. */
export async function leaveRuleCount(
  tier: Pick<ItemTier, 'on' | 'fresh' | 'refresh' | 'recount'>,
  itemId: string,
): Promise<void> {
  if (!tier.on) return;
  if (!tier.fresh()) await tier.refresh();
  tier.recount('rules', itemId, 0);
}

/** The item's rule count after one was removed, in the background. */
export function recountRules(
  tier: Pick<ItemTier, 'recount'> | null | undefined,
  itemId: string,
  store: { count(): number },
): void {
  tier?.recount('rules', itemId, store.count());
}

// --- Automation Runs: the owner's month ---

/** A run the owner's month held back: the rule's one Audit Trail line a UTC day (automation-log.ts monthLineId). */
export const RUNS_USED = 'This month’s automation runs are used';

type MonthStore = { monthUsed(now: number): RunsUsed | null; runsUsed: RunsUsed | null };

/**
 * One of the owner's Automation Runs for a run about to act: true when the month is used (said by the service now,
 * or by the room within the minute), so the run does not start. Not metered (Pro off, a guest's item, nobody's),
 * out of reach or a request the service refused: the run goes on, bounded by the item's 1,000 a day. A refusal is
 * kept on the store, so the rest of the wake, Run Rule and an Incoming Webhook call ask nothing for a minute.
 */
export async function runsOfMonthUsed(
  store: MonthStore,
  tier: Pick<ItemTier, 'spend'> | null | undefined,
  at: number,
): Promise<boolean> {
  if (store.monthUsed(at)) return true;
  const spent = await tier?.spend('automationRuns');
  if (!spent || spent.ok || refusedByService(spent)) return false;
  // Refused at a limit: never an unlimited one.
  store.runsUsed = { at, until: nextMonthStart(at), used: spent.used, max: spent.limit! };
  return true;
}

/** What a refusal for the owner's month says (429 automation_runs_used): its body in the tier's numbers, and the
 *  seconds until the month turns (UTC). Called once a refusal was kept on the store. */
export function runsUsedBody(
  store: MonthStore,
  tier: Pick<ItemTier, 'on' | 'guest'> | null | undefined,
  now: number,
): { body: { error: 'automation_runs_used' } & Record<string, unknown>; retryAfter: number } {
  const used = store.runsUsed!;
  return {
    body: {
      error: 'automation_runs_used',
      ...tierRefusal(tier, 'automationRunsPerMonth', used.used, used.max),
    },
    retryAfter: Math.max(1, Math.ceil((nextMonthStart(now) - now) / 1000)),
  };
}
