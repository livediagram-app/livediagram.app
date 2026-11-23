// What an owner's row is worth at a moment (subscription.md "Entitlement"): the tier, its limits with a team's
// pooled ones multiplied by its seats, and the summary a person sees.

import {
  ENDED_SHOWN_MS,
  limitsFor,
  paidTierOf,
  parseOwnerScope,
  seatsFor,
  type Entitlement,
  type OwnerScope,
  type SubscriptionSummary,
  type Tier,
  type Usage,
} from '@liveworkspace/subscription';
import { freeLimits } from '../dev-limits';
import { endedAt, isLive, liveUntil, stateAt, type SubscriptionRow } from './state';

/** The tier a row gives its owner at `now`. A person's row is only ever Pro, a team's only ever Pro for Teams. */
export function tierAt(owner: OwnerScope, row: SubscriptionRow | null, now: number): Tier {
  if (!row || !isLive(row, now)) return 'free';
  return paidTierOf(owner);
}

export function entitlementAt(
  owner: OwnerScope,
  row: SubscriptionRow | null,
  now: number,
): Entitlement {
  const tier = tierAt(owner, row, now);
  // Free pools nothing, so its seats are 1, as the client's own Free answer has them.
  const seats = tier === 'team' && row ? seatsFor(row.seats) : 1;
  return { owner, tier, seats, limits: tier === 'free' ? freeLimits() : limitsFor(tier, seats) };
}

/** That a paid tier ended lately, for "You're Back on Free": when, and what it was. Nothing for an owner that never
 *  paid, one whose tier ended longer ago than is said, or one who dismissed it. */
function endedOf(
  row: SubscriptionRow | null,
  now: number,
): Pick<SubscriptionSummary, 'endedAt' | 'endedTier'> {
  const at = row && row.ended_seen !== 1 ? endedAt(row, now) : null;
  if (!row || at === null || now - at >= ENDED_SHOWN_MS) return {};
  return { endedAt: at, endedTier: row.tier };
}

/**
 * An owner's subscription as its owner or a member sees it. `members` is a team's joined members when known: a Free
 * team's seats are what it would be billed for.
 */
export function summaryAt(
  owner: OwnerScope,
  row: SubscriptionRow | null,
  usage: Usage,
  now: number,
  members?: number,
): SubscriptionSummary {
  const entitlement = entitlementAt(owner, row, now);
  if (!row || entitlement.tier === 'free') {
    const team = parseOwnerScope(owner)?.kind === 'team';
    return {
      owner,
      tier: 'free',
      state: null,
      seats: team ? seatsFor(members ?? 0) : 1,
      currency: null,
      amount: null,
      periodEnd: null,
      graceEnds: null,
      limits: entitlement.limits,
      usage,
      ...endedOf(row, now),
    };
  }
  const state = stateAt(row, now);
  return {
    owner,
    tier: entitlement.tier,
    state,
    seats: entitlement.seats,
    currency: row.currency,
    amount: row.unit_amount * entitlement.seats,
    // The day shown is the day it is true of: a cancelled subscription's last day, and while past due the day Pro
    // ends unless the payment is recovered, which is never before the paid period's own end.
    periodEnd: state === 'cancelling' ? liveUntil(row) : row.period_end,
    graceEnds: state === 'past_due' ? liveUntil(row) : null,
    limits: entitlement.limits,
    usage,
  };
}
