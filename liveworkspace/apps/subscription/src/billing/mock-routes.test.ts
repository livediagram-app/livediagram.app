// The mock billing provider over HTTP (subscription.md "Billing", "States"): the checkout that makes a subscription
// active for a month, and the portal whose buttons drive every state, as Stripe's webhooks will.
import {
  addMonth,
  RENEWAL_TOLERANCE_MS,
  type Entitlement,
  type MockCheckout,
  type MockPortal,
  type RedirectResponse,
} from '@liveworkspace/subscription';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { forgetMembers } from '../seats';
import { testDb, type TestDb } from '../test-sqlite-d1';
import {
  accountsStub,
  asApp,
  call,
  DAY,
  fromPage,
  signer,
  subscribe,
  type Signer,
} from '../test-kit';

const NOW = Date.UTC(2026, 10, 20, 12);
const BACK = 'http://localhost:3000/settings/subscription';
const TEAMS = [{ id: 'team_1', name: 'Design', role: 'admin' }];

let keys: Signer;
beforeAll(async () => {
  keys = await signer();
});

let db: TestDb;
let ada: string;
// Accounts, as it stands now: Ada runs the Design team's billing, with two other members.
let accounts: ReturnType<typeof accountsStub>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  forgetMembers();
  accounts = accountsStub(keys, {
    team_1: [{ userId: 'user_ada', role: 'admin' }, { userId: 'user_bea' }, { userId: 'user_cy' }],
  });
  db = testDb({ ...keys.env, ...accounts.env });
  ada = await keys.token('user_ada', { email: 'ada@example.com', teams: TEAMS });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Moves the clock, and signs Ada's token again: one lasts five minutes. */
async function at(now: number): Promise<void> {
  vi.setSystemTime(now);
  ada = await keys.token('user_ada', { email: 'ada@example.com', teams: TEAMS });
}

const sessionOf = (url: string) => new URL(url).searchParams.get('session')!;

async function open(kind: 'checkout' | 'portal', owner: string, query = ''): Promise<string> {
  const res = await call(db.env, `/${kind}${query}`, fromPage(ada, { owner, returnTo: BACK }));
  expect(res.status).toBe(200);
  return sessionOf(((await res.json()) as RedirectResponse).url);
}

const page = (path: string, body?: unknown, env: Env = db.env) =>
  call(env, `/mock${path}`, fromPage(null, body));
const tierOf = async (owner: string) =>
  ((await (await asApp(db.env, '/entitlement', { owner })).json()) as Entitlement).tier;
const stored = (owner: string) =>
  db.sql.prepare('SELECT * FROM subscriptions WHERE owner = ?').get(owner) as
    Record<string, unknown> | undefined;

describe('the mock checkout', () => {
  it('shows the tier, the owner, the price and the seats, to whoever holds the link', async () => {
    const id = await open('checkout', 't:team_1', '?currency=USD');
    const res = await page(`/checkout/${id}`);
    expect(res.status).toBe(200);
    expect((await res.json()) as MockCheckout).toEqual({
      id,
      owner: 't:team_1',
      ownerName: 'Design',
      tier: 'team',
      seats: 3,
      currency: 'USD',
      unitAmount: 8,
      amount: 24,
      returnTo: BACK,
    });
  });

  it('paying makes the subscription active for one month from now, at that price, and goes back', async () => {
    const id = await open('checkout', 'p:user_ada', '?currency=EUR');
    expect(await tierOf('p:user_ada')).toBe('free');
    const res = await page(`/checkout/${id}`, { action: 'pay' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: BACK });
    expect(stored('p:user_ada')).toMatchObject({
      tier: 'pro',
      state: 'active',
      seats: 1,
      currency: 'EUR',
      unit_amount: 9,
      period_start: NOW,
      period_end: addMonth(NOW),
      grace_end: null,
      cancel_at_period_end: 0,
      provider: 'mock',
      provider_ref: id,
      subscribed_by: 'user_ada',
    });
    expect(await tierOf('p:user_ada')).toBe('pro');
  });

  it("paying for a team answers its members' requests for Pro for Teams", async () => {
    const insert = db.sql.prepare(
      "INSERT INTO team_requests (team, account, day, created_at) VALUES (?, 'user_bea', '2026-11-20', ?)",
    );
    insert.run('t:team_1', NOW);
    insert.run('t:team_9', NOW);
    const id = await open('checkout', 't:team_1');
    expect((await page(`/checkout/${id}`, { action: 'pay' })).status).toBe(200);
    expect(db.sql.prepare('SELECT team FROM team_requests').all()).toEqual([{ team: 't:team_9' }]);
  });

  it('paying for a team needs whoever started the checkout to be its admin still', async () => {
    const id = await open('checkout', 't:team_1');
    accounts.state.teams.team_1 = [
      { userId: 'user_ada', role: 'member' },
      { userId: 'user_bea', role: 'admin' },
    ];
    const refused = await page(`/checkout/${id}`, { action: 'pay' });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: 'not_team_admin' });
    expect(stored('t:team_1')).toBeUndefined();
    // Backing out needs nobody's leave.
    expect((await page(`/checkout/${id}`, { action: 'cancel' })).status).toBe(200);
  });

  it('a paid link is spent: it cannot be read or paid again', async () => {
    const id = await open('checkout', 'p:user_ada');
    await page(`/checkout/${id}`, { action: 'pay' });
    expect((await page(`/checkout/${id}`)).status).toBe(404);
    expect((await page(`/checkout/${id}`, { action: 'pay' })).status).toBe(404);
  });

  it('cancelling goes back with nothing bought, and spends the link', async () => {
    const id = await open('checkout', 'p:user_ada');
    const res = await page(`/checkout/${id}`, { action: 'cancel' });
    expect(await res.json()).toEqual({ url: BACK });
    expect(stored('p:user_ada')).toBeUndefined();
    expect((await page(`/checkout/${id}`)).status).toBe(404);
  });

  it('a second link for an owner who has paid meanwhile is refused', async () => {
    const first = await open('checkout', 'p:user_ada');
    const second = await open('checkout', 'p:user_ada');
    await page(`/checkout/${first}`, { action: 'pay' });
    const res = await page(`/checkout/${second}`, { action: 'pay' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_subscribed' });
  });

  it('subscribing again after Pro ended starts a new month and keeps the first day', async () => {
    await subscribe(db.env, 'p:user_ada', NOW - 90 * DAY, {
      state: 'ended',
      period_end: NOW - 60 * DAY,
    });
    const id = await open('checkout', 'p:user_ada');
    await page(`/checkout/${id}`, { action: 'pay' });
    expect(stored('p:user_ada')).toMatchObject({
      state: 'active',
      period_start: NOW,
      created_at: NOW - 90 * DAY,
      updated_at: NOW,
    });
  });

  it('expires after half an hour', async () => {
    const id = await open('checkout', 'p:user_ada');
    vi.setSystemTime(NOW + 30 * 60 * 1000 - 1);
    expect((await page(`/checkout/${id}`)).status).toBe(200);
    vi.setSystemTime(NOW + 30 * 60 * 1000);
    expect((await page(`/checkout/${id}`)).status).toBe(404);
    expect((await page(`/checkout/${id}`, { action: 'pay' })).status).toBe(404);
    expect(stored('p:user_ada')).toBeUndefined();
  });

  it('refuses an action it does not know', async () => {
    const id = await open('checkout', 'p:user_ada');
    for (const body of [{}, { action: 'refund' }, { action: 1 }, []]) {
      expect((await page(`/checkout/${id}`, body)).status).toBe(400);
    }
  });
});

describe('the mock pages', () => {
  it('answer 404 for an id that is not one, an unknown one, and a path that is not theirs', async () => {
    for (const path of [
      '/checkout/short',
      `/checkout/${'a'.repeat(43)}`,
      `/portal/${'b'.repeat(43)}`,
      `/checkout/${'a'.repeat(43)}/more`,
      `/refund/${'a'.repeat(43)}`,
      '/checkout',
      '',
    ]) {
      expect((await page(path)).status, path).toBe(404);
    }
  });

  it('exist only with the mock provider', async () => {
    const id = await open('checkout', 'p:user_ada');
    for (const provider of [undefined, 'stripe', 'none', '']) {
      const env = { ...db.env, BILLING_PROVIDER: provider };
      expect((await page(`/checkout/${id}`, undefined, env)).status).toBe(404);
      expect((await page(`/checkout/${id}`, { action: 'pay' }, env)).status).toBe(404);
    }
    expect(stored('p:user_ada')).toBeUndefined();
  });

  it('never exist in production, whatever BILLING_PROVIDER says: nobody subscribes for free there', async () => {
    const checkout = await open('checkout', 'p:user_ada');
    await subscribe(db.env, 'p:user_bea', NOW);
    const bea = await keys.token('user_bea');
    const opened = await call(
      db.env,
      '/portal',
      fromPage(bea, { owner: 'p:user_bea', returnTo: BACK }),
    );
    const portal = sessionOf(((await opened.json()) as RedirectResponse).url);
    // The same database, the same live sessions, the same var: only the environment differs.
    for (const environment of ['production', 'anything-else', '']) {
      const env = { ...db.env, ENVIRONMENT: environment, BILLING_PROVIDER: 'mock' };
      expect((await page(`/checkout/${checkout}`, undefined, env)).status).toBe(404);
      expect((await page(`/checkout/${checkout}`, { action: 'pay' }, env)).status).toBe(404);
      expect((await page(`/portal/${portal}`, undefined, env)).status).toBe(404);
      for (const action of ['renew', 'cancel', 'fail_payment', 'end_period']) {
        expect((await page(`/portal/${portal}`, { action }, env)).status, action).toBe(404);
      }
      expect(
        (await page(`/portal/${portal}`, { action: 'set_seats', seats: 200 }, env)).status,
      ).toBe(404);
    }
    expect(stored('p:user_ada')).toBeUndefined();
    expect(stored('p:user_bea')).toMatchObject({ state: 'active', period_end: NOW + 30 * DAY });
    // Staging keeps it.
    const staging = { ...db.env, ENVIRONMENT: 'staging' };
    expect((await page(`/checkout/${checkout}`, undefined, staging)).status).toBe(200);
  });

  it('have a budget per network, counted before anything is read', async () => {
    const id = await open('checkout', 'p:user_ada');
    const seen: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => (seen.push(key), { success: false }),
    };
    const env = { ...db.env, SUBSCRIPTION_RATE_LIMITER: limiter };
    const prepare = vi.spyOn(db.env.SUBSCRIPTION_DB, 'prepare');
    const res = await call(env, `/mock/checkout/${id}`, {
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
    expect(seen).toEqual(['net:203.0.113.9']);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("answer the site's pages across origins", async () => {
    const id = await open('checkout', 'p:user_ada');
    const res = await call(db.env, `/mock/checkout/${id}`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });
});

describe('the mock portal', () => {
  async function portal(owner = 'p:user_ada') {
    const id = await open('portal', owner);
    const act = async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await page(`/portal/${id}`, { action, ...extra });
      return { status: res.status, body: (await res.json()) as MockPortal & { error?: string } };
    };
    const read = async () => (await (await page(`/portal/${id}`)).json()) as MockPortal;
    return { id, act, read };
  }

  it('shows the subscription, with its usage, to whoever holds the link', async () => {
    await subscribe(db.env, 't:team_1', NOW, { seats: 4 });
    await asApp(db.env, '/spend', { owner: 't:team_1', meter: 'aiCredits', amount: 6 });
    const { id, read } = await portal('t:team_1');
    expect(await read()).toMatchObject({
      id,
      ownerName: 'Design',
      members: 3,
      returnTo: BACK,
      subscription: {
        owner: 't:team_1',
        tier: 'team',
        state: 'active',
        seats: 4,
        amount: 24,
        usage: { aiCredits: { used: 6 } },
      },
    });
  });

  it('has no members for a person', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    expect((await (await portal()).read()).members).toBeNull();
  });

  it('cancel keeps Pro until the period ends, and resume takes it back', async () => {
    const row = await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    const cancelled = await act('cancel');
    expect(cancelled.body.subscription).toMatchObject({
      tier: 'pro',
      state: 'cancelling',
      periodEnd: row.period_end,
    });
    expect(stored('p:user_ada')).toMatchObject({ state: 'cancelling', cancel_at_period_end: 1 });
    expect((await act('cancel')).status).toBe(409);
    const resumed = await act('resume');
    expect(resumed.body.subscription.state).toBe('active');
    expect(stored('p:user_ada')).toMatchObject({ state: 'active', cancel_at_period_end: 0 });
    expect((await act('resume')).body.error).toBe('invalid_state');
  });

  it('a cancelled subscription is Free once its period ends, by the button or by the clock', async () => {
    const row = await subscribe(db.env, 'p:user_ada', NOW);
    await subscribe(db.env, 'p:user_bea', NOW, { state: 'cancelling', cancel_at_period_end: 1 });
    const { act } = await portal();
    await act('cancel');
    const ended = await act('end_period');
    expect(ended.body.subscription).toMatchObject({ tier: 'free', state: null, amount: null });
    expect(stored('p:user_ada')).toMatchObject({ state: 'ended', period_end: NOW });
    expect(await tierOf('p:user_ada')).toBe('free');
    expect(await tierOf('p:user_bea')).toBe('pro');
    vi.setSystemTime(row.period_end);
    expect(await tierOf('p:user_bea')).toBe('free');
    expect(stored('p:user_bea')).toMatchObject({ state: 'cancelling' });
  });

  it('a failed renewal gives seven days of grace on Pro, then Free', async () => {
    // The renewal fails as the period ends, as a real one does.
    await subscribe(db.env, 'p:user_ada', NOW - 30 * DAY, { period_end: NOW });
    const { act } = await portal();
    const failed = await act('fail_payment');
    expect(failed.body.subscription).toMatchObject({
      tier: 'pro',
      state: 'past_due',
      graceEnds: NOW + 7 * DAY,
    });
    expect((await act('fail_payment')).status).toBe(409);
    vi.setSystemTime(NOW + 7 * DAY - 1);
    expect(await tierOf('p:user_ada')).toBe('pro');
    vi.setSystemTime(NOW + 7 * DAY);
    expect(await tierOf('p:user_ada')).toBe('free');
  });

  it('grace never ends Pro before the month paid for does', async () => {
    // Twenty days of the month are still paid for when a payment is said to fail.
    await subscribe(db.env, 'p:user_ada', NOW, { period_end: NOW + 20 * DAY });
    const { act } = await portal();
    const failed = await act('fail_payment');
    expect(failed.body.subscription).toMatchObject({
      state: 'past_due',
      graceEnds: NOW + 20 * DAY,
    });
    expect(stored('p:user_ada')).toMatchObject({ grace_end: NOW + 7 * DAY });
    vi.setSystemTime(NOW + 7 * DAY);
    expect(await tierOf('p:user_ada')).toBe('pro');
    const spent = await asApp(db.env, '/spend', {
      owner: 'p:user_ada',
      meter: 'automationRuns',
      amount: 1,
    });
    expect(await spent.json()).toMatchObject({ ok: true, tier: 'pro' });
    vi.setSystemTime(NOW + 20 * DAY);
    expect(await tierOf('p:user_ada')).toBe('free');
  });

  it('cancel is taken while past due: Pro stays until the day it would have ended, and resume goes back to past due', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    await act('fail_payment');
    const cancelled = await act('cancel');
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.subscription).toMatchObject({
      tier: 'pro',
      state: 'cancelling',
      periodEnd: NOW + 30 * DAY,
    });
    expect(stored('p:user_ada')).toMatchObject({ state: 'cancelling', cancel_at_period_end: 1 });
    // The renewal was never paid: resuming is past due again, never active.
    expect((await act('resume')).body.subscription).toMatchObject({ state: 'past_due' });
    expect((await act('recover_payment')).body.subscription).toMatchObject({ state: 'active' });
  });

  it('a recovered payment makes it active again', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    await act('fail_payment');
    const recovered = await act('recover_payment');
    expect(recovered.body.subscription).toMatchObject({
      tier: 'pro',
      state: 'active',
      graceEnds: null,
    });
    expect(stored('p:user_ada')).toMatchObject({ state: 'active', grace_end: null });
    expect((await act('recover_payment')).status).toBe(409);
  });

  it('a payment recovered after the period ended starts the next month from where it ended', async () => {
    const MINUTE = 60 * 1000;
    const row = await subscribe(db.env, 'p:user_ada', NOW, { period_end: NOW + 30 * MINUTE });
    const { act } = await portal();
    await act('fail_payment');
    vi.setSystemTime(NOW + 45 * MINUTE);
    expect(await tierOf('p:user_ada')).toBe('pro');
    const recovered = await act('recover_payment');
    expect(recovered.body.subscription).toMatchObject({
      state: 'active',
      periodEnd: addMonth(row.period_end),
    });
    expect(stored('p:user_ada')).toMatchObject({ period_start: row.period_end });
  });

  it('grace running out ends it at once', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    expect((await act('end_grace')).status).toBe(409);
    await act('fail_payment');
    const ended = await act('end_grace');
    expect(ended.body.subscription.tier).toBe('free');
    expect(stored('p:user_ada')).toMatchObject({ state: 'ended', grace_end: NOW });
    for (const action of [
      'cancel',
      'resume',
      'fail_payment',
      'recover_payment',
      'end_grace',
      'end_period',
      'renew',
    ]) {
      expect((await act(action)).body.error, action).toBe('invalid_state');
    }
  });

  it('an active period ending without a renewal ends it', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    expect((await act('end_period')).body.subscription.tier).toBe('free');
  });

  it('a renewal moves the period on a month, and only near its end: pressing Renew never stacks months', async () => {
    const row = await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    // A month is still to run: nothing to renew.
    const early = await act('renew');
    expect(early.status).toBe(409);
    expect(early.body.error).toBe('invalid_state');
    expect(stored('p:user_ada')).toMatchObject({ period_end: row.period_end });
    await at(row.period_end - RENEWAL_TOLERANCE_MS);
    const { act: later } = await portal();
    const renewed = await later('renew');
    expect(renewed.body.subscription).toMatchObject({
      state: 'active',
      periodEnd: addMonth(row.period_end, row.anchor_day),
    });
    expect(stored('p:user_ada')).toMatchObject({ period_start: row.period_end });
    // Again, and again: the new period's end is a month away, so each is refused.
    for (let press = 0; press < 5; press++) expect((await later('renew')).status).toBe(409);
    expect(stored('p:user_ada')).toMatchObject({
      period_end: addMonth(row.period_end, row.anchor_day),
    });
    await later('cancel');
    expect((await later('renew')).status).toBe(409);
  });

  it('a renewal is taken after the period ended too, within the tolerance', async () => {
    const row = await subscribe(db.env, 'p:user_ada', NOW);
    // Two days past the period's end the provider's word arrives: still Pro, and the renewal is taken.
    await at(row.period_end + 2 * DAY);
    expect(await tierOf('p:user_ada')).toBe('pro');
    const { act } = await portal();
    expect((await act('renew')).body.subscription).toMatchObject({
      state: 'active',
      periodEnd: addMonth(row.period_end, row.anchor_day),
    });
  });

  it("a change of seats changes a team's pooled limits and price, never below three", async () => {
    await subscribe(db.env, 't:team_1', NOW);
    const { act } = await portal('t:team_1');
    const grown = await act('set_seats', { seats: 10 });
    expect(grown.body.subscription).toMatchObject({ seats: 10, amount: 60 });
    expect(grown.body.subscription.limits.aiCreditsPerMonth).toBe(5000);
    expect((await act('set_seats', { seats: 1 })).body.subscription.seats).toBe(3);
    // A team holds at most 200 people: no reviewer sets 10,000 seats and pools five million AI credits.
    const most = await act('set_seats', { seats: 200 });
    expect(most.body.subscription).toMatchObject({ seats: 200, amount: 1200 });
    expect(most.body.subscription.limits.aiCreditsPerMonth).toBe(100_000);
    expect((await act('set_seats', { seats: 3 })).status).toBe(200);
    for (const seats of [0, 2.5, '4', undefined, 201, 10_000, 10_001]) {
      const refused = await act('set_seats', { seats });
      expect([400, 409], String(seats)).toContain(refused.status);
    }
    expect(stored('t:team_1')).toMatchObject({ seats: 3 });
  });

  it('asks accounts before every change to a team: a link outlives a role, and its holder may not', async () => {
    await subscribe(db.env, 't:team_1', NOW);
    const { act, read } = await portal('t:team_1');
    accounts.state.asked.length = 0;
    expect((await act('set_seats', { seats: 5 })).status).toBe(200);
    expect(accounts.state.asked).toContain('team_1');
    // Ada is made a member: the link she opened as an admin changes nothing more.
    accounts.state.teams.team_1 = [
      { userId: 'user_ada', role: 'member' },
      { userId: 'user_bea', role: 'admin' },
    ];
    for (const [action, extra] of [
      ['cancel', {}],
      ['set_seats', { seats: 200 }],
      ['fail_payment', {}],
      ['end_period', {}],
    ] as const) {
      const refused = await act(action, extra);
      expect(refused.status, action).toBe(403);
      expect(refused.body.error).toBe('not_team_admin');
    }
    // Invited back as an admin but not yet joined, or out of the team, or the team gone: still no.
    accounts.state.teams.team_1 = [{ userId: 'user_ada', role: 'admin', status: 'invited' }];
    expect((await act('cancel')).status).toBe(403);
    accounts.state.teams.team_1 = [{ userId: 'user_bea', role: 'admin' }];
    expect((await act('cancel')).status).toBe(403);
    delete accounts.state.teams.team_1;
    expect((await act('cancel')).status).toBe(403);
    expect(stored('t:team_1')).toMatchObject({ state: 'active', seats: 5 });
    // Reading is the link's, as before.
    expect((await read()).subscription.seats).toBe(5);
  });

  it('refuses a team change to be tried again when accounts cannot say, never trusting the link', async () => {
    await subscribe(db.env, 't:team_1', NOW);
    const { act } = await portal('t:team_1');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.state.down = true;
    const refused = await page(`/portal/${(await portal2()).id}`, { action: 'cancel' });
    expect(refused.status).toBe(503);
    expect(refused.headers.get('Retry-After')).toBe('5');
    expect(await refused.json()).toEqual({ error: 'accounts_unavailable' });
    accounts.state.down = false;
    expect((await act('cancel')).status).toBe(200);

    async function portal2() {
      accounts.state.down = false;
      const opened = await portal('t:team_1');
      accounts.state.down = true;
      return opened;
    }
  });

  it('a person’s own subscription asks accounts nothing', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    accounts.state.down = true;
    accounts.state.asked.length = 0;
    expect((await act('cancel')).status).toBe(200);
    expect(accounts.state.asked).toEqual([]);
  });

  it("refuses a change of seats for a person's subscription", async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    expect((await act('set_seats', { seats: 5 })).status).toBe(409);
  });

  it('refuses an action it does not know', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { id, act } = await portal();
    expect((await act('refund')).status).toBe(400);
    expect((await page(`/portal/${id}`, [])).status).toBe(400);
  });

  it('says there is nothing to change once the subscription is gone', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act, read } = await portal();
    db.sql.prepare('DELETE FROM subscriptions').run();
    const refused = await act('cancel');
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('not_subscribed');
    expect((await read()).subscription.tier).toBe('free');
  });

  it('expires after an hour', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { id } = await portal();
    vi.setSystemTime(NOW + 60 * 60 * 1000);
    expect((await page(`/portal/${id}`)).status).toBe(404);
    expect((await page(`/portal/${id}`, { action: 'cancel' })).status).toBe(404);
    expect(stored('p:user_ada')).toMatchObject({ state: 'active' });
  });

  it('two changes at once cannot both land on the same row', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const { act } = await portal();
    const both = await Promise.all([act('cancel'), act('fail_payment')]);
    expect(both.map((result) => result.status).sort()).toEqual([200, 409]);
  });
});
