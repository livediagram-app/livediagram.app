// What every app says of a tier's limit beside its own words (liveworkspace/docs/specs/019-subscription/subscription.md
// "What people see"): the numbers a sentence carries, the day a month starts again, and the AI credits an ask spends.
// The count and the limit in a sentence are always the ones the api answered; only what the tier above gives is read
// from the subscription contract. Each takes the reader's voice (item-tier.ts): the owner's tier is named only to
// someone who may know it, and the tier above only to someone who may move to it. Pure.

import {
  isPerMemberLimit,
  nextMonthStart,
  TIER_LIMITS,
  type LimitKey,
  type PaidTier,
  AI_CREDIT_COSTS,
  aiCreditsWords,
} from '@liveworkspace/subscription';
import type { TierVoice } from './item-tier';

/** A sentence for the notice, and what the tier above gives (empty when the sentence says it, or nobody is offered). */
export type TierWords = { sentence: string; offer: string };

/** A count as the notices write it: "1,500". */
export const tierCount = (n: number): string => n.toLocaleString('en-GB');

/** "rule" or "rules". */
export const tierPlural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** What the tier above allows for a counted limit: "1,500", "500 a member"; null where it has no limit. */
export function tierAbove(key: LimitKey, tier: PaidTier): string | null {
  const value = TIER_LIMITS[tier][key];
  if (typeof value !== 'number') return null;
  return `${tierCount(value)}${tier === 'team' && isPerMemberLimit(key) ? ' a member' : ''}`;
}

/** What the tier this person may move to allows of `key`, with its name; null with nobody offered or no limit. */
export function offerAbove(voice: TierVoice, key: LimitKey): { name: string; more: string } | null {
  const more = voice.offer ? tierAbove(key, voice.offer.tier) : null;
  return more ? { name: voice.offer!.name, more } : null;
}

/** A meter's numbers beside a caption that already says the period ("Runs today", "Responses this month"): "205 of
 *  250". */
export function usedOf(used: number, limit: number): string {
  return `${tierCount(used)} of ${tierCount(limit)}`;
}

/** The day a monthly count starts again, as the reader's locale writes it: "1 December". Months are UTC months. */
export function monthResetDay(now: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(nextMonthStart(now)),
  );
}

// --- AI Credits ---

export const AI_STEP_CREDIT = `Each run of this step uses ${aiCreditsWords(AI_CREDIT_COSTS.automationSummary)}.`;
/** A rule drafted from a description; liveplanner's plan and form drafts cost the same (`planDraft`). */
export const AI_DRAFT_CREDIT = `A draft uses ${aiCreditsWords(AI_CREDIT_COSTS.automationRuleDraft)}.`;

/** Credits left, naming them (the meter beside it shows no label): "38 of 50 AI credits left this month". */
export function creditsLeftLine(used: number, limit: number): string {
  return `${tierCount(Math.max(0, limit - used))} of ${tierCount(limit)} AI credits left this month`;
}

/** The month's AI credits are used: "This month's AI credits are used. They start again on 1 December." and, for
 *  someone who may upgrade, "Pro has 1,000 a month." */
export function creditsUsedWords(
  voice: TierVoice,
  now: number,
  // An AI step in a rule, which is skipped meanwhile (the rest of its rule runs).
  step = false,
  locale?: string,
): TierWords {
  const above = offerAbove(voice, 'aiCreditsPerMonth');
  const skipped = step ? ' Until then this step is skipped and the rest of the rule runs.' : '';
  return {
    sentence: `This month’s AI credits are used. They start again on ${monthResetDay(now, locale)}.${skipped}`,
    offer: above ? `${above.name} has ${above.more} a month.` : '',
  };
}
