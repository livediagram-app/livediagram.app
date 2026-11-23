// A limit as SQL can work it out in the statement that enforces it (subscription.md "Meters"): the owner's
// subscription is read, judged against the clock and turned into a number in the same statement that spends or
// adds, so a spend is one statement and nothing can slip between the check and the write.

import {
  isPerMemberLimit,
  parseOwnerScope,
  RENEWAL_TOLERANCE_MS,
  TEAM_SEATS_MIN,
  TIER_LIMITS,
  type LimitKey,
  type OwnerScope,
  type PaidTier,
} from '@liveworkspace/subscription';
import { freeLimits } from '../dev-limits';

/** Unlimited, where SQL needs a number. */
export const UNLIMITED = -1;

/**
 * Whether the subscription row `s` gives its paid tier at the moment bound as `?6`: `liveUntil`
 * (src/subscriptions/state.ts) in SQL, and a test holds the two together. `active` is live for the renewal
 * tolerance past its period's end; `cancelling` and `past_due` until the later of the period's end and grace's.
 */
export const LIVE_AT = `((s.state = 'active' AND s.period_end + ${RENEWAL_TOLERANCE_MS} > ?6)
    OR (s.state IN ('cancelling', 'past_due') AND MAX(s.period_end, COALESCE(s.grace_end, 0)) > ?6))`;

/**
 * A `WITH ent(paid, lim)` clause: one row holding whether the owner is on a paid tier now, and its limit (UNLIMITED
 * for none). Its binds, in order, are `limitBinds`'s.
 */
export const ENTITLED_LIMIT = `WITH ent(paid, lim) AS (
  SELECT s.owner IS NOT NULL,
    CASE WHEN s.owner IS NULL THEN ?1
      WHEN ?2 < 0 THEN ?2
      ELSE ?2 * CASE WHEN ?3 = 1 THEN MAX(s.seats, ?4) ELSE 1 END END
  FROM (SELECT 1) LEFT JOIN subscriptions s ON s.owner = ?5 AND ${LIVE_AT}
)`;

/** How many binds ENTITLED_LIMIT takes: a statement's own start at the next number. */
export const LIMIT_BINDS = 6;

function numeric(value: number | boolean | null): number {
  return typeof value === 'number' ? value : UNLIMITED;
}

/** The tier an owner's subscription would be: a person's is Pro, a team's Pro for Teams. */
export function paidTierOf(owner: OwnerScope): PaidTier {
  return parseOwnerScope(owner)?.kind === 'team' ? 'team' : 'pro';
}

/** ENTITLED_LIMIT's binds for one owner and limit: ?1 to ?6. */
export function limitBinds(owner: OwnerScope, key: LimitKey, now: number): (string | number)[] {
  const tier = paidTierOf(owner);
  const pooled = tier === 'team' && isPerMemberLimit(key);
  return [
    numeric(freeLimits()[key]),
    numeric(TIER_LIMITS[tier][key]),
    pooled ? 1 : 0,
    TEAM_SEATS_MIN,
    owner,
    now,
  ];
}

/** A limit SQL answered, as the contract writes it: null for unlimited. */
export function limitFromSql(value: number): number | null {
  return value < 0 ? null : value;
}
