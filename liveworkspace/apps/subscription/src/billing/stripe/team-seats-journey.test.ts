// @vitest-environment node
// Pro for Teams seats over a team's life (subscription.md "Tiers and limits", "Stripe"): a team subscribes at the
// minimum of 3 seats, then its joined members grow to 4, 5 and 6 and later shrink. Every request this Worker sends
// to Stripe is recorded, so the test shows exactly what Stripe is asked to bill, and when.
import { limitsFor } from '@liveworkspace/subscription';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetMembers } from '../../seats';
import { sweepSubscriptions } from '../../sweep';
import { readSubscription } from '../../subscriptions/store';
import { testDb, type TestDb } from '../../test-sqlite-d1';
import { accountsStub, DAY, signer, subscribe, type Signer } from '../../test-kit';
import { fakeStripe, STRIPE_ENV, stripeSub } from './test-stripe';

const START = Date.UTC(2026, 10, 1, 12);
const HOUR = DAY / 24;

let keys: Signer;
beforeAll(async () => {
  keys = await signer();
});

let db: TestDb;
let stripe: ReturnType<typeof fakeStripe>;
let accounts: ReturnType<typeof accountsStub>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  forgetMembers();
  stripe = fakeStripe();
  vi.stubGlobal('fetch', stripe.fetcher);
  accounts = accountsStub(keys, {
    team_1: [{ userId: 'user_ada', role: 'admin' }, { userId: 'user_bea' }, { userId: 'user_cy' }],
  });
  db = testDb({ ...keys.env, ...accounts.env, ...STRIPE_ENV });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** One hourly sweep at `at`, and what it asked Stripe to change: the quantities, in order. */
async function sweepAt(at: number): Promise<string[]> {
  vi.setSystemTime(at);
  forgetMembers();
  const before = stripe.callsTo('POST', '/subscriptions/sub_1').length;
  await sweepSubscriptions(db.env, at);
  return stripe
    .callsTo('POST', '/subscriptions/sub_1')
    .slice(before)
    .map((c) => {
      const form = Object.fromEntries(c.form);
      expect(form.proration_behavior).toBe('create_prorations');
      return form['items[0][quantity]']!;
    });
}

const seats = async () => (await readSubscription(db.env.SUBSCRIPTION_DB, 't:team_1'))?.seats;
const join = (userId: string, status: 'joined' | 'invited' = 'joined') =>
  accounts.state.teams.team_1!.push({ userId, status });
const leave = (userId: string) => {
  accounts.state.teams.team_1 = accounts.state.teams.team_1!.filter((p) => p.userId !== userId);
};

describe('Pro for Teams seats, from 3 to 6 and back', () => {
  it('bills the joined members, never fewer than 3, each change prorated on the next invoice', async () => {
    // Subscribed on 1 November with its 3 members: 3 seats at Stripe.
    await subscribe(db.env, 't:team_1', START, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      seats: 3,
      seats_checked_at: START,
    });
    stripe.put(stripeSub('t:team_1', START, { quantity: 3 }));
    expect(await seats()).toBe(3);

    // A 4th joins an hour later. The team's seats are checked once a day, so nothing is billed until then.
    join('user_dee');
    expect(await sweepAt(START + HOUR)).toEqual([]);
    expect(await seats()).toBe(3);

    // A day after the last check: Stripe is asked for 4, prorated; the row follows Stripe.
    expect(await sweepAt(START + DAY + HOUR)).toEqual(['4']);
    expect(await seats()).toBe(4);
    // The pooled limits follow the seats: 4 x the per-member figure.
    expect(limitsFor('team', 4).aiCreditsPerMonth).toBe(4 * 500);
    expect(limitsFor('team', 4).callMinutesPerMonth).toBe(4 * 2500);

    // A 5th joins, and someone is invited but has not joined: only the joined count.
    join('user_eve');
    join('user_fox', 'invited');
    expect(await sweepAt(START + 2 * DAY + 2 * HOUR)).toEqual(['5']);
    expect(await seats()).toBe(5);

    // Later the invite is accepted: a 6th.
    accounts.state.teams.team_1 = accounts.state.teams.team_1!.map((p) =>
      p.userId === 'user_fox' ? { ...p, status: 'joined' } : p,
    );
    expect(await sweepAt(START + 3 * DAY + 3 * HOUR)).toEqual(['6']);
    expect(await seats()).toBe(6);

    // No change in a day: Stripe is not asked anything.
    expect(await sweepAt(START + 4 * DAY + 4 * HOUR)).toEqual([]);

    // Four leave, leaving 2: seats go down to the minimum of 3, never 2, prorated as a credit.
    for (const id of ['user_cy', 'user_dee', 'user_eve', 'user_fox']) leave(id);
    expect(await sweepAt(START + 5 * DAY + 5 * HOUR)).toEqual(['3']);
    expect(await seats()).toBe(3);
  });
});
