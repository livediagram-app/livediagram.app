// The browser routes over HTTP (subscription.md "The subscription Worker", "Price", "Who pays for an item"): prices
// by country, a person's own subscription, teams and usage, what a collaborator may know of an owner, and who may
// start a checkout or open the portal.
import type {
  MeResponse,
  OwnerView,
  PricesResponse,
  RedirectResponse,
  TeamRequestResponse,
} from '@liveworkspace/subscription';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { forgetMembers } from './seats';
import { testDb, type TestDb } from './test-sqlite-d1';
import {
  accountsStub,
  asApp,
  BASE,
  call,
  DAY,
  fromPage,
  signer,
  subscribe,
  type Signer,
} from './test-kit';

const NOW = Date.UTC(2026, 10, 20, 12);
const TEAMS = [
  { id: 'team_1', name: 'Design', role: 'admin' },
  { id: 'team_2', name: 'Platform', role: 'member' },
];
const BACK = 'http://localhost:3200/plan/abc';

let keys: Signer;
let ada: string;
let bea: string;
beforeAll(async () => {
  keys = await signer();
});

/** Moves the clock, and signs the tokens again: one lasts five minutes. */
async function at(now: number): Promise<void> {
  vi.setSystemTime(now);
  ada = await keys.token('user_ada', { email: 'ada@example.com', teams: TEAMS });
  bea = await keys.token('user_bea');
}

let db: TestDb;
// Accounts, as it stands now: Ada runs Design's billing (three joined people) and is a member of Platform.
let accounts: ReturnType<typeof accountsStub>;
// Media, asked what each owner holds. `held` is its answer; `down` makes it fail.
let media: {
  held: Record<string, unknown>;
  down: boolean;
  calls: { url: string; init: RequestInit }[];
};
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  forgetMembers();
  accounts = accountsStub(keys, {
    team_1: [{ userId: 'user_ada', role: 'admin' }, { userId: 'user_bea' }, { userId: 'user_cy' }],
    team_2: [
      { userId: 'user_dee', role: 'admin' },
      { userId: 'user_ada' },
      { userId: 'user_eve', status: 'invited' },
    ],
  });
  media = { held: {}, down: false, calls: [] };
  db = testDb({
    ...keys.env,
    ...accounts.env,
    MEDIA_URL: 'https://media.test/api/media',
    MEDIA: {
      fetch: async (url, init = {}) => {
        media.calls.push({ url, init });
        return media.down
          ? new Response(null, { status: 503 })
          : Response.json({ usage: media.held });
      },
    },
  });
  await at(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const get = async <T>(path: string, bearer: string | null = ada, env: Env = db.env) => {
  const res = await call(env, path, fromPage(bearer));
  return { res, body: (await res.json()) as T };
};
const post = async <T>(
  path: string,
  body: unknown,
  bearer: string | null = ada,
  env: Env = db.env,
) => {
  const res = await call(env, path, fromPage(bearer, body));
  return { res, body: (await res.json()) as T & { error?: string } };
};

/** A request as Cloudflare hands it over: with the country it came from. */
const from = (country: string | undefined, path: string, env: Env = db.env) => {
  const request = new Request(`${BASE}${path}`);
  Object.defineProperty(request, 'cf', { value: { country } });
  return worker.fetch(request, env);
};

describe('prices', () => {
  const COUNTRIES: [string | undefined, string, number, number][] = [
    ['GB', 'GBP', 8, 6],
    ['US', 'USD', 10, 8],
    ['DE', 'EUR', 9, 7],
    ['IE', 'EUR', 9, 7],
    ['CA', 'CAD', 14, 11],
    ['AU', 'AUD', 15, 12],
    ['JP', 'GBP', 8, 6],
    ['T1', 'GBP', 8, 6],
    [undefined, 'GBP', 8, 6],
  ];

  for (const [country, currency, pro, team] of COUNTRIES) {
    it(`are in ${currency} for a visitor from ${country ?? 'nowhere known'}`, async () => {
      const res = await from(country, '/prices');
      expect(res.status).toBe(200);
      expect((await res.json()) as PricesResponse).toEqual({ prices: { currency, pro, team } });
    });
  }

  it('need no account, and are never kept by a shared cache', async () => {
    const res = await call(db.env, '/prices');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('take a currency override in development and staging, never in production', async () => {
    expect(
      ((await (await from('GB', '/prices?currency=usd')).json()) as PricesResponse).prices.currency,
    ).toBe('USD');
    expect(
      ((await (await from('US', '/prices?currency=XYZ')).json()) as PricesResponse).prices.currency,
    ).toBe('USD');
    const staging = { ...db.env, ENVIRONMENT: 'staging' };
    expect(
      ((await (await from('GB', '/prices?currency=AUD', staging)).json()) as PricesResponse).prices
        .currency,
    ).toBe('AUD');
    const production = { ...db.env, ENVIRONMENT: 'production' };
    expect(
      ((await (await from('GB', '/prices?currency=USD', production)).json()) as PricesResponse)
        .prices.currency,
    ).toBe('GBP');
  });
});

describe('who is asking', () => {
  it('answers 401 to a signed-out caller, a guest, a forged token and one for somewhere else', async () => {
    const guest = await keys.token('guest_0b7a2b6e-3f1c-4d2a-8e9b-1a2b3c4d5e6f', { kind: 'guest' });
    const routes: [string, unknown][] = [
      ['/me', undefined],
      ['/owner?scope=p:user_ada', undefined],
      ['/checkout', { owner: 'p:user_ada', returnTo: BACK }],
      ['/portal', { owner: 'p:user_ada', returnTo: BACK }],
    ];
    for (const [path, body] of routes) {
      for (const bearer of [null, guest, await keys.forged('user_ada'), 'not-a-token', 'lwt_abc']) {
        const res = await call(db.env, path, fromPage(bearer, body));
        expect(res.status, `${path} ${bearer}`).toBe(401);
        expect(await res.json()).toEqual({ error: 'unauthorised' });
      }
    }
    const basic = await call(db.env, '/me', { headers: { Authorization: `Basic ${ada}` } });
    expect(basic.status).toBe(401);
  });

  it('answers 401 to everyone when no audience is set', async () => {
    expect((await get('/me', ada, { ...db.env, INDEX_AUDIENCES: '' })).res.status).toBe(401);
  });

  it("never reads an app's key as a person", async () => {
    const res = await call(db.env, '/me', { headers: { Authorization: 'Bearer ld-key' } });
    expect(res.status).toBe(401);
  });
});

describe('/me', () => {
  it('is Free everywhere for someone new, with every team from the token and its role', async () => {
    const { res, body } = await get<MeResponse>('/me');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body.personal).toMatchObject({
      owner: 'p:user_ada',
      tier: 'free',
      state: null,
      seats: 1,
      currency: null,
      amount: null,
      periodEnd: null,
      graceEnds: null,
      usage: {},
    });
    expect(body.personal.limits.automationRules).toBe(25);
    expect(body.teams).toHaveLength(2);
    expect(body.teams[0]).toMatchObject({
      teamId: 'team_1',
      name: 'Design',
      role: 'admin',
      owner: 't:team_1',
      tier: 'free',
      seats: 3,
      members: 3,
    });
    expect(body.teams[1]).toMatchObject({ teamId: 'team_2', role: 'member', tier: 'free' });
    expect(body.prices).toEqual({ currency: 'GBP', pro: 8, team: 6 });
    expect(body.provider).toBe('mock');
  });

  it('has no teams for a token without the claim', async () => {
    const { body } = await get<MeResponse>('/me', bea);
    expect(body.teams).toEqual([]);
    expect(body.personal.owner).toBe('p:user_bea');
  });

  it("shows each owner's own subscription and usage, a team's pooled limits and price", async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { currency: 'USD', unit_amount: 10 });
    await subscribe(db.env, 't:team_2', NOW, {
      seats: 5,
      state: 'past_due',
      grace_end: NOW + 7 * DAY,
    });
    await asApp(db.env, '/item-count', {
      owner: 't:team_2',
      meter: 'rules',
      item: 'plan-9',
      used: 40,
    });
    await asApp(db.env, '/spend', { owner: 'p:user_ada', meter: 'aiCredits', amount: 12 });
    await asApp(db.env, '/spend', { owner: 't:team_2', meter: 'callMinutes', amount: 30 });
    await asApp(db.env, '/gauge', {
      owner: 't:team_1',
      gauge: 'publicRoadmaps',
      op: 'add',
      key: 'b1',
    });
    await asApp(db.env, '/item-count', {
      owner: 'p:user_ada',
      meter: 'rules',
      item: 'plan-1',
      used: 7,
    });
    const { body } = await get<MeResponse>('/me');
    expect(body.personal).toMatchObject({
      tier: 'pro',
      state: 'active',
      currency: 'USD',
      amount: 10,
      periodEnd: NOW + 30 * DAY,
      usage: { aiCredits: { used: 12 }, rules: { used: 7 } },
    });
    expect(body.teams[0]).toMatchObject({ tier: 'free', usage: { publicRoadmaps: { used: 1 } } });
    // Ada is a member of Platform, not one of its admins: its tier, state, seats, limits and how much is used are
    // hers to see. What it pays, and when it renews or lapses, are its admins'.
    expect(body.teams[1]).toEqual({
      owner: 't:team_2',
      teamId: 'team_2',
      name: 'Platform',
      role: 'member',
      tier: 'team',
      state: 'past_due',
      seats: 5,
      members: 5,
      currency: null,
      amount: null,
      periodEnd: null,
      graceEnds: null,
      limits: expect.objectContaining({ aiCreditsPerMonth: 2500 }),
      usage: {
        callMinutes: { used: 30 },
        rules: { used: 40 },
        imageStorageBytes: { used: 0 },
        walkthroughsStored: { used: 0 },
      },
    });
    // An admin of it is shown all of it: the day Pro ends is the later of the paid period's end and grace's.
    const dee = await keys.token('user_dee', {
      teams: [{ id: 'team_2', name: 'Platform', role: 'admin' }],
    });
    expect((await get<MeResponse>('/me', dee)).body.teams[0]).toMatchObject({
      role: 'admin',
      currency: 'GBP',
      amount: 30,
      periodEnd: NOW + 30 * DAY,
      graceEnds: NOW + 30 * DAY,
      usage: { rules: { used: 40 } },
    });
    // A subscriber is shown the currency their subscription was taken in.
    expect(body.prices.currency).toBe('USD');
  });

  it('reads every owner in one batch, however many teams', async () => {
    const teams = Array.from({ length: 60 }, (_, i) => ({
      id: `team_${i}`,
      name: `Team ${i}`,
      role: 'member',
    }));
    const many = await keys.token('user_cal', { teams });
    const batch = vi.spyOn(db.env.SUBSCRIPTION_DB, 'batch');
    const prepare = vi.spyOn(db.env.SUBSCRIPTION_DB, 'prepare');
    const { body } = await get<MeResponse>('/me', many);
    expect(body.teams).toHaveLength(50);
    expect(batch).toHaveBeenCalledTimes(1);
    // The four owner reads and the two of requests for Pro for Teams, in that one batch.
    expect(prepare).toHaveBeenCalledTimes(6);
    // And accounts once for every team's members together, never once a team.
    expect(accounts.state.asked).toEqual([]);
    expect(accounts.state.counted).toEqual([teams.slice(0, 50).map((team) => team.id)]);
  });

  it('falls back to Free the moment the clock ends a subscription', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, {
      state: 'cancelling',
      cancel_at_period_end: 1,
      period_end: NOW + DAY,
    });
    expect((await get<MeResponse>('/me')).body.personal).toMatchObject({
      tier: 'pro',
      state: 'cancelling',
    });
    await at(NOW + DAY);
    expect((await get<MeResponse>('/me')).body.personal).toMatchObject({
      tier: 'free',
      state: null,
      amount: null,
    });
  });

  it("counts every Free team's members in one call a read, never a subscribed one's", async () => {
    const teams = Array.from({ length: 12 }, (_, i) => ({
      id: `team_${i}`,
      name: `Team ${i}`,
      role: i % 2 ? 'member' : 'admin',
    }));
    for (const team of teams)
      accounts.state.teams[team.id] = Array.from({ length: 5 }, (_, at) => ({
        userId: `user_${at}`,
      }));
    accounts.state.teams.team_3 = [{ userId: 'user_0' }];
    // Subscribed: its seats are what its row holds, and accounts is not asked.
    await subscribe(db.env, 't:team_0', NOW, { seats: 9 });
    const many = await keys.token('user_cal', { teams });
    const first = (await get<MeResponse>('/me', many)).body;
    expect(accounts.state.counted).toEqual([teams.slice(1).map((team) => team.id)]);
    expect(accounts.state.asked).toEqual([]);
    // A Free team is counted in its joined members (never fewer seats than a team is billed for), members' and
    // admins' alike.
    expect(first.teams.map((team) => [team.members, team.seats]).slice(0, 4)).toEqual([
      [9, 9],
      [5, 5],
      [5, 5],
      [1, 3],
    ]);
    // A second read a moment later asks nothing: each answer is remembered briefly.
    await get<MeResponse>('/me', many);
    expect(accounts.state.counted).toHaveLength(1);
    // Someone joins: the next read after the brief memory counts them.
    accounts.state.teams.team_3.push({ userId: 'user_9' });
    await at(NOW + 31 * 1000);
    const again = await keys.token('user_cal', { teams });
    const later = (await get<MeResponse>('/me', again)).body;
    expect(accounts.state.counted).toHaveLength(2);
    expect(later.teams[3]!.members).toBe(2);
  });

  it('falls back to the fewest a team is billed for when accounts cannot count', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.state.down = true;
    const { res, body } = await get<MeResponse>('/me');
    expect(res.status).toBe(200);
    expect(body.teams.map((team) => team.members)).toEqual([3, 3]);
  });

  it('shows what media holds for each owner, asked in one call with the shared key', async () => {
    media.held = {
      'p:user_ada': { imageStorageBytes: 4096, walkthroughsStored: 2 },
      't:team_1': { imageStorageBytes: 7, walkthroughsStored: 0 },
    };
    const { body } = await get<MeResponse>('/me');
    expect(body.personal.usage).toMatchObject({
      imageStorageBytes: { used: 4096 },
      walkthroughsStored: { used: 2 },
    });
    expect(body.teams[0]!.usage).toMatchObject({ imageStorageBytes: { used: 7 } });
    // Media holds nothing for Platform: a known zero, not a gap.
    expect(body.teams[1]!.usage).toEqual({
      imageStorageBytes: { used: 0 },
      walkthroughsStored: { used: 0 },
    });
    expect(media.calls).toHaveLength(1);
    expect(media.calls[0]!.url).toBe('https://media.test/api/media/app/usage/owners');
    expect(media.calls[0]!.init.method).toBe('POST');
    expect(new Headers(media.calls[0]!.init.headers).get('Authorization')).toBe('Bearer lw-key');
    expect(new Headers(media.calls[0]!.init.headers).get('X-Media-App')).toBe('subscription');
    expect(JSON.parse(String(media.calls[0]!.init.body))).toEqual({
      owners: ['p:user_ada', 't:team_1', 't:team_2'],
    });
  });

  it('leaves media’s figures out when media cannot say, never guessing or failing the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    media.down = true;
    const fetched = vi.fn(async () => new Response(null, { status: 502 }));
    vi.stubGlobal('fetch', fetched);
    const { res, body } = await get<MeResponse>('/me');
    expect(res.status).toBe(200);
    expect(body.personal.usage).toEqual({});
    // The binding failed, so the public route was tried once too.
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('/owner', () => {
  const view = async (scope: string, bearer = ada) =>
    (await get<OwnerView>(`/owner?scope=${scope}`, bearer)).body;

  it('offers the person themself an upgrade, then to manage', async () => {
    expect(await view('p:user_ada')).toMatchObject({
      owner: 'p:user_ada',
      tier: 'free',
      action: 'upgrade',
    });
    await subscribe(db.env, 'p:user_ada', NOW);
    const paid = await view('p:user_ada');
    expect(paid).toMatchObject({ tier: 'pro', action: 'manage' });
    expect(paid.limits?.automationRules).toBe(500);
  });

  it("offers a team's admin the same, and tells its other members to ask one", async () => {
    expect(await view('t:team_1')).toMatchObject({ tier: 'free', action: 'upgrade' });
    expect(await view('t:team_2')).toMatchObject({ tier: 'free', action: 'ask_admin' });
    await subscribe(db.env, 't:team_1', NOW);
    await subscribe(db.env, 't:team_2', NOW);
    expect(await view('t:team_1')).toMatchObject({ tier: 'team', action: 'manage' });
    expect(await view('t:team_2')).toMatchObject({ tier: 'team', action: 'ask_admin' });
  });

  it('tells someone outside the owner nothing of its subscription', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    await subscribe(db.env, 't:team_1', NOW, { seats: 4 });
    const outside = { tier: null, limits: null, action: 'none' };
    const person = await view('p:user_ada', bea);
    expect(person).toEqual({ owner: 'p:user_ada', ...outside });
    expect(await view('t:team_1', bea)).toEqual({ owner: 't:team_1', ...outside });
    // An owner nobody subscribed reads the same, so the answer cannot tell the two apart.
    expect(await view('t:team_9', bea)).toEqual({ owner: 't:team_9', ...outside });
  });

  it('refuses a scope it cannot read', async () => {
    for (const scope of ['', 'user_ada', 'x:1', 'p:', 'p:a/b']) {
      const { res } = await get(`/owner?scope=${encodeURIComponent(scope)}`);
      expect(res.status, scope).toBe(400);
    }
    expect((await get('/owner')).res.status).toBe(400);
  });
});

describe('checkout', () => {
  const start = (owner: string, bearer = ada, returnTo: unknown = BACK, env: Env = db.env) =>
    post<RedirectResponse>('/checkout', { owner, returnTo }, bearer, env);

  it("sends the person to the site's checkout page with an unguessable session", async () => {
    const { res, body } = await start('p:user_ada');
    expect(res.status).toBe(200);
    expect(body.url).toMatch(
      /^http:\/\/localhost:3000\/subscription\/checkout\?session=[A-Za-z0-9_-]{43}$/,
    );
    expect(db.sql.prepare('SELECT * FROM mock_checkout_sessions').get()).toMatchObject({
      owner: 'p:user_ada',
      owner_name: 'ada@example.com',
      tier: 'pro',
      seats: 1,
      currency: 'GBP',
      unit_amount: 8,
      return_to: BACK,
      created_by: 'user_ada',
      expires_at: NOW + 30 * 60 * 1000,
    });
    const other = await start('p:user_ada');
    expect(other.body.url).not.toBe(body.url);
  });

  it("prices it in the visitor's currency at that moment", async () => {
    await post('/checkout?currency=CAD', { owner: 't:team_1', returnTo: BACK });
    expect(db.sql.prepare('SELECT * FROM mock_checkout_sessions').get()).toMatchObject({
      owner: 't:team_1',
      owner_name: 'Design',
      tier: 'team',
      seats: 3,
      currency: 'CAD',
      unit_amount: 11,
    });
  });

  it('names a person by the name accounts shows for them, then their email', async () => {
    accounts.state.names.user_ada = '  Ada Byron ';
    await start('p:user_ada');
    expect(db.sql.prepare('SELECT owner_name FROM mock_checkout_sessions').get()).toEqual({
      owner_name: 'Ada Byron',
    });
    // Accounts out of reach: the email, never a failed checkout.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.sql.exec('DELETE FROM mock_checkout_sessions');
    accounts.state.down = true;
    expect((await start('p:user_ada')).res.status).toBe(200);
    expect(db.sql.prepare('SELECT owner_name FROM mock_checkout_sessions').get()).toEqual({
      owner_name: 'ada@example.com',
    });
  });

  it('names a person without an email plainly', async () => {
    await start('p:user_bea', bea);
    expect(db.sql.prepare('SELECT owner_name FROM mock_checkout_sessions').get()).toEqual({
      owner_name: 'Your account',
    });
  });

  it('is only for the person themself or an admin of the team', async () => {
    for (const [owner, bearer] of [
      ['p:user_ada', bea],
      ['t:team_2', ada],
      ['t:team_1', bea],
      ['t:team_9', ada],
    ] as const) {
      const { res, body } = await start(owner, bearer);
      expect(res.status, owner).toBe(403);
      expect(body.error).toBe('not_team_admin');
    }
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_checkout_sessions').get()).toEqual({
      n: 0,
    });
  });

  it('refuses an owner already on Pro, and takes one whose Pro has ended', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { period_end: NOW + DAY });
    const { res, body } = await start('p:user_ada');
    expect(res.status).toBe(409);
    expect(body.error).toBe('already_subscribed');
    // Its renewal is still on its way a day past the period's end; three days past, it has ended.
    await at(NOW + 2 * DAY);
    expect((await start('p:user_ada')).res.status).toBe(409);
    await at(NOW + 4 * DAY);
    expect((await start('p:user_ada')).res.status).toBe(200);
  });

  it('refuses to come back to anywhere but the site or an app', async () => {
    for (const returnTo of ['https://evil.example/', 'javascript:alert(1)', '/plan', '', null, 7]) {
      const { res, body } = await start('p:user_ada', ada, returnTo);
      expect(res.status, String(returnTo)).toBe(400);
      expect(body.error).toBe('bad_request');
    }
    // Staging takes staging's own pages, never a localhost one (the mock provider does not exist in production).
    const staging = {
      ...db.env,
      ENVIRONMENT: 'staging',
      SITE_ORIGIN: 'https://staging.liveworkspace.app',
    };
    expect((await start('p:user_ada', ada, BACK, staging)).res.status).toBe(400);
    const ok = await start('p:user_ada', ada, 'https://staging.liveplanner.app/plan/abc', staging);
    expect(ok.body.url).toMatch(
      /^https:\/\/staging\.liveworkspace\.app\/subscription\/checkout\?session=/,
    );
    // Production still checks where to come back to before it says there is no provider.
    const production = {
      ...db.env,
      ENVIRONMENT: 'production',
      SITE_ORIGIN: 'https://www.liveworkspace.app',
    };
    expect((await start('p:user_ada', ada, BACK, production)).res.status).toBe(400);
  });

  it('refuses a body it cannot read', async () => {
    for (const body of [{}, { owner: 'nobody', returnTo: BACK }, [], 'x']) {
      expect((await post('/checkout', body)).res.status).toBe(400);
    }
  });

  it('fails closed without a provider it knows, and says so in the log', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const provider of [undefined, '', 'stripe', 'Mock2']) {
      const env = { ...db.env, BILLING_PROVIDER: provider };
      const { res, body } = await start('p:user_ada', ada, BACK, env);
      expect(res.status, String(provider)).toBe(503);
      expect(body.error).toBe('billing_unavailable');
    }
    expect(error).toHaveBeenCalledWith(expect.stringContaining('no provider exists'));
    expect(
      (await start('p:user_ada', ada, BACK, { ...db.env, BILLING_PROVIDER: ' MOCK ' })).res.status,
    ).toBe(200);
    expect(
      (await get<MeResponse>('/me', ada, { ...db.env, BILLING_PROVIDER: undefined })).body.provider,
    ).toBe('none');
  });

  it('never uses the mock provider in production: checkout and the portal answer 503, whatever the var says', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await subscribe(db.env, 'p:user_bea', NOW);
    for (const environment of ['production', 'unknown', '']) {
      const env = { ...db.env, ENVIRONMENT: environment, BILLING_PROVIDER: 'mock' };
      // Production answers production's pages only.
      const back = 'https://www.liveworkspace.app/settings';
      const bought = await start('p:user_ada', ada, back, env);
      expect(bought.res.status, environment).toBe(503);
      expect(bought.body.error).toBe('billing_unavailable');
      const managed = await post<RedirectResponse>(
        '/portal',
        { owner: 'p:user_bea', returnTo: back },
        bea,
        env,
      );
      expect(managed.res.status).toBe(503);
      expect(managed.body.error).toBe('billing_unavailable');
      expect((await get<MeResponse>('/me', ada, env)).body.provider).toBe('none');
    }
    expect(error).toHaveBeenCalledWith(expect.stringContaining('never does in production'));
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_checkout_sessions').get()).toEqual({
      n: 0,
    });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_portal_sessions').get()).toEqual({
      n: 0,
    });
    // Staging and development keep it.
    for (const environment of ['staging', 'development']) {
      const env = { ...db.env, ENVIRONMENT: environment };
      expect((await get<MeResponse>('/me', ada, env)).body.provider).toBe('mock');
    }
  });

  it('asks accounts whether a team’s admin still is one: the token’s word is up to fifteen minutes old', async () => {
    accounts.state.asked.length = 0;
    expect((await start('t:team_1')).res.status).toBe(200);
    expect(accounts.state.asked).toContain('team_1');
    // The token still says admin. Accounts says member, then invited, then gone.
    for (const people of [
      [{ userId: 'user_ada', role: 'member' as const }],
      [{ userId: 'user_ada', role: 'admin' as const, status: 'invited' as const }],
      [{ userId: 'user_bea', role: 'admin' as const }],
    ]) {
      accounts.state.teams.team_1 = people;
      const refused = await start('t:team_1');
      expect(refused.res.status).toBe(403);
      expect(refused.body.error).toBe('not_team_admin');
    }
    delete accounts.state.teams.team_1;
    expect((await start('t:team_1')).body.error).toBe('not_team_admin');
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_checkout_sessions').get()).toEqual({
      n: 1,
    });
  });

  it('refuses a team’s checkout to be tried again when accounts cannot say, never trusting the claim', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.state.down = true;
    const down = await start('t:team_1');
    expect(down.res.status).toBe(503);
    expect(down.res.headers.get('Retry-After')).toBe('5');
    expect(down.body.error).toBe('accounts_unavailable');
    // No client at accounts at all: the same, since nothing can confirm the claim.
    const none = {
      ...db.env,
      ACCOUNTS_CLIENT_ID: undefined,
      ACCOUNTS_CLIENT_SECRET: undefined,
    };
    expect((await start('t:team_1', ada, BACK, none)).body.error).toBe('accounts_unavailable');
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_checkout_sessions').get()).toEqual({
      n: 0,
    });
    // A person's own checkout asks accounts nothing.
    expect((await start('p:user_ada')).res.status).toBe(200);
  });

  it('has a budget per account', async () => {
    const seen: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => (seen.push(key), { success: seen.length < 3 }),
    };
    const env = { ...db.env, SUBSCRIPTION_RATE_LIMITER: limiter };
    expect((await start('p:user_ada', ada, BACK, env)).res.status).toBe(200);
    expect((await start('t:team_1', ada, BACK, env)).res.status).toBe(200);
    const third = await start('p:user_ada', ada, BACK, env);
    expect(third.res.status).toBe(429);
    expect(third.body.error).toBe('rate_limited');
    expect(new Set(seen)).toEqual(new Set(['account:user_ada']));
  });
});

describe('the portal', () => {
  const open = (owner: string, bearer = ada, returnTo: unknown = BACK, env: Env = db.env) =>
    post<RedirectResponse>('/portal', { owner, returnTo }, bearer, env);

  it("names a person's billing page by their name", async () => {
    accounts.state.names.user_ada = 'Ada Byron';
    await subscribe(db.env, 'p:user_ada', NOW);
    expect((await open('p:user_ada')).res.status).toBe(200);
    expect(db.sql.prepare('SELECT owner_name FROM mock_portal_sessions').get()).toEqual({
      owner_name: 'Ada Byron',
    });
  });

  it("sends a subscriber to the site's billing page", async () => {
    await subscribe(db.env, 't:team_1', NOW);
    const { res, body } = await open('t:team_1');
    expect(res.status).toBe(200);
    expect(body.url).toMatch(
      /^http:\/\/localhost:3000\/subscription\/billing\?session=[A-Za-z0-9_-]{43}$/,
    );
    expect(db.sql.prepare('SELECT * FROM mock_portal_sessions').get()).toMatchObject({
      owner: 't:team_1',
      owner_name: 'Design',
      return_to: BACK,
      created_by: 'user_ada',
      expires_at: NOW + 60 * 60 * 1000,
    });
  });

  it('has nothing to manage for a Free owner, or one whose Pro has ended', async () => {
    const { res, body } = await open('p:user_ada');
    expect(res.status).toBe(409);
    expect(body.error).toBe('not_subscribed');
    await subscribe(db.env, 'p:user_ada', NOW, { state: 'ended' });
    expect((await open('p:user_ada')).body.error).toBe('not_subscribed');
  });

  it('asks accounts before opening a team’s billing', async () => {
    await subscribe(db.env, 't:team_1', NOW);
    accounts.state.teams.team_1 = [{ userId: 'user_ada', role: 'member' }];
    const demoted = await open('t:team_1');
    expect(demoted.res.status).toBe(403);
    expect(demoted.body.error).toBe('not_team_admin');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.state.down = true;
    expect((await open('t:team_1')).body.error).toBe('accounts_unavailable');
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM mock_portal_sessions').get()).toEqual({
      n: 0,
    });
  });

  it('is only for the person themself or an admin of the team', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    await subscribe(db.env, 't:team_2', NOW);
    expect((await open('p:user_ada', bea)).body.error).toBe('not_team_admin');
    expect((await open('t:team_2')).body.error).toBe('not_team_admin');
    expect((await open('t:team_2')).res.status).toBe(403);
  });

  it('checks where to come back to, and fails closed without a provider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await subscribe(db.env, 'p:user_ada', NOW);
    expect((await open('p:user_ada', ada, 'https://evil.example/')).res.status).toBe(400);
    expect(
      (await open('p:user_ada', ada, BACK, { ...db.env, BILLING_PROVIDER: 'stripe' })).res.status,
    ).toBe(503);
  });
});

describe('Ask an Admin', () => {
  const ask = (
    owner: unknown,
    bearer = ada,
    limit: unknown = 'automationRules',
    env: Env = db.env,
    note: unknown = '  Could we move Platform to Pro for Teams?  ',
  ) => post<TeamRequestResponse>('/team-request', { owner, limit, note }, bearer, env);
  const rows = () => db.sql.prepare('SELECT * FROM team_requests ORDER BY created_at').all();

  beforeEach(() => {
    accounts.state.teams.team_2 = [
      { userId: 'user_dee', role: 'admin', name: 'Dee' },
      { userId: 'user_ada', name: 'Ada Byron' },
      { userId: 'user_eve', status: 'invited' },
    ];
  });

  it('keeps one request per member, team and day, and says when they asked', async () => {
    const first = await ask('t:team_2');
    expect(first.res.status).toBe(200);
    expect(first.res.headers.get('Cache-Control')).toBe('no-store');
    expect(first.body).toEqual({ sent: true, askedAt: NOW });
    await at(NOW + 60 * 60 * 1000);
    const again = await ask('t:team_2', ada, null);
    expect(again.body).toEqual({ sent: false, askedAt: NOW });
    expect(rows()).toEqual([
      {
        team: 't:team_2',
        account: 'user_ada',
        day: '2026-11-20',
        name: 'Ada Byron',
        limit_key: 'automationRules',
        note: 'Could we move Platform to Pro for Teams?',
        created_at: NOW,
      },
    ]);
    // The next UTC day is a new request.
    await at(NOW + DAY);
    expect((await ask('t:team_2')).body).toEqual({ sent: true, askedAt: NOW + DAY });
  });

  it("shows the team's admins who asked, and the member only that they did today", async () => {
    await ask('t:team_2');
    const dee = await keys.token('user_dee', {
      teams: [{ id: 'team_2', name: 'Platform', role: 'admin' }],
    });
    expect((await get<MeResponse>('/me', dee)).body.teams[0]).toMatchObject({
      requests: {
        count: 1,
        latest: [
          {
            name: 'Ada Byron',
            limit: 'automationRules',
            note: 'Could we move Platform to Pro for Teams?',
            at: NOW,
          },
        ],
      },
    });
    const mine = (await get<MeResponse>('/me')).body.teams[1]!;
    expect(mine.askedAt).toBe(NOW);
    expect(mine.requests).toBeUndefined();
    // Nothing of who the admins are reaches the member, in the answer or in what was kept.
    expect(JSON.stringify(mine)).not.toMatch(/Dee|user_dee|@/);
    // Tomorrow the member may ask again, and is shown as not having asked.
    await at(NOW + DAY);
    expect((await get<MeResponse>('/me')).body.teams[1]!.askedAt).toBeUndefined();
  });

  it('names at most a few to an admin, counting everyone, and forgets requests after thirty days', async () => {
    const people = Array.from({ length: 7 }, (_, i) => ({ userId: `user_m${i}`, name: `M${i}` }));
    accounts.state.teams.team_2 = [{ userId: 'user_dee', role: 'admin' }, ...people];
    for (const [i, person] of people.entries()) {
      await at(NOW + i * 1000);
      const token = await keys.token(person.userId, {
        teams: [{ id: 'team_2', name: 'Platform', role: 'member' }],
      });
      expect((await ask('t:team_2', token)).res.status).toBe(200);
    }
    const dee = await keys.token('user_dee', {
      teams: [{ id: 'team_2', name: 'Platform', role: 'admin' }],
    });
    const requests = (await get<MeResponse>('/me', dee)).body.teams[0]!.requests!;
    expect(requests.count).toBe(7);
    expect(requests.latest.map((r) => r.name)).toEqual(['M6', 'M5', 'M4', 'M3', 'M2']);
    await at(NOW + 31 * DAY);
    const later = await keys.token('user_dee', {
      teams: [{ id: 'team_2', name: 'Platform', role: 'admin' }],
    });
    expect((await get<MeResponse>('/me', later)).body.teams[0]!.requests).toBeUndefined();
  });

  it('is only for a joined member of the team now, whatever the token says', async () => {
    for (const people of [
      [{ userId: 'user_ada', status: 'invited' as const }],
      [{ userId: 'user_dee', role: 'admin' as const }],
    ]) {
      accounts.state.teams.team_2 = people;
      const refused = await ask('t:team_2');
      expect(refused.res.status).toBe(403);
      expect(refused.body.error).toBe('not_team_member');
    }
    delete accounts.state.teams.team_2;
    expect((await ask('t:team_2')).body.error).toBe('not_team_member');
    expect(rows()).toEqual([]);
  });

  it('is refused to be tried again when accounts cannot say', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.state.down = true;
    const down = await ask('t:team_2');
    expect(down.res.status).toBe(503);
    expect(down.res.headers.get('Retry-After')).toBe('5');
    expect(down.body.error).toBe('accounts_unavailable');
    expect(rows()).toEqual([]);
  });

  it('sends nothing for a team that already subscribes, and a subscribing team answers its requests', async () => {
    await subscribe(db.env, 't:team_2', NOW);
    const paid = await ask('t:team_2');
    expect(paid.res.status).toBe(409);
    expect(paid.body.error).toBe('already_subscribed');
    expect(rows()).toEqual([]);
  });

  it('refuses what it cannot read: a person, a bad scope, an unknown limit', async () => {
    for (const [owner, limit] of [
      ['p:user_ada', null],
      ['team_2', null],
      ['t:', null],
      ['t:team_2', 'nope'],
      ['t:team_2', 7],
    ] as const) {
      expect((await ask(owner, ada, limit)).res.status, `${owner} ${limit}`).toBe(400);
    }
    for (const note of [7, 'x'.repeat(501)])
      expect((await ask('t:team_2', ada, null, db.env, note)).res.status).toBe(400);
    // An empty note is none.
    expect((await ask('t:team_2', ada, null, db.env, '   ')).res.status).toBe(200);
    expect(rows()).toMatchObject([{ note: null }]);
    db.sql.exec('DELETE FROM team_requests');
    expect(rows()).toEqual([]);
  });

  it('has a budget per account, and needs a signed-in person', async () => {
    const limiter = { limit: async () => ({ success: false }) };
    const env = { ...db.env, SUBSCRIPTION_RATE_LIMITER: limiter };
    const limited = await ask('t:team_2', ada, null, env);
    expect(limited.res.status).toBe(429);
    expect(limited.body.error).toBe('rate_limited');
    expect(
      (await call(db.env, '/team-request', fromPage(null, { owner: 't:team_2' }))).status,
    ).toBe(401);
    expect(rows()).toEqual([]);
  });
});

describe("You're Back on Free", () => {
  const dismiss = (owner: unknown, bearer = ada) =>
    post<{ ok: boolean }>('/ended/dismiss', { owner }, bearer);

  it('says when a paid tier ended, and what it was, for thirty days', async () => {
    await subscribe(db.env, 'p:user_ada', NOW - 40 * DAY, {
      state: 'cancelling',
      cancel_at_period_end: 1,
      period_end: NOW - DAY,
    });
    // Not yet swept: the moment the clock ended it.
    expect((await get<MeResponse>('/me')).body.personal).toMatchObject({
      tier: 'free',
      endedAt: NOW - DAY,
      endedTier: 'pro',
    });
    await at(NOW + 29 * DAY - 1);
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBe(NOW - DAY);
    await at(NOW + 29 * DAY);
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBeUndefined();
  });

  it('is never said while paid, or to an owner that never paid', async () => {
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBeUndefined();
    await subscribe(db.env, 'p:user_ada', NOW);
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBeUndefined();
  });

  it("is a team's admins' to read and dismiss, never a member's", async () => {
    await subscribe(db.env, 't:team_1', NOW - 40 * DAY, { state: 'ended', ended_at: NOW - DAY });
    await subscribe(db.env, 't:team_2', NOW - 40 * DAY, { state: 'ended', ended_at: NOW - DAY });
    const { teams } = (await get<MeResponse>('/me')).body;
    expect(teams[0]).toMatchObject({ role: 'admin', endedAt: NOW - DAY, endedTier: 'team' });
    expect(teams[1]!.role).toBe('member');
    expect(teams[1]).not.toHaveProperty('endedAt');
    expect(teams[1]).not.toHaveProperty('endedTier');
    // A member's dismiss is answered as if there were nothing to dismiss, and changes nothing.
    expect((await dismiss('t:team_2')).res.status).toBe(200);
    expect(
      db.sql.prepare("SELECT ended_seen FROM subscriptions WHERE owner = 't:team_2'").get(),
    ).toEqual({ ended_seen: 0 });
  });

  it('once dismissed is not said again in any browser, until a paid tier ends again', async () => {
    await subscribe(db.env, 'p:user_ada', NOW - 40 * DAY, { state: 'ended', ended_at: NOW - DAY });
    const done = await dismiss('p:user_ada');
    expect(done.res.status).toBe(200);
    expect(done.res.headers.get('Cache-Control')).toBe('no-store');
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBeUndefined();
    // Bea cannot dismiss Ada's.
    await subscribe(db.env, 'p:user_ada', NOW - 40 * DAY, { state: 'ended', ended_at: NOW - DAY });
    await dismiss('p:user_ada', bea);
    expect((await get<MeResponse>('/me')).body.personal.endedAt).toBe(NOW - DAY);
    // Subscribing again and lapsing again says it again.
    await dismiss('p:user_ada');
    await subscribe(db.env, 'p:user_ada', NOW, { period_end: NOW + DAY });
    await at(NOW + 5 * DAY);
    expect((await get<MeResponse>('/me')).body.personal).toMatchObject({
      endedAt: NOW + DAY + 3 * DAY,
    });
  });

  it('refuses a body it cannot read, and has a budget', async () => {
    expect((await dismiss('nobody')).res.status).toBe(400);
    const limiter = { limit: async () => ({ success: false }) };
    const env = { ...db.env, SUBSCRIPTION_RATE_LIMITER: limiter };
    expect((await post('/ended/dismiss', { owner: 'p:user_ada' }, ada, env)).res.status).toBe(429);
  });
});
