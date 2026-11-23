// The Stripe provider over HTTP (subscription.md "Stripe"): checkout and the portal open Stripe's pages, webhooks
// write the owner's row from what Stripe holds, and the sweep keeps seats and missed webhooks right.
import type { RedirectResponse, MeResponse } from '@liveworkspace/subscription';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetMembers } from '../../seats';
import { sweepSubscriptions } from '../../sweep';
import { readSubscription } from '../../subscriptions/store';
import { testDb, type TestDb } from '../../test-sqlite-d1';
import { accountsStub, call, DAY, fromPage, signer, subscribe, type Signer } from '../../test-kit';
import { fakeStripe, STRIPE_ENV, stripeSub, webhookInit } from './test-stripe';

const NOW = Date.UTC(2026, 10, 21, 12);
const BACK = 'http://localhost:3000/settings/subscription?subscribed=1';
const TEAMS = [{ id: 'team_1', name: 'Design', role: 'admin' }];

let keys: Signer;
beforeAll(async () => {
  keys = await signer();
});

let db: TestDb;
let stripe: ReturnType<typeof fakeStripe>;
let accounts: ReturnType<typeof accountsStub>;
let ada: string;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  forgetMembers();
  stripe = fakeStripe();
  vi.stubGlobal('fetch', stripe.fetcher);
  accounts = accountsStub(keys, {
    team_1: [
      { userId: 'user_ada', role: 'admin' },
      { userId: 'user_bea' },
      { userId: 'user_cy' },
      { userId: 'user_dee' },
    ],
  });
  db = testDb({ ...keys.env, ...accounts.env, ...STRIPE_ENV });
  ada = await keys.token('user_ada', { email: 'ada@example.com', teams: TEAMS });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const checkout = (owner: string, returnTo = BACK, currency = 'USD') =>
  call(db.env, `/checkout?currency=${currency}`, fromPage(ada, { owner, returnTo }));
const portal = (owner: string) =>
  call(
    db.env,
    '/portal',
    fromPage(ada, { owner, returnTo: 'http://localhost:3000/settings/subscription' }),
  );
const hook = async (type: string, object: Record<string, unknown>) =>
  call(db.env, '/stripe/webhook', await webhookInit({ type, object }, Date.now()));
const customerOf = (owner: string) =>
  db.sql.prepare('SELECT * FROM stripe_customers WHERE owner = ?').get(owner) as
    { customer: string | null; open_checkout: string | null } | undefined;

describe('checkout', () => {
  it("opens Stripe Checkout with Managed Payments, in the page's currency, for a team's joined members", async () => {
    const res = await checkout('t:team_1');
    expect(res.status).toBe(200);
    expect(((await res.json()) as RedirectResponse).url).toBe(
      'https://checkout.stripe.com/c/pay/cs_1',
    );
    const [made] = stripe.callsTo('POST', '/checkout/sessions');
    const form = Object.fromEntries(made!.form);
    expect(form).toMatchObject({
      mode: 'subscription',
      'line_items[0][price]': 'price_team',
      'line_items[0][quantity]': '4',
      currency: 'usd',
      'managed_payments[enabled]': 'true',
      client_reference_id: 't:team_1',
      success_url: BACK,
      cancel_url: 'http://localhost:3000/settings/subscription',
      'subscription_data[metadata][owner]': 't:team_1',
      'subscription_data[metadata][by]': 'user_ada',
      'subscription_data[metadata][unit_amount]': '8',
      expires_at: String(Math.floor(NOW / 1000) + 3600),
    });
    expect(form.customer).toBeUndefined();
    expect(made!.headers.get('Stripe-Version')).toBe('2026-04-22.dahlia');
    expect(made!.headers.get('Authorization')).toBe('Bearer rk_test_1');
    expect(customerOf('t:team_1')?.open_checkout).toBe('cs_1');
  });

  it('expires the checkout an owner had open, so two tabs can never both be paid', async () => {
    await checkout('p:user_ada');
    await checkout('p:user_ada');
    expect(stripe.callsTo('POST', '/checkout/sessions/cs_1/expire')).toHaveLength(1);
    expect(stripe.state.sessions.get('cs_1')?.status).toBe('expired');
    expect(customerOf('p:user_ada')?.open_checkout).toBe('cs_2');
  });

  it('says already subscribed when the open checkout was paid meanwhile, and writes it', async () => {
    await checkout('p:user_ada');
    stripe.put(stripeSub('p:user_ada', NOW, { id: 'sub_9' }));
    stripe.pay('cs_1', 'sub_9');
    const res = await checkout('p:user_ada');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_subscribed' });
    expect(
      stripe.callsTo('POST', '/checkout/sessions').filter((c) => c.path === '/checkout/sessions'),
    ).toHaveLength(1);
    expect(await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada')).toMatchObject({
      state: 'active',
      provider: 'stripe',
      provider_ref: 'sub_9',
    });
  });

  it('reuses the customer an owner already has', async () => {
    db.sql
      .prepare(
        "INSERT INTO stripe_customers (owner, customer, updated_at) VALUES ('p:user_ada', 'cus_7', 0)",
      )
      .run();
    await checkout('p:user_ada');
    expect(stripe.callsTo('POST', '/checkout/sessions')[0]!.form.get('customer')).toBe('cus_7');
  });

  it('says billing is unavailable when Stripe fails, and when Stripe is missing what it needs', async () => {
    stripe.state.down = true;
    expect((await checkout('p:user_ada')).status).toBe(503);
    stripe.state.down = false;
    db.env.STRIPE_WEBHOOK_SECRET = '';
    const res = await checkout('p:user_ada');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'billing_unavailable' });
  });

  it('works in production, where the mock never does', async () => {
    db.env.ENVIRONMENT = 'production';
    const res = await call(
      db.env,
      '/checkout',
      fromPage(ada, {
        owner: 'p:user_ada',
        returnTo: 'https://www.liveworkspace.app/settings/subscription',
      }),
    );
    expect(res.status).toBe(200);
    // Production's currency is the visitor's country's; the request names none, so GBP.
    expect(stripe.callsTo('POST', '/checkout/sessions')[0]!.form.get('currency')).toBe('gbp');
    const me = (await (await call(db.env, '/me', fromPage(ada))).json()) as MeResponse;
    expect(me.provider).toBe('stripe');
  });
});

describe('the portal', () => {
  it("opens Stripe's portal for the owner's customer, with the configuration set", async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { provider: 'stripe', provider_ref: 'sub_1' });
    db.sql
      .prepare(
        "INSERT INTO stripe_customers (owner, customer, updated_at) VALUES ('p:user_ada', 'cus_7', 0)",
      )
      .run();
    db.env.STRIPE_PORTAL_CONFIGURATION = 'bpc_1';
    const res = await portal('p:user_ada');
    expect(res.status).toBe(200);
    expect(((await res.json()) as RedirectResponse).url).toBe(
      'https://billing.stripe.com/p/session/cus_7',
    );
    const form = stripe.callsTo('POST', '/billing_portal/sessions')[0]!.form;
    expect(form.get('configuration')).toBe('bpc_1');
    expect(form.get('return_url')).toBe('http://localhost:3000/settings/subscription');
  });

  it('says billing is unavailable before Stripe has said who the customer is', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { provider: 'stripe', provider_ref: 'sub_1' });
    expect((await portal('p:user_ada')).status).toBe(503);
  });
});

describe('webhooks', () => {
  it('writes a paid checkout from the subscription Stripe holds, keeping its customer', async () => {
    await checkout('t:team_1');
    db.sql
      .prepare(
        "INSERT INTO team_requests (team, account, day, created_at) VALUES ('t:team_1', 'user_bea', '2026-11-21', 0)",
      )
      .run();
    stripe.put(stripeSub('t:team_1', NOW, { quantity: 4, customer: 'cus_team' }));
    stripe.pay('cs_1', 'sub_1');
    const res = await hook('checkout.session.completed', { id: 'cs_1', subscription: 'sub_1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, synced: 'written' });
    expect(await readSubscription(db.env.SUBSCRIPTION_DB, 't:team_1')).toMatchObject({
      tier: 'team',
      state: 'active',
      seats: 4,
      provider_ref: 'sub_1',
    });
    expect(customerOf('t:team_1')).toMatchObject({ customer: 'cus_team', open_checkout: null });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM team_requests').get()).toEqual({ n: 0 });
  });

  it('writes the same row however often or late an event comes, from what Stripe holds now', async () => {
    stripe.put(stripeSub('p:user_ada', NOW, { cancel_at_period_end: true }));
    const updated = { id: 'sub_1', status: 'active', cancel_at_period_end: false };
    await hook('customer.subscription.updated', updated);
    await hook('customer.subscription.created', updated);
    expect((await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada'))?.state).toBe(
      'cancelling',
    );
  });

  it('follows a failed renewal, a recovery, and the end', async () => {
    const sub = stripe.put(stripeSub('p:user_ada', NOW));
    await hook('customer.subscription.created', { id: 'sub_1' });
    sub.status = 'past_due';
    await hook('invoice.payment_failed', {
      parent: { subscription_details: { subscription: 'sub_1' } },
    });
    const failed = await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada');
    expect(failed).toMatchObject({ state: 'past_due', grace_end: NOW + 7 * DAY });
    sub.status = 'active';
    await hook('invoice.paid', { subscription: 'sub_1' });
    expect(await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada')).toMatchObject({
      state: 'active',
      grace_end: null,
    });
    sub.status = 'canceled';
    sub.ended_at = NOW / 1000;
    await hook('customer.subscription.deleted', { id: 'sub_1' });
    expect(await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada')).toMatchObject({
      state: 'ended',
      ended_at: NOW,
    });
  });

  it('cancels a second live subscription for one owner', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { provider: 'stripe', provider_ref: 'sub_live' });
    stripe.put(stripeSub('p:user_ada', NOW, { id: 'sub_2' }));
    const res = await hook('customer.subscription.created', { id: 'sub_2' });
    expect(await res.json()).toEqual({ received: true, synced: 'duplicate' });
    expect(stripe.state.subscriptions.get('sub_2')?.status).toBe('canceled');
    expect((await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada'))?.provider_ref).toBe(
      'sub_live',
    );
  });

  it('answers 200 to an event about no subscription, without asking Stripe', async () => {
    const res = await hook('charge.refunded', { id: 'ch_1' });
    expect(res.status).toBe(200);
    expect(stripe.state.calls).toHaveLength(0);
  });

  it("answers 200 for a subscription Stripe doesn't have, so it isn't sent again", async () => {
    const res = await hook('customer.subscription.updated', { id: 'sub_unknown' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, synced: 'not_ours' });
  });

  it('answers 500 when Stripe cannot be read, so Stripe sends it again', async () => {
    stripe.state.down = true;
    expect((await hook('customer.subscription.updated', { id: 'sub_1' })).status).toBe(500);
  });

  it('refuses an unsigned or badly signed event, and a GET', async () => {
    const init = await webhookInit(
      { type: 'customer.subscription.updated', object: { id: 'sub_1' } },
      NOW,
      'whsec_other',
    );
    expect((await call(db.env, '/stripe/webhook', init)).status).toBe(400);
    expect((await call(db.env, '/stripe/webhook', { method: 'POST', body: '{}' })).status).toBe(
      400,
    );
    expect((await call(db.env, '/stripe/webhook')).status).toBe(405);
    expect(stripe.state.calls).toHaveLength(0);
  });

  it('is not there without the Stripe provider', async () => {
    db.env.BILLING_PROVIDER = 'mock';
    expect((await hook('customer.subscription.updated', { id: 'sub_1' })).status).toBe(404);
  });
});

describe('the sweep', () => {
  it("sets a Stripe team's seats at Stripe when its members change, and the row from Stripe", async () => {
    await subscribe(db.env, 't:team_1', NOW - 2 * DAY, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      seats: 3,
      seats_checked_at: NOW - 2 * DAY,
    });
    stripe.put(stripeSub('t:team_1', NOW - 2 * DAY, { quantity: 3 }));
    const result = await sweepSubscriptions(db.env, NOW);
    expect(result.seats).toBe(1);
    const update = stripe.callsTo('POST', '/subscriptions/sub_1')[0]!.form;
    expect(Object.fromEntries(update)).toEqual({
      'items[0][id]': 'si_1',
      'items[0][quantity]': '4',
      proration_behavior: 'create_prorations',
    });
    expect((await readSubscription(db.env.SUBSCRIPTION_DB, 't:team_1'))?.seats).toBe(4);
  });

  it("keeps a team's seats when Stripe can't take them, to try again", async () => {
    await subscribe(db.env, 't:team_1', NOW - 2 * DAY, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      seats: 3,
      seats_checked_at: NOW - 2 * DAY,
    });
    stripe.state.down = true;
    const result = await sweepSubscriptions(db.env, NOW);
    expect(result.seats).toBe(0);
    expect((await readSubscription(db.env.SUBSCRIPTION_DB, 't:team_1'))?.seats).toBe(3);
  });

  it('reads a Stripe subscription not heard of in a day, so a missed renewal is not ended', async () => {
    // Its period ended four days ago, past the renewal tolerance: without the read the sweep would end it.
    await subscribe(db.env, 'p:user_ada', NOW - 34 * DAY, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      period_end: NOW - 4 * DAY,
      updated_at: NOW - 34 * DAY,
    });
    stripe.put(stripeSub('p:user_ada', NOW - 4 * DAY));
    const result = await sweepSubscriptions(db.env, NOW);
    expect(result).toMatchObject({ synced: 1, ended: 0 });
    expect(await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada')).toMatchObject({
      state: 'active',
      period_end: Math.floor((NOW + 26 * DAY) / 1000) * 1000,
    });
  });

  it('asks again in a day, not every run, about one it can write nothing for', async () => {
    await subscribe(db.env, 'p:user_ada', NOW - 2 * DAY, {
      provider: 'stripe',
      provider_ref: 'sub_1',
      updated_at: NOW - 2 * DAY,
    });
    stripe.put(stripeSub('p:user_ada', NOW, { status: 'paused' }));
    expect((await sweepSubscriptions(db.env, NOW)).synced).toBe(0);
    expect((await readSubscription(db.env.SUBSCRIPTION_DB, 'p:user_ada'))?.updated_at).toBe(NOW);
    const asked = stripe.callsTo('GET', '/subscriptions/sub_1').length;
    await sweepSubscriptions(db.env, NOW + 60 * 60 * 1000);
    expect(stripe.callsTo('GET', '/subscriptions/sub_1')).toHaveLength(asked);
  });
});
