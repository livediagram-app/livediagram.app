// Stripe's word is the truth (subscription.md "Stripe"): a webhook only says that something changed, so the Worker
// reads the subscription fresh from Stripe and writes the owner's row from it. The same subscription read twice
// writes the same row, so an event that comes twice, late or out of order can't leave a wrong state behind.

import {
  anchorDayOf,
  GRACE_MS,
  isCurrency,
  isOwnerScope,
  paidTierOf,
  PRICES,
  seatsFor,
  type OwnerScope,
  type SubscriptionState,
} from '@liveworkspace/subscription';
import { clearTeamRequests } from '../../team-requests';
import { isLive, type SubscriptionRow } from '../../subscriptions/state';
import { readSubscription, writeSubscriptionStatement } from '../../subscriptions/store';
import {
  StripeError,
  type StripeCall,
  type StripeSubscription,
  type StripeSubscriptionStatus,
} from './api';
import { STRIPE, tierOfPrice, type StripeConfig } from './config';
import { clearOpenCheckout, rememberCustomer } from './customers';

const STATES: Record<StripeSubscriptionStatus, Exclude<SubscriptionState, 'cancelling'> | null> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  canceled: 'ended',
  unpaid: 'ended',
  // Never paid (a checkout not finished), or a state this service never puts one in.
  incomplete: null,
  incomplete_expired: null,
  paused: null,
};

/** Why a subscription read from Stripe wrote nothing. */
export type Unsynced = 'not_ours' | 'not_used' | 'another_is_live' | 'duplicate';

/**
 * The row Stripe's subscription makes for its owner, given what the owner's row holds now, or why it makes none.
 * Pure.
 *
 * - `not_ours`: no owner in its metadata, or a Price that is neither tier's, or a tier its owner can't hold.
 * - `not_used`: a state this service has no use for (never paid, paused).
 * - `another_is_live`: the owner's live row is another subscription's, and this one has ended: an old one's late word.
 * - `duplicate`: the owner's live row is another Stripe subscription's, and this one is live too. The caller cancels it.
 */
export function rowFromStripe(
  config: StripeConfig,
  sub: StripeSubscription,
  held: SubscriptionRow | null,
  now: number,
): { row: SubscriptionRow; owner: OwnerScope } | Unsynced {
  const owner = sub.metadata?.owner;
  const item = sub.items?.data?.[0];
  const tier = item ? tierOfPrice(config, item.price.id) : null;
  if (!isOwnerScope(owner) || !item || !tier || paidTierOf(owner) !== tier) return 'not_ours';
  const stored = STATES[sub.status];
  if (stored === null) return 'not_used';
  const same = held?.provider === STRIPE && held.provider_ref === sub.id;
  if (held && !same && isLive(held, now))
    return stored === 'ended' ? 'another_is_live' : 'duplicate';
  const mine = same ? held : null;

  const cancelling = sub.cancel_at_period_end || sub.cancel_at !== null;
  const state: SubscriptionState = stored !== 'ended' && cancelling ? 'cancelling' : stored;
  // Grace is ours: from the first failure we heard of, kept while it is past due or cancelled while past due.
  const failing = sub.status === 'past_due';
  const grace_end = failing
    ? (mine?.grace_end ?? now + GRACE_MS)
    : stored === 'ended'
      ? (mine?.grace_end ?? null)
      : null;
  const currency = sub.currency?.toUpperCase();
  const known = isCurrency(currency) ? currency : (mine?.currency ?? 'GBP');
  const unitAmount = Number(sub.metadata.unit_amount);
  const ended = state === 'ended';
  const endedAt = ended ? (mine?.ended_at ?? (sub.ended_at ? sub.ended_at * 1000 : now)) : null;
  const row: SubscriptionRow = {
    owner,
    tier,
    state,
    seats: tier === 'team' ? seatsFor(item.quantity ?? 0) : 1,
    currency: known,
    unit_amount: Number.isInteger(unitAmount) && unitAmount >= 0 ? unitAmount : PRICES[known][tier],
    period_start: item.current_period_start * 1000,
    period_end: item.current_period_end * 1000,
    anchor_day: anchorDayOf(sub.billing_cycle_anchor * 1000),
    grace_end,
    cancel_at_period_end: cancelling ? 1 : 0,
    provider: STRIPE,
    provider_ref: sub.id,
    subscribed_by: mine?.subscribed_by ?? sub.metadata.by ?? '',
    seats_checked_at: mine?.seats_checked_at ?? now,
    ended_at: endedAt,
    // An ending already dismissed stays dismissed; any other change is news.
    ended_seen: ended && mine?.state === 'ended' ? mine.ended_seen : 0,
    // An owner that subscribed before keeps the day it first did.
    created_at: held?.created_at ?? sub.created * 1000,
    updated_at: now,
  };
  return { row, owner };
}

export type Synced = { owner: OwnerScope; row: SubscriptionRow } | Unsynced;

/**
 * Reads a subscription from Stripe and writes its owner's row. A duplicate (a second live subscription for one
 * owner) is cancelled at once and logged, for the service's owner to refund. Throws when Stripe can't be read, for
 * the webhook to answer 500 and Stripe to send it again.
 */
export async function syncSubscription(
  db: D1Database,
  config: StripeConfig,
  call: StripeCall,
  subscriptionId: string,
  now: number,
): Promise<Synced> {
  let sub: StripeSubscription;
  try {
    sub = await call<StripeSubscription>(
      'GET',
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  } catch (error) {
    // One Stripe has no such subscription for (another account's id, a test event) is never ours to write; anything
    // else is thrown, for Stripe to send the event again.
    if (error instanceof StripeError && error.status === 404) return 'not_ours';
    throw error;
  }

  const owner = sub.metadata?.owner;
  const held = isOwnerScope(owner) ? await readSubscription(db, owner) : null;
  const made = rowFromStripe(config, sub, held, now);
  if (made === 'duplicate') {
    console.error(
      '[subscription] a second live Stripe subscription for one owner: cancelled, refund it',
      {
        subscription: sub.id,
      },
    );
    await call(
      'DELETE',
      `/subscriptions/${encodeURIComponent(sub.id)}`,
      {},
      {
        idempotencyKey: `cancel-duplicate-${sub.id}`,
      },
    );
    return made;
  }
  if (typeof made === 'string') {
    if (made === 'not_ours')
      console.warn('[subscription] a Stripe subscription that is not ours', {
        subscription: sub.id,
      });
    return made;
  }
  const becameLive =
    isLive(made.row, now) && !(held && held.provider_ref === sub.id && isLive(held, now));
  await db.batch([
    writeSubscriptionStatement(db, made.row),
    rememberCustomer(db, made.owner, sub.customer, now),
    ...(becameLive
      ? [clearOpenCheckout(db, made.owner, now), clearTeamRequests(db, made.owner)]
      : []),
  ]);
  return made;
}
