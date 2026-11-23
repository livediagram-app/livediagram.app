// The Stripe provider's pure parts (subscription.md "Stripe"): the webhook signature, the form encoding, and the row
// a Stripe subscription makes, for every state Stripe can report.
import { GRACE_MS, type OwnerScope } from '@liveworkspace/subscription';
import { describe, expect, it } from 'vitest';
import { rowOf } from '../../test-kit';
import { formOf } from './api';
import { stripeConfig, tierOfPrice, type StripeConfig } from './config';
import { isSignedByStripe, signatureOf } from './signature';
import { rowFromStripe } from './sync';
import { STRIPE_EVENTS } from './events';
import { STRIPE_ENV, stripeSub } from './test-stripe';
import { subscriptionOfEvent } from './webhook';

const NOW = Date.UTC(2026, 10, 21, 12);
const ME: OwnerScope = 'p:user_ada';
const TEAM: OwnerScope = 't:team_1';
const config = stripeConfig(STRIPE_ENV) as StripeConfig;

describe('isSignedByStripe', () => {
  const secret = 'whsec_x';
  const body = '{"id":"evt_1"}';
  const t = Math.floor(NOW / 1000);

  it('takes a body signed with the secret, among other signatures', async () => {
    const good = await signatureOf(secret, t, body);
    expect(
      await isSignedByStripe(secret, `t=${t},v1=${'0'.repeat(64)},v1=${good}`, body, NOW),
    ).toBe(true);
  });

  it('refuses a changed body, another secret, an old or future time, and malformed headers', async () => {
    const good = await signatureOf(secret, t, body);
    expect(await isSignedByStripe(secret, `t=${t},v1=${good}`, `${body} `, NOW)).toBe(false);
    expect(await isSignedByStripe('whsec_y', `t=${t},v1=${good}`, body, NOW)).toBe(false);
    const old = await signatureOf(secret, t - 301, body);
    expect(await isSignedByStripe(secret, `t=${t - 301},v1=${old}`, body, NOW)).toBe(false);
    const ahead = await signatureOf(secret, t + 301, body);
    expect(await isSignedByStripe(secret, `t=${t + 301},v1=${ahead}`, body, NOW)).toBe(false);
    for (const header of [
      null,
      '',
      `v1=${good}`,
      `t=${t}`,
      `t=abc,v1=${good}`,
      `t=${t},v0=${good}`,
      'x'.repeat(3000),
    ]) {
      expect(await isSignedByStripe(secret, header, body, NOW)).toBe(false);
    }
  });
});

describe('formOf', () => {
  it("encodes nested objects and arrays Stripe's way, leaving out what is unset", () => {
    const form = formOf({
      mode: 'subscription',
      line_items: [{ price: 'price_1', quantity: 3 }],
      managed_payments: { enabled: true },
      customer: undefined,
      configuration: null,
    });
    expect([...form]).toEqual([
      ['mode', 'subscription'],
      ['line_items[0][price]', 'price_1'],
      ['line_items[0][quantity]', '3'],
      ['managed_payments[enabled]', 'true'],
    ]);
  });
});

describe('stripeConfig', () => {
  it('exists only with the key, the webhook secret and two different Prices', () => {
    expect(config.prices).toEqual({ pro: 'price_pro', team: 'price_team' });
    expect(stripeConfig({ ...STRIPE_ENV, STRIPE_SECRET_KEY: ' ' })).toBeNull();
    expect(stripeConfig({ ...STRIPE_ENV, STRIPE_WEBHOOK_SECRET: undefined })).toBeNull();
    expect(stripeConfig({ ...STRIPE_ENV, STRIPE_PRICE_TEAM: undefined })).toBeNull();
    expect(stripeConfig({ ...STRIPE_ENV, STRIPE_PRICE_TEAM: 'price_pro' })).toBeNull();
    expect(tierOfPrice(config, 'price_team')).toBe('team');
    expect(tierOfPrice(config, 'price_other')).toBeNull();
  });
});

describe('subscriptionOfEvent', () => {
  const event = (type: string, object: Record<string, unknown>) => ({
    id: 'evt',
    type,
    created: 0,
    data: { object },
  });

  it('finds the subscription each subscribed event names', () => {
    expect(
      subscriptionOfEvent(event('checkout.session.completed', { subscription: 'sub_1' })),
    ).toBe('sub_1');
    expect(subscriptionOfEvent(event('customer.subscription.updated', { id: 'sub_2' }))).toBe(
      'sub_2',
    );
    expect(
      subscriptionOfEvent(
        event('invoice.paid', { parent: { subscription_details: { subscription: 'sub_3' } } }),
      ),
    ).toBe('sub_3');
    expect(subscriptionOfEvent(event('invoice.payment_failed', { subscription: 'sub_4' }))).toBe(
      'sub_4',
    );
  });

  it('finds one in every event the endpoint is subscribed to', () => {
    const object = {
      id: 'sub_1',
      subscription: 'sub_1',
      parent: { subscription_details: { subscription: 'sub_1' } },
    };
    for (const type of STRIPE_EVENTS)
      expect(subscriptionOfEvent(event(type, object))).toBe('sub_1');
  });

  it('finds none in other events, a one-off payment, or an id that is not a subscription', () => {
    expect(subscriptionOfEvent(event('charge.refunded', { id: 'ch_1' }))).toBeNull();
    expect(
      subscriptionOfEvent(event('checkout.session.completed', { subscription: null })),
    ).toBeNull();
    expect(subscriptionOfEvent(event('customer.subscription.updated', { id: 'cus_1' }))).toBeNull();
    expect(
      subscriptionOfEvent(event('customer.subscription.updated', { id: 'sub_1/../x' })),
    ).toBeNull();
  });
});

describe('rowFromStripe', () => {
  const made = (
    sub = stripeSub(ME, NOW),
    held: Parameters<typeof rowFromStripe>[2] = null,
    now = NOW,
  ) => {
    const result = rowFromStripe(config, sub, held, now);
    if (typeof result === 'string') throw new Error(result);
    return result.row;
  };

  it('makes an active row for its period, in its currency, at the amount the checkout showed', () => {
    const row = made(
      stripeSub(ME, NOW, {
        currency: 'usd',
        metadata: { owner: ME, by: 'user_ada', unit_amount: '10' },
      }),
    );
    expect(row).toMatchObject({
      owner: ME,
      tier: 'pro',
      state: 'active',
      seats: 1,
      currency: 'USD',
      unit_amount: 10,
      period_start: Math.floor(NOW / 1000) * 1000,
      provider: 'stripe',
      provider_ref: 'sub_1',
      subscribed_by: 'user_ada',
      grace_end: null,
      ended_at: null,
      anchor_day: 21,
    });
    expect(made(stripeSub(ME, NOW, { status: 'trialing' })).state).toBe('active');
  });

  it("falls back to the contract's amount and the last currency when Stripe's are not ours", () => {
    const row = made(
      stripeSub(ME, NOW, { currency: 'jpy', metadata: { owner: ME, by: 'user_ada' } }),
    );
    expect(row).toMatchObject({ currency: 'GBP', unit_amount: 8 });
  });

  it("follows a team's quantity, never below 3", () => {
    expect(made(stripeSub(TEAM, NOW, { quantity: 7 })).seats).toBe(7);
    expect(made(stripeSub(TEAM, NOW, { quantity: 1 })).seats).toBe(3);
  });

  it('is cancelling when cancelled at the period end or at a set time', () => {
    expect(made(stripeSub(ME, NOW, { cancel_at_period_end: true }))).toMatchObject({
      state: 'cancelling',
      cancel_at_period_end: 1,
    });
    expect(made(stripeSub(ME, NOW, { cancel_at: NOW / 1000 + 100 })).state).toBe('cancelling');
  });

  it('starts grace at the first failure it hears of and keeps it while past due, and while cancelled then', () => {
    const first = made(stripeSub(ME, NOW, { status: 'past_due' }));
    expect(first).toMatchObject({ state: 'past_due', grace_end: NOW + GRACE_MS });
    const later = made(stripeSub(ME, NOW, { status: 'past_due' }), first, NOW + 1000);
    expect(later.grace_end).toBe(NOW + GRACE_MS);
    const cancelled = made(
      stripeSub(ME, NOW, { status: 'past_due', cancel_at_period_end: true }),
      first,
      NOW + 2000,
    );
    expect(cancelled).toMatchObject({ state: 'cancelling', grace_end: NOW + GRACE_MS });
    expect(made(stripeSub(ME, NOW), cancelled, NOW + 3000)).toMatchObject({
      state: 'active',
      grace_end: null,
    });
  });

  it('ends a cancelled or unpaid one at the moment Stripe ended it, keeping a dismissal of that ending', () => {
    const ended = made(stripeSub(ME, NOW, { status: 'canceled', ended_at: NOW / 1000 - 60 }));
    expect(ended).toMatchObject({ state: 'ended', ended_at: NOW - 60_000, ended_seen: 0 });
    const dismissed = { ...ended, ended_seen: 1 };
    expect(made(stripeSub(ME, NOW, { status: 'unpaid' }), dismissed, NOW + 1000)).toMatchObject({
      state: 'ended',
      ended_at: NOW - 60_000,
      ended_seen: 1,
    });
  });

  it('keeps the day an owner first subscribed and who subscribed it', () => {
    const held = rowOf(ME, NOW - 90 * 86_400_000, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      subscribed_by: 'user_x',
    });
    expect(made(stripeSub(ME, NOW), held)).toMatchObject({
      created_at: held.created_at,
      subscribed_by: 'user_x',
    });
  });

  it("writes nothing for one that is not ours or a state this service doesn't use", () => {
    const at = (sub: ReturnType<typeof stripeSub>) => rowFromStripe(config, sub, null, NOW);
    expect(at(stripeSub(ME, NOW, { metadata: {} }))).toBe('not_ours');
    expect(at(stripeSub(ME, NOW, { metadata: { owner: 'x:1', by: 'a' } }))).toBe('not_ours');
    expect(at(stripeSub(ME, NOW, { price: 'price_other' }))).toBe('not_ours');
    expect(at(stripeSub(ME, NOW, { price: 'price_team' }))).toBe('not_ours');
    expect(at({ ...stripeSub(ME, NOW), items: { data: [] } })).toBe('not_ours');
    for (const status of ['incomplete', 'incomplete_expired', 'paused'] as const) {
      expect(at(stripeSub(ME, NOW, { status }))).toBe('not_used');
    }
  });

  it("never lets another subscription's word overwrite the owner's live one", () => {
    const live = rowOf(ME, NOW, { provider: 'stripe', provider_ref: 'sub_live' });
    expect(rowFromStripe(config, stripeSub(ME, NOW, { status: 'canceled' }), live, NOW)).toBe(
      'another_is_live',
    );
    expect(rowFromStripe(config, stripeSub(ME, NOW), live, NOW)).toBe('duplicate');
    // Once the live one has ended, a new subscription takes the row.
    const gone = rowOf(ME, NOW - 90 * 86_400_000, {
      provider: 'stripe',
      provider_ref: 'sub_old',
      state: 'ended',
    });
    expect(made(stripeSub(ME, NOW), gone)).toMatchObject({
      provider_ref: 'sub_1',
      created_at: gone.created_at,
    });
  });
});
