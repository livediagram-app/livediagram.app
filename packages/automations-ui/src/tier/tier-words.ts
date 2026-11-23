// What Automations says where a tier's limit shows, in every app (liveworkspace/docs/specs/018-automations/
// automations.md "Runs, limits and loops"; 019-subscription/subscription.md "What people see"; liveplanner's
// docs/specs/026-plan/automations.md "What the editor shows"): every sentence in one place, in the item's own word
// ("plan", "document", "Space"). The count and the limit in a sentence are always the ones the api answered; only what
// the tier above gives is read from the subscription contract. Each takes the reader's voice: the owner's tier is
// named only to someone who may know it, and the tier above only to someone who may move to it. Pure.

import {
  monthResetDay,
  offerAbove,
  tierCount as count,
  tierPlural as plural,
  type TierVoice,
  type TierWords,
} from '@liveworkspace/subscription-ui/item-tier';

import { AUTOMATION_RUNS_PER_DAY } from '@liveworkspace/automations';

// --- Automation Runs ---

/** The item's fixed 1,000 runs a day are spent (on every tier, and with Pro off): no tier named, nothing offered. */
export const RUNS_SPENT = 'Daily limit reached: rules run again tomorrow.';

/** The owner's month of runs is used: "This month's automation runs are used. Rules run again on 1 December." and,
 *  for someone who may upgrade, "Pro has 10,000 a month." */
export function runsUsedWords(voice: TierVoice, now: number, locale?: string): TierWords {
  const above = offerAbove(voice, 'automationRunsPerMonth');
  return {
    sentence: `This month’s automation runs are used. Rules run again on ${monthResetDay(now, locale)}.`,
    offer: above ? `${above.name} has ${above.more} a month.` : '',
  };
}

/** From 80% of the month: "45 automation runs left this month. Pro gives you 10,000 a month." */
export function runsNearWords(left: number, voice: TierVoice): TierWords {
  const above = offerAbove(voice, 'automationRunsPerMonth');
  return {
    sentence: `${count(left)} automation ${plural(left, 'run', 'runs')} left this month.`,
    offer: above ? `${above.name} gives you ${above.more} a month.` : '',
  };
}

/** Run Rule refused: the owner's month used (automation_runs_used), else the item's fixed runs for the day. */
export function runsSpentToast(code: string, item: string, now: number, locale?: string): string {
  if (code === 'automation_runs_used')
    return `This month’s automation runs are used. Rules run again on ${monthResetDay(now, locale)}.`;
  return `This ${item} has used today’s ${count(AUTOMATION_RUNS_PER_DAY)} runs. Rules run again tomorrow.`;
}

/** Under a message step: what each message costs, with Pro on. */
export const MESSAGE_RUN_COST = 'Each message this step sends counts as one automation run.';

// --- Rules per item ---

/** In a guest's item (its owner has no account, so nobody is offered an upgrade): "This plan holds 10 rules, the
 *  most a plan holds before you sign in. Sign in to keep this plan as your own." */
export function guestRulesWords(max: number, item: string): string {
  return `This ${item} holds ${count(max)} ${plural(max, 'rule', 'rules')}, the most a ${item} holds before you sign in. Sign in to keep this ${item} as your own.`;
}

// Who holds the owner's rules, as the sentence opens: the owner, the owning team (the only readers told the total).
const HOLDER: Record<TierVoice['whose'], string> = {
  yours: 'You have',
  team: 'This team has',
  owner: 'Its owner has',
};

/**
 * No rule may be added. `owner`: the owner's total over everything they own is at their tier's limit (the refusal's
 * numbers, or the owner's summary): "You have 25 rules, the most Free holds. Delete one to add another, or hold 500
 * with Pro." Else the item's own fixed bound, which offers no upgrade: "This plan has 50 rules, the most a plan can
 * hold. Delete one to add another." Either may hold more than its limit (the tier dropped, or an item made before).
 */
export function rulesFullWords(
  held: number,
  max: number,
  voice: TierVoice,
  item: string,
  owner = false,
): string {
  if (!owner) {
    if (held > max)
      return `This ${item} has ${count(held)} rules, more than the ${count(max)} a ${item} can hold. It can add another once it has fewer than ${count(max)}.`;
    return `This ${item} has ${count(held)} ${plural(held, 'rule', 'rules')}, the most a ${item} can hold. Delete one to add another.`;
  }
  const above = offerAbove(voice, 'automationRules');
  const or = above ? `, or hold ${above.more} with ${above.name}` : '';
  const holder = HOLDER[voice.whose];
  if (held > max)
    return `${holder} ${count(held)} rules, ${voice.tier ? `and ${voice.tier} holds ${count(max)}` : `more than the ${count(max)} allowed`}. Another can be added once there are fewer than ${count(max)}${or}.`;
  const most = voice.tier ? `the most ${voice.tier} holds` : 'the most allowed';
  return `${holder} ${count(held)} ${plural(held, 'rule', 'rules')}, ${most}. Delete one to add another${or}.`;
}

// Whose rules a tooltip names: the item's own, or the owner's total ("You have used all 25 rules").
const whoseRules = (max: number, item: string, owner: TierVoice['whose'] | null) =>
  owner === null
    ? `This ${item} holds all ${count(max)} of its rules`
    : `${HOLDER[owner]} used all ${count(max)} rules`;

/** Why New Rule and the templates are off at the limit, as their tooltip. `owner`: the owner's total is reached. */
export function addRuleOffWords(
  max: number,
  item: string,
  owner: TierVoice['whose'] | null = null,
): string {
  return `${whoseRules(max, item, owner)}. Delete one to add another.`;
}

/** Why Duplicate is off at the limit, as its tooltip. */
export function duplicateOffWords(
  max: number,
  item: string,
  owner: TierVoice['whose'] | null = null,
): string {
  return `${whoseRules(max, item, owner)}. Delete one to duplicate this.`;
}

/** Why a rule that is off cannot be switched on while more rules are held than allowed (owner, 2026-11-22): its
 *  switch's tooltip, and a refused switch's toast. `owner`: the owner's total is past their tier's. */
export function ruleOnOffWords(
  held: number,
  max: number,
  item: string,
  owner: TierVoice['whose'] | null = null,
): string {
  const over = held - max;
  const opens = owner === null ? `This ${item} has` : HOLDER[owner];
  return `${opens} ${count(held)} rules, more than the ${count(max)} allowed. Delete ${count(over)} to switch this one on.`;
}
