// What a limit says when it is met (subscription.md "Who pays for an item", "What people see"): one sentence for what
// happened, and one for what a higher tier gives, both built from the contract's rows so a limit is worded once. An
// app with better words for its own feature hands them to LimitNotice instead.
import {
  formatAmount,
  formatTierLimit,
  paidTierOf,
  TIER_LIMITS,
  TIER_NAMES,
  type LimitRow,
  type OwnerView,
  type PaidTier,
} from '@liveworkspace/subscription';
import { periodWord } from './usage';

/** The tier an owner would move to: Pro for a person, Pro for Teams for a team. */
export function upgradeTier(view: Pick<OwnerView, 'owner'>): PaidTier {
  return paidTierOf(view.owner);
}

/** The upgrade button's words: "Upgrade to Pro" for a person, "Upgrade Team" for a team's admin. */
export function upgradeLabel(view: Pick<OwnerView, 'owner'>): string {
  return upgradeTier(view) === 'team' ? 'Upgrade Team' : 'Upgrade to Pro';
}

/** "Automation Runs: today's limit of 250 is reached. The count starts again tomorrow." */
export function limitReachedSentence(row: LimitRow, limit: number): string {
  if (limit === 0) return `${row.label} is not included on this tier.`;
  const amount = formatAmount(row, limit);
  if (row.per === 'a day')
    return `${row.label}: today’s limit of ${amount} is reached. The count starts again tomorrow.`;
  if (row.per === 'a month')
    return `${row.label}: this month’s limit of ${amount} is reached. The count starts again next month.`;
  return `${row.label}: the limit of ${amount} is reached.`;
}

/** "Automation Runs: 45 left today." */
export function nearLimitSentence(row: LimitRow, used: number, limit: number): string {
  const left = formatAmount(row, Math.max(0, limit - used));
  const period = periodWord(row);
  return `${row.label}: ${left} left${period ? ` ${period}` : ''}.`;
}

/** What the tier above gives for this row, for someone who may upgrade: "Pro gives you 10,000 a month." Null where the
 *  owner already has that tier, or it gives no more. */
export function offerSentence(row: LimitRow, view: OwnerView): string | null {
  const tier = upgradeTier(view);
  if (view.tier === null || view.tier === tier) return null;
  const higher = formatTierLimit(row, tier);
  if (higher === formatTierLimit(row, view.tier)) return null;
  const name = TIER_NAMES[tier];
  if (TIER_LIMITS[tier][row.key] === null) return `${name} has no limit.`;
  return tier === 'team' ? `${name} gives the team ${higher}.` : `${name} gives you ${higher}.`;
}

/** What a team's member is told in place of an offer. */
export const ASK_ADMIN_SENTENCE = 'A team admin can move this team to Pro for Teams.';
