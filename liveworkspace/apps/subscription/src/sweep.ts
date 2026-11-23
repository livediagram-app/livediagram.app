// The sweep (the cron, wrangler.toml). Every read already judges a subscription against the clock, so ending a row
// here changes what nobody is entitled to: it makes the stored state say what the clock already did, and drops what
// nobody will read again. The one thing it decides is the mock provider's renewal, which a real provider reports
// itself: an `active` mock subscription whose period has ended moves on a month, so "Renews" is true of it. Each
// statement walks an index made for it.

import {
  monthKey,
  parseOwnerScope,
  RENEWAL_TOLERANCE_MS,
  seatsFor,
  TEAM_REQUESTS_KEPT_MS,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { isMock } from './billing/provider';
import { MOCK } from './billing/mock';
import { stripeApi, type StripeCall } from './billing/stripe/api';
import { STRIPE, stripeConfig, type StripeConfig } from './billing/stripe/config';
import { setStripeSeats } from './billing/stripe/provider';
import { syncSubscription } from './billing/stripe/sync';
import {
  MOCK_RENEWALS_PER_SWEEP,
  SEATS_CHECK_EVERY_MS,
  SEATS_CHECKS_PER_SWEEP,
  SPEND_MONTHS_KEPT,
  STRIPE_SYNC_EVERY_MS,
  STRIPE_SYNCS_PER_SWEEP,
} from './config';
import type { Env } from './env';
import { canCountMembers, teamMembers } from './seats';
import { renewedTo, type SubscriptionRow } from './subscriptions/state';

/** The key of the oldest month whose spend counters are kept: this month and the twelve before it. */
export function oldestMonthKept(now: number): string {
  const date = new Date(now);
  return monthKey(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - (SPEND_MONTHS_KEPT - 1), 1));
}

export type SweepResult = {
  renewed: number;
  ended: number;
  sessions: number;
  counters: number;
  /** Requests for Pro for Teams older than they are kept. */
  requests: number;
  seats: number;
  /** Stripe subscriptions read from Stripe because nothing was heard of them in a day. */
  synced: number;
};

type Stripe = { config: StripeConfig; call: StripeCall } | null;

/** A Stripe team's new seats, set at Stripe (which writes the row): false when Stripe could not take them. */
async function stripeSeats(
  env: Env,
  stripe: Stripe,
  row: { provider_ref: string | null },
  seats: number,
  now: number,
): Promise<boolean> {
  if (!stripe || !row.provider_ref) return false;
  try {
    return await setStripeSeats(
      env.SUBSCRIPTION_DB,
      stripe.config,
      stripe.call,
      row.provider_ref,
      seats,
      now,
    );
  } catch (error) {
    console.warn('[subscription] Stripe seats failed', { error: String(error) });
    return false;
  }
}

/**
 * Sets subscribed teams' seats from their joined members: the teams checked longest ago, a few each run. A Stripe
 * team's are set at Stripe first, and kept as they were here when Stripe could not take them, to be tried again
 * after the others.
 */
async function checkSeats(env: Env, stripe: Stripe, now: number): Promise<number> {
  if (!canCountMembers(env)) return 0;
  const db = env.SUBSCRIPTION_DB;
  const due = await db
    .prepare(
      `SELECT owner, seats, provider, provider_ref FROM subscriptions
       WHERE tier = 'team' AND state != 'ended' AND seats_checked_at <= ?
       ORDER BY seats_checked_at LIMIT ?`,
    )
    .bind(now - SEATS_CHECK_EVERY_MS, SEATS_CHECKS_PER_SWEEP)
    .all<{ owner: OwnerScope; seats: number; provider: string; provider_ref: string | null }>();
  if (due.results.length === 0) return 0;
  const counts = await Promise.all(
    due.results.map((row) => teamMembers(env, parseOwnerScope(row.owner)?.id ?? '', now)),
  );
  // A team accounts could not answer for keeps its seats, and is asked again after the others.
  const update = db.prepare(
    `UPDATE subscriptions SET updated_at = CASE WHEN seats = ?1 THEN updated_at ELSE ?2 END, seats = ?1,
       seats_checked_at = ?2
     WHERE owner = ?3 AND seats_checked_at <= ?4`,
  );
  let changed = 0;
  const writes = await Promise.all(
    due.results.map(async (row, at) => {
      const count = counts[at];
      let seats = typeof count === 'number' ? seatsFor(count) : row.seats;
      if (seats !== row.seats && row.provider === STRIPE) {
        if (!(await stripeSeats(env, stripe, row, seats, now))) seats = row.seats;
      }
      if (seats !== row.seats) changed++;
      return update.bind(seats, now, row.owner, now - SEATS_CHECK_EVERY_MS);
    }),
  );
  await db.batch(writes);
  return changed;
}

/** Reads from Stripe the live Stripe subscriptions not heard of in a day, a few each run and those due a renewal
 *  first, so a missed webhook is put right within a day. One Stripe can't answer for is tried again next run. */
async function syncStripe(env: Env, stripe: Stripe, now: number): Promise<number> {
  if (!stripe) return 0;
  const due = await env.SUBSCRIPTION_DB.prepare(
    `SELECT provider_ref FROM subscriptions
     WHERE provider = ? AND state != 'ended' AND updated_at <= ? AND provider_ref IS NOT NULL
     ORDER BY period_end LIMIT ?`,
  )
    .bind(STRIPE, now - STRIPE_SYNC_EVERY_MS, STRIPE_SYNCS_PER_SWEEP)
    .all<{ provider_ref: string }>();
  let synced = 0;
  for (const row of due.results) {
    try {
      const done = await syncSubscription(
        env.SUBSCRIPTION_DB,
        stripe.config,
        stripe.call,
        row.provider_ref,
        now,
      );
      if (typeof done !== 'string') synced++;
      // Nothing to write (Stripe no longer has it, or it is not in a state this service uses): asked again in a day,
      // not every run.
      else
        await env.SUBSCRIPTION_DB.prepare(
          'UPDATE subscriptions SET updated_at = ? WHERE provider = ? AND provider_ref = ?',
        )
          .bind(now, STRIPE, row.provider_ref)
          .run();
    } catch (error) {
      console.warn('[subscription] Stripe sync failed', { error: String(error) });
    }
  }
  return synced;
}

type Renewable = Pick<
  SubscriptionRow,
  'owner' | 'state' | 'period_start' | 'period_end' | 'anchor_day'
>;

/**
 * The mock provider's renewals: nothing reports them, so the sweep makes them. Each `active` mock subscription whose
 * period has ended moves on to the period `now` falls in. Never in production, where the mock does not exist. A
 * write lands only on the row it was worked out from, so a change made meanwhile (a cancel, a failed payment) wins.
 */
async function renewMock(env: Env, now: number): Promise<number> {
  if (!isMock(env)) return 0;
  const db = env.SUBSCRIPTION_DB;
  const due = await db
    .prepare(
      `SELECT owner, state, period_start, period_end, anchor_day FROM subscriptions
       WHERE state = 'active' AND period_end <= ? AND provider = ? ORDER BY period_end LIMIT ?`,
    )
    .bind(now, MOCK, MOCK_RENEWALS_PER_SWEEP)
    .all<Renewable>();
  const update = db.prepare(
    // Live again, so whatever was dismissed about it lapsing no longer stands.
    `UPDATE subscriptions SET period_start = ?, period_end = ?, ended_seen = 0, updated_at = ?
     WHERE owner = ? AND state = 'active' AND period_end = ?`,
  );
  const writes = due.results.flatMap((row) => {
    const next = renewedTo(row, now);
    return next
      ? [update.bind(next.period_start, next.period_end, now, row.owner, row.period_end)]
      : [];
  });
  if (writes.length === 0) return 0;
  const written = await db.batch(writes);
  return written.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
}

/** The sweep's two endings, each writing the moment the clock ended the row (`liveUntil`), not the sweep's own. */
export const ENDS_UNRENEWED = `UPDATE subscriptions SET state = 'ended', ended_at = period_end + ?, updated_at = ?
  WHERE state = 'active' AND period_end <= ?`;
export const ENDS_RUN_OUT = `UPDATE subscriptions
  SET state = 'ended', ended_at = MAX(period_end, COALESCE(grace_end, 0)), updated_at = ?
  WHERE state IN ('cancelling', 'past_due') AND period_end <= ? AND COALESCE(grace_end, 0) <= ?`;

export async function sweepSubscriptions(
  env: Env,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<SweepResult> {
  const db = env.SUBSCRIPTION_DB;
  const config = env.BILLING_PROVIDER?.trim().toLowerCase() === STRIPE ? stripeConfig(env) : null;
  const stripe: Stripe = config ? { config, call: stripeApi(config.secretKey, fetcher) } : null;
  // Before the endings below, so a renewal Stripe took but whose webhook never came is not ended.
  const synced = await syncStripe(env, stripe, now);
  // First, so a mock subscription due a renewal is never ended by the statements below.
  const renewed = await renewMock(env, now);
  const [period, grace, checkouts, portals, counters, requests] = await db.batch([
    // An active row is live for the renewal tolerance past its period's end (`liveUntil`), which is when it ended
    // (`endedAt` says the same of a row not yet swept).
    db.prepare(ENDS_UNRENEWED).bind(RENEWAL_TOLERANCE_MS, now, now - RENEWAL_TOLERANCE_MS),
    // A cancelled or past due one until the later of its period's end and grace's.
    db.prepare(ENDS_RUN_OUT).bind(now, now, now),
    db.prepare('DELETE FROM mock_checkout_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM mock_portal_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM spend_counters WHERE month < ?').bind(oldestMonthKept(now)),
    db.prepare('DELETE FROM team_requests WHERE created_at <= ?').bind(now - TEAM_REQUESTS_KEPT_MS),
  ]);
  const changes = (result: D1Result | undefined) => result?.meta.changes ?? 0;
  return {
    renewed,
    ended: changes(period) + changes(grace),
    sessions: changes(checkouts) + changes(portals),
    counters: changes(counters),
    requests: changes(requests),
    seats: await checkSeats(env, stripe, now),
    synced,
  };
}
