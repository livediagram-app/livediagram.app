// A subscription's states and what moves it between them (subscription.md "States"). Pure: the row and the clock in,
// the next row out. A billing provider's events (the mock portal's buttons now, Stripe's webhooks later) all go
// through `changed`, so the states mean the same whoever reports them.

import {
  addMonth,
  anchorDayOf,
  GRACE_MS,
  RENEWAL_TOLERANCE_MS,
  seatsFor,
  type Currency,
  type OwnerScope,
  type PaidTier,
  type SubscriptionState,
} from '@liveworkspace/subscription';
import { SEATS_MAX } from '../config';

/** One row of `subscriptions`, as it is stored. */
export type SubscriptionRow = {
  owner: OwnerScope;
  tier: PaidTier;
  state: SubscriptionState;
  seats: number;
  currency: Currency;
  unit_amount: number;
  period_start: number;
  period_end: number;
  /** The day of the month it renews on (1 to 31): the day it was taken, kept through shorter months. */
  anchor_day: number;
  grace_end: number | null;
  cancel_at_period_end: number;
  provider: string;
  provider_ref: string | null;
  subscribed_by: string;
  seats_checked_at: number;
  /** When it stopped giving its paid tier, once that has been written; null while live, or lapsed and not yet
   *  swept (`endedAt` says when for both). */
  ended_at: number | null;
  /** 1 once the owner has dismissed "You're Back on Free" for this ending. */
  ended_seen: number;
  created_at: number;
  updated_at: number;
};

type Lived = Pick<SubscriptionRow, 'state' | 'period_end' | 'grace_end'>;

/**
 * The moment a row stops giving its paid tier, whatever the sweep has or has not written (subscription.md "States").
 * `ENTITLED_LIMIT` (src/meters/limits.ts) says the same in SQL, and a test holds the two together.
 *
 * - `active`: the period's end and the renewal tolerance after it. The provider's word on the renewal (paid, or
 *   failed, which starts grace) is on its way, so "Renews" on a date never quietly means "ends" on it.
 * - `cancelling`: the period's end exactly, or grace's when it was cancelled while past due and that is later.
 * - `past_due`: the later of the paid period's end and grace's. Grace never ends Pro before what was paid for does.
 */
export function liveUntil(row: Lived): number {
  if (row.state === 'active') return row.period_end + RENEWAL_TOLERANCE_MS;
  if (row.state === 'cancelling' || row.state === 'past_due')
    return Math.max(row.period_end, row.grace_end ?? 0);
  return 0;
}

/** The state a row is really in at `now`: one past `liveUntil` is `ended` whether or not the sweep has said so. */
export function stateAt(row: Lived, now: number): SubscriptionState {
  return now < liveUntil(row) ? row.state : 'ended';
}

/** Whether a row gives its paid tier at `now`. */
export function isLive(row: Lived, now: number): boolean {
  return stateAt(row, now) !== 'ended';
}

/**
 * When a row stopped giving its paid tier, or null while it still does. A row the sweep has not reached ended when
 * the clock passed `liveUntil`, which is what the sweep then writes, so the answer is the same before and after it.
 */
export function endedAt(
  row: Lived & Pick<SubscriptionRow, 'ended_at' | 'updated_at'>,
  now: number,
): number | null {
  if (row.state === 'ended') return row.ended_at ?? row.updated_at;
  const until = liveUntil(row);
  return now < until ? null : until;
}

/** What a billing provider reports about a subscription that exists. */
export type SubscriptionChange =
  | { kind: 'cancel' }
  | { kind: 'resume' }
  | { kind: 'payment_failed' }
  | { kind: 'payment_recovered' }
  | { kind: 'grace_ended' }
  | { kind: 'period_ended' }
  | { kind: 'renewed' }
  | { kind: 'seats'; seats: number };

/** The columns a change may write. */
export type SubscriptionPatch = Partial<
  Pick<
    SubscriptionRow,
    | 'state'
    | 'seats'
    | 'period_start'
    | 'period_end'
    | 'grace_end'
    | 'cancel_at_period_end'
    | 'seats_checked_at'
    | 'ended_at'
  >
>;

/** A whole number of seats a team may hold, or null. */
export function seatsOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > SEATS_MAX)
    return null;
  return seatsFor(value);
}

/**
 * What `change` does to `row` at `now`, or null when the row's state does not allow it. The state is the STORED one
 * while the row is live (`stateAt`), so a provider's word on a renewal is taken for the tolerance after the period
 * ended, not refused because the clock passed it.
 *
 * - cancel: active to cancelling, paid until the period ends. From past_due too: it keeps what it had (the later of
 *   the paid period's end and grace's), and `grace_end` stays to say the last renewal was never paid.
 * - resume: cancelling back to active, or to past_due when it was cancelled while past due.
 * - payment_failed: active to past_due, with grace from now.
 * - payment_recovered: past_due to active. A period that ended meanwhile starts again from where it ended, on its
 *   anchor day (the tolerance and grace together are shorter than a month, so one month on is ahead of now).
 * - grace_ended: past_due to ended.
 * - period_ended: active or cancelling to ended, now.
 * - renewed: active moves on a month from its period's end, on its anchor day, and only within the tolerance of
 *   that end: reported earlier it is refused, so months never stack.
 * - seats: a live team's seats, never below the minimum.
 */
export function changed(
  row: SubscriptionRow,
  change: SubscriptionChange,
  now: number,
): SubscriptionPatch | null {
  const state = stateAt(row, now);
  const nextPeriod: SubscriptionPatch = {
    period_start: row.period_end,
    period_end: addMonth(row.period_end, row.anchor_day),
  };
  switch (change.kind) {
    case 'cancel':
      return state === 'active' || state === 'past_due'
        ? { state: 'cancelling', cancel_at_period_end: 1 }
        : null;
    case 'resume':
      if (state !== 'cancelling') return null;
      return { state: row.grace_end === null ? 'active' : 'past_due', cancel_at_period_end: 0 };
    case 'payment_failed':
      return state === 'active' ? { state: 'past_due', grace_end: now + GRACE_MS } : null;
    case 'payment_recovered': {
      if (state !== 'past_due') return null;
      const paid: SubscriptionPatch = { state: 'active', grace_end: null, cancel_at_period_end: 0 };
      return row.period_end > now ? paid : { ...paid, ...nextPeriod };
    }
    case 'grace_ended':
      return state === 'past_due' ? { state: 'ended', grace_end: now, ended_at: now } : null;
    case 'period_ended':
      return state === 'active' || state === 'cancelling'
        ? { state: 'ended', period_end: now, grace_end: null, ended_at: now }
        : null;
    case 'renewed':
      return state === 'active' && now >= row.period_end - RENEWAL_TOLERANCE_MS ? nextPeriod : null;
    case 'seats': {
      const seats = seatsOf(change.seats);
      if (row.tier !== 'team' || state === 'ended' || seats === null) return null;
      return { seats, seats_checked_at: now };
    }
  }
}

/**
 * A mock subscription renews by itself, as a real provider's would: the period an `active` row's clock has passed
 * moves on, a month at a time on its anchor day, until it is ahead of `now`. Null when there is nothing to move.
 */
export function renewedTo(
  row: Pick<SubscriptionRow, 'state' | 'period_start' | 'period_end' | 'anchor_day'>,
  now: number,
): Pick<SubscriptionRow, 'period_start' | 'period_end'> | null {
  if (row.state !== 'active' || row.period_end > now) return null;
  let { period_start, period_end } = row;
  while (period_end <= now) {
    period_start = period_end;
    period_end = addMonth(period_end, row.anchor_day);
  }
  return { period_start, period_end };
}

/** A new subscription's row, paid at `now` for one month. */
export function subscribed(
  input: {
    owner: OwnerScope;
    tier: PaidTier;
    seats: number;
    currency: Currency;
    unitAmount: number;
    provider: string;
    providerRef: string | null;
    subscribedBy: string;
  },
  now: number,
): SubscriptionRow {
  return {
    owner: input.owner,
    tier: input.tier,
    state: 'active',
    seats: input.tier === 'team' ? seatsFor(input.seats) : 1,
    currency: input.currency,
    unit_amount: input.unitAmount,
    period_start: now,
    period_end: addMonth(now),
    anchor_day: anchorDayOf(now),
    grace_end: null,
    cancel_at_period_end: 0,
    provider: input.provider,
    provider_ref: input.providerRef,
    subscribed_by: input.subscribedBy,
    seats_checked_at: now,
    ended_at: null,
    ended_seen: 0,
    created_at: now,
    updated_at: now,
  };
}
