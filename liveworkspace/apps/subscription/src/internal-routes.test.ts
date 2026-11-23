// The internal routes over HTTP (subscription.md "Entitlement", "Meters"): an app's key, an owner's entitlement
// with a team's pooled limits, spends that can never pass the limit, gauges and per-item counts.
import {
  SPEND_AMOUNT_MAX,
  type Entitlement,
  type GaugeResult,
  type ItemCountResult,
  type SpendResult,
} from '@liveworkspace/subscription';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readOwners } from './meters/usage';
import { testDb, type TestDb } from './test-sqlite-d1';
import { asApp, call, DAY, subscribe } from './test-kit';

const NOW = Date.UTC(2026, 10, 20, 12);

let db: TestDb;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  db = testDb();
});
afterEach(() => {
  vi.useRealTimers();
});

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await asApp(db.env, path, body);
  expect(res.status, `${path} ${JSON.stringify(body)}`).toBe(200);
  return (await res.json()) as T;
};
const status = async (path: string, body: unknown) => (await asApp(db.env, path, body)).status;

describe("an app's key", () => {
  it("is needed, and must be the named app's own", async () => {
    const body = { owner: 'p:user_ada' };
    expect((await call(db.env, '/internal/entitlement', { method: 'POST' })).status).toBe(401);
    expect((await asApp(db.env, '/entitlement', body, 'livediagram.app', 'lp-key')).status).toBe(
      401,
    );
    expect((await asApp(db.env, '/entitlement', body, 'example.app')).status).toBe(401);
    expect((await asApp(db.env, '/entitlement', body, 'livedesign.app', '')).status).toBe(401);
    expect((await asApp(db.env, '/entitlement', body, 'liveplanner.app', 'lp-key')).status).toBe(
      200,
    );
    expect((await asApp(db.env, '/entitlement', body, 'liveworkspace.app', 'lw-key')).status).toBe(
      200,
    );
  });

  it('opens nothing for an app whose key is unset, or blank', async () => {
    const body = { owner: 'p:user_ada' };
    const unset = testDb({ SUBSCRIPTION_KEY_LIVEDIAGRAM: undefined });
    expect((await asApp(unset.env, '/entitlement', body)).status).toBe(401);
    const blank = testDb({ SUBSCRIPTION_KEY_LIVEDIAGRAM: ' ' });
    expect((await asApp(blank.env, '/entitlement', body, 'livediagram.app', ' ')).status).toBe(401);
  });

  it('never answers a browser: no CORS, even to a preflight', async () => {
    const res = await call(db.env, '/internal/spend', {
      method: 'OPTIONS',
      headers: { Origin: 'https://www.liveplanner.app' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers 404 for a route there is not, 405 for a GET and 400 for a body it cannot read', async () => {
    expect(await status('/nothing', { owner: 'p:user_ada' })).toBe(404);
    expect(await status('/toString', { owner: 'p:user_ada' })).toBe(404);
    const get = await call(db.env, '/internal/entitlement', {
      headers: { Authorization: 'Bearer ld-key', 'X-Subscription-App': 'livediagram.app' },
    });
    expect(get.status).toBe(405);
    for (const body of [{}, { owner: 'x:1' }, { owner: 'p:' }, [], 'p:user_ada', null]) {
      expect(await status('/entitlement', body)).toBe(400);
    }
    expect(await status('/entitlement', { owner: 'p:user_ada', pad: 'x'.repeat(5000) })).toBe(400);
  });
});

describe('entitlement', () => {
  it('is Free for an owner that never subscribed', async () => {
    const got = await post<Entitlement>('/entitlement', { owner: 'p:user_ada' });
    expect(got).toMatchObject({ owner: 'p:user_ada', tier: 'free', seats: 1 });
    expect(got.limits).toMatchObject({
      automationRules: 25,
      automationRunsPerMonth: 500,
      historyDays: 7,
    });
  });

  it("is Pro for a subscribed person, and a member's Pro never reaches a team", async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    expect(await post<Entitlement>('/entitlement', { owner: 'p:user_ada' })).toMatchObject({
      tier: 'pro',
      limits: { automationRules: 500, historyDays: null },
    });
    expect((await post<Entitlement>('/entitlement', { owner: 't:team_1' })).tier).toBe('free');
  });

  it("pools a team's per-member limits by its seats", async () => {
    await subscribe(db.env, 't:team_1', NOW, { seats: 6 });
    expect(await post<Entitlement>('/entitlement', { owner: 't:team_1' })).toMatchObject({
      tier: 'team',
      seats: 6,
      limits: {
        aiCreditsPerMonth: 3000,
        callMinutesPerMonth: 15_000,
        automationRules: 1500,
        publicRoadmaps: null,
      },
    });
  });

  it('follows the clock on every read, with no sweep', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, {
      state: 'cancelling',
      period_end: NOW + DAY,
    });
    await subscribe(db.env, 'p:user_bea', NOW, {
      state: 'past_due',
      grace_end: NOW + 7 * DAY,
      period_end: NOW + DAY,
    });
    await subscribe(db.env, 'p:user_cy', NOW, { period_end: NOW + DAY });
    const tier = async (owner: string) => (await post<Entitlement>('/entitlement', { owner })).tier;
    vi.setSystemTime(NOW + DAY);
    expect(await tier('p:user_ada')).toBe('free');
    expect(await tier('p:user_bea')).toBe('pro');
    // An active one is still Pro while its renewal is on its way, for three days and no longer.
    expect(await tier('p:user_cy')).toBe('pro');
    vi.setSystemTime(NOW + 4 * DAY - 1);
    expect(await tier('p:user_cy')).toBe('pro');
    vi.setSystemTime(NOW + 4 * DAY);
    expect(await tier('p:user_cy')).toBe('free');
    vi.setSystemTime(NOW + 7 * DAY);
    expect(await tier('p:user_bea')).toBe('free');
  });
});

describe('spend', () => {
  const spend = (owner: string, meter: string, amount: unknown = 1) =>
    post<SpendResult>('/spend', { owner, meter, amount });

  it('counts up to the limit and refuses past it, spending nothing', async () => {
    expect(await spend('p:user_ada', 'aiCredits', 49)).toEqual({
      ok: true,
      used: 49,
      limit: 50,
      tier: 'free',
    });
    expect(await spend('p:user_ada', 'aiCredits', 2)).toEqual({
      ok: false,
      used: 49,
      limit: 50,
      tier: 'free',
    });
    expect(await spend('p:user_ada', 'aiCredits', 1)).toEqual({
      ok: true,
      used: 50,
      limit: 50,
      tier: 'free',
    });
    expect(await spend('p:user_ada', 'aiCredits', 1)).toEqual({
      ok: false,
      used: 50,
      limit: 50,
      tier: 'free',
    });
  });

  it('refuses a first spend larger than the limit', async () => {
    expect(await spend('p:user_ada', 'aiCredits', 51)).toEqual({
      ok: false,
      used: 0,
      limit: 50,
      tier: 'free',
    });
  });

  it("spends Free's 500 automation runs, then refuses the next", async () => {
    expect(await spend('p:user_ada', 'automationRuns', 500)).toEqual({
      ok: true,
      used: 500,
      limit: 500,
      tier: 'free',
    });
    expect(await spend('p:user_ada', 'automationRuns')).toEqual({
      ok: false,
      used: 500,
      limit: 500,
      tier: 'free',
    });
  });

  it('ignores a retired meter’s counter: Webhook Deliveries spends nothing now', async () => {
    db.sql
      .prepare(
        "INSERT INTO spend_counters VALUES ('p:user_ada', 'webhookDeliveries', '2026-11', 5, 0)",
      )
      .run();
    expect(
      await status('/spend', { owner: 'p:user_ada', meter: 'webhookDeliveries', amount: 1 }),
    ).toBe(400);
    expect(
      (await readOwners(db.env.SUBSCRIPTION_DB, ['p:user_ada'], NOW)).usage.get('p:user_ada'),
    ).toBeUndefined();
  });

  it("spends at the owner's tier: Pro's limit, and a team's pooled by its seats", async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    await subscribe(db.env, 't:team_1', NOW, { seats: 4 });
    expect(await spend('p:user_ada', 'aiCredits', 1000)).toMatchObject({
      ok: true,
      limit: 1000,
      tier: 'pro',
    });
    expect(await spend('p:user_ada', 'aiCredits')).toMatchObject({
      ok: false,
      used: 1000,
      tier: 'pro',
    });
    expect(await spend('t:team_1', 'callMinutes', 1000)).toMatchObject({
      ok: true,
      limit: 10_000,
      tier: 'team',
    });
    // Automation runs, emails and form responses pool by member too.
    expect(await spend('t:team_1', 'automationRuns', 5)).toMatchObject({ ok: true, limit: 20_000 });
    expect(await spend('t:team_1', 'emailToBoard')).toMatchObject({ ok: true, limit: 20_000 });
    expect(await spend('t:team_1', 'formResponses')).toMatchObject({ ok: true, limit: 20_000 });
  });

  it('never pools for fewer than three seats', async () => {
    await subscribe(db.env, 't:team_1', NOW);
    db.sql.prepare("UPDATE subscriptions SET seats = 1 WHERE owner = 't:team_1'").run();
    expect((await spend('t:team_1', 'aiCredits')).limit).toBe(1500);
  });

  it('falls back to the Free limit the moment the clock ends the subscription', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { state: 'cancelling', period_end: NOW + DAY });
    expect(await spend('p:user_ada', 'aiCredits', 60)).toMatchObject({ ok: true, tier: 'pro' });
    vi.setSystemTime(NOW + DAY);
    expect(await spend('p:user_ada', 'aiCredits')).toEqual({
      ok: false,
      used: 60,
      limit: 50,
      tier: 'free',
    });
  });

  it('keeps past_due spending at the paid tier through the grace', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, {
      state: 'past_due',
      grace_end: NOW + 7 * DAY,
      period_end: NOW,
    });
    // Past Free's 500 is still within Pro's 10,000 through the grace, and refused once it ends.
    expect(await spend('p:user_ada', 'automationRuns', 501)).toMatchObject({
      ok: true,
      tier: 'pro',
    });
    vi.setSystemTime(NOW + 7 * DAY);
    expect(await spend('p:user_ada', 'automationRuns')).toMatchObject({
      ok: false,
      tier: 'free',
    });
  });

  it('starts again each UTC month and keeps owners and meters apart', async () => {
    await spend('p:user_ada', 'aiCredits', 50);
    expect((await spend('p:user_bea', 'aiCredits', 50)).ok).toBe(true);
    expect((await spend('p:user_ada', 'callMinutes', 50)).used).toBe(50);
    vi.setSystemTime(Date.UTC(2026, 11, 1));
    expect(await spend('p:user_ada', 'aiCredits')).toMatchObject({ ok: true, used: 1 });
  });

  it('never passes the limit under concurrent spends', async () => {
    const results = await Promise.all(
      Array.from({ length: 80 }, () => spend('p:user_ada', 'aiCredits')),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(50);
    expect(db.sql.prepare('SELECT used FROM spend_counters').get()).toEqual({ used: 50 });
    const uneven = await Promise.all(
      Array.from({ length: 30 }, () => spend('p:user_bea', 'aiCredits', 7)),
    );
    expect(uneven.filter((result) => result.ok)).toHaveLength(7);
    expect(
      db.sql.prepare("SELECT used FROM spend_counters WHERE owner = 'p:user_bea'").get(),
    ).toEqual({ used: 49 });
  });

  it('takes a positive whole amount up to the largest single spend, and a known meter', async () => {
    for (const amount of [0, -1, 1.5, '1', null, SPEND_AMOUNT_MAX + 1, Number.MAX_SAFE_INTEGER]) {
      expect(await status('/spend', { owner: 'p:user_ada', meter: 'aiCredits', amount })).toBe(400);
    }
    expect(await status('/spend', { owner: 'p:user_ada', meter: 'aiCredits' })).toBe(400);
    expect(await status('/spend', { owner: 'p:user_ada', meter: 'rules', amount: 1 })).toBe(400);
    await subscribe(db.env, 'p:user_ada', NOW);
    expect((await spend('p:user_ada', 'aiCredits', SPEND_AMOUNT_MAX)).ok).toBe(true);
  });

  it('is one statement on the way through, well inside a CPU budget', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const prepare = vi.spyOn(db.env.SUBSCRIPTION_DB, 'prepare');
    await spend('p:user_ada', 'automationRuns');
    expect(prepare).toHaveBeenCalledTimes(1);
    prepare.mockClear();
    await post<Entitlement>('/entitlement', { owner: 'p:user_ada' });
    expect(prepare).toHaveBeenCalledTimes(1);
    const ms = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 200; i++) await spend('p:user_ada', 'automationRuns');
    });
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });
});

describe('gauges', () => {
  const gauge = (body: Record<string, unknown>) =>
    post<GaugeResult>('/gauge', { owner: 'p:user_ada', ...body });
  const add = (key: string, owner = 'p:user_ada') =>
    gauge({ owner, gauge: 'publicRoadmaps', op: 'add', key });

  it('adds up to the limit and refuses the next, recording nothing', async () => {
    expect(await add('board-1')).toEqual({ ok: true, used: 1, limit: 1, tier: 'free' });
    expect(await add('board-2')).toEqual({ ok: false, used: 1, limit: 1, tier: 'free' });
    expect(db.sql.prepare('SELECT key FROM gauge_entries').all()).toEqual([{ key: 'board-1' }]);
  });

  it('answers an entry already there as a success that changes nothing, even at the limit', async () => {
    await add('board-1');
    expect(await add('board-1')).toEqual({ ok: true, used: 1, limit: 1, tier: 'free' });
  });

  it('frees room when an entry is removed, and removing one never there is fine', async () => {
    await add('board-1');
    expect(await gauge({ gauge: 'publicRoadmaps', op: 'remove', key: 'board-1' })).toMatchObject({
      ok: true,
      used: 0,
    });
    expect(await gauge({ gauge: 'publicRoadmaps', op: 'remove', key: 'never' })).toMatchObject({
      ok: true,
      used: 0,
    });
    expect((await add('board-2')).ok).toBe(true);
  });

  it("counts against the owner's tier, with no limit where the tier has none", async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    await subscribe(db.env, 't:team_1', NOW);
    for (let i = 0; i < 10; i++) expect((await add(`board-${i}`)).ok).toBe(true);
    expect(await add('board-10')).toEqual({ ok: false, used: 10, limit: 10, tier: 'pro' });
    for (let i = 0; i < 12; i++) await add(`board-${i}`, 't:team_1');
    expect(await add('board-12', 't:team_1')).toEqual({
      ok: true,
      used: 13,
      limit: null,
      tier: 'team',
    });
  });

  it('keeps what an owner holds over a new limit, and adds no more', async () => {
    await subscribe(db.env, 'p:user_ada', NOW, { state: 'cancelling', period_end: NOW + DAY });
    for (let i = 0; i < 4; i++) await add(`board-${i}`);
    vi.setSystemTime(NOW + DAY);
    expect(await add('board-9')).toEqual({ ok: false, used: 4, limit: 1, tier: 'free' });
    expect(await add('board-0')).toMatchObject({ ok: true, used: 4 });
  });

  it('never passes the limit under concurrent adds', async () => {
    await subscribe(db.env, 'p:user_ada', NOW);
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => add(`board-${i}`)));
    expect(results.filter((result) => result.ok)).toHaveLength(10);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM gauge_entries').get()).toEqual({ n: 10 });
  });

  it('holds nothing of what media counts: Image Storage and Walkthroughs Stored are not gauges here', async () => {
    for (const body of [
      { gauge: 'imageStorageBytes', op: 'set', value: 77 },
      { gauge: 'publicRoadmaps', op: 'set', value: 77 },
      { gauge: 'walkthroughsStored', op: 'add', key: 'w1' },
      { gauge: 'imageStorageBytes', op: 'add', key: 'i1' },
    ]) {
      expect(await status('/gauge', { owner: 'p:user_ada', ...body })).toBe(400);
    }
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM gauge_entries').get()).toEqual({ n: 0 });
  });

  it('refuses a request it cannot read', async () => {
    const bad = [
      { gauge: 'rules', op: 'add', key: 'k' },
      { gauge: 'publicRoadmaps', op: 'add' },
      { gauge: 'publicRoadmaps', op: 'add', key: '' },
      { gauge: 'publicRoadmaps', op: 'add', key: 'k'.repeat(201) },
      { gauge: 'publicRoadmaps', op: 'drop', key: 'k' },
    ];
    for (const body of bad)
      expect(await status('/gauge', { owner: 'p:user_ada', ...body })).toBe(400);
  });
});

describe('item counts', () => {
  const count = (body: Record<string, unknown>) =>
    post<ItemCountResult>('/item-count', { owner: 'p:user_ada', ...body });
  const usage = async (owner = 'p:user_ada') =>
    (await readOwners(db.env.SUBSCRIPTION_DB, [owner as 'p:x'], Date.now())).usage.get(
      owner as 'p:x',
    ) ?? {};

  it("sums the owner's items of each meter", async () => {
    expect(await count({ meter: 'rules', item: 'plan-1', used: 7, adding: true })).toEqual({
      ok: true,
      used: 7,
      limit: 25,
      tier: 'free',
    });
    expect(await count({ meter: 'rules', item: 'doc-1', used: 3 })).toMatchObject({ used: 10 });
    await count({ meter: 'pages', item: 'kb-1', used: 30 });
    expect(await usage()).toEqual({ rules: { used: 10 }, pages: { used: 30 } });
  });

  it('refuses a count that grows past the limit when adding, and records any other', async () => {
    await count({ meter: 'rules', item: 'plan-1', used: 20 });
    expect(await count({ meter: 'rules', item: 'plan-2', used: 5, adding: true })).toMatchObject({
      ok: true,
      used: 25,
    });
    expect(await count({ meter: 'rules', item: 'plan-2', used: 6, adding: true })).toEqual({
      ok: false,
      used: 25,
      limit: 25,
      tier: 'free',
    });
    // An item that already holds more keeps it, and a count that does not grow is always taken.
    expect(await count({ meter: 'rules', item: 'plan-3', used: 4 })).toMatchObject({
      ok: true,
      used: 29,
    });
    expect(await count({ meter: 'rules', item: 'plan-3', used: 4, adding: true })).toMatchObject({
      ok: true,
      used: 29,
    });
    expect(await count({ meter: 'rules', item: 'plan-3', used: 3, adding: true })).toMatchObject({
      ok: true,
      used: 28,
    });
    // A refused first count of a new item says what the others hold.
    expect(await count({ meter: 'rules', item: 'plan-4', used: 1, adding: true })).toMatchObject({
      ok: false,
      used: 28,
    });
  });

  it("counts against the owner's tier, a team's pooled by its seats", async () => {
    await subscribe(db.env, 't:team_1', NOW, { seats: 4 });
    expect(
      await count({ owner: 't:team_1', meter: 'pages', item: 'kb-1', used: 20_000, adding: true }),
    ).toEqual({ ok: true, used: 20_000, limit: 20_000, tier: 'team' });
  });

  it('drops an item counted at zero, and says what the rest hold', async () => {
    await count({ meter: 'rules', item: 'plan-1', used: 7 });
    await count({ meter: 'rules', item: 'plan-2', used: 2 });
    expect(await count({ meter: 'rules', item: 'plan-1', used: 0 })).toMatchObject({
      ok: true,
      used: 2,
    });
    await count({ meter: 'rules', item: 'plan-2', used: 0 });
    expect(await usage()).toEqual({});
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM item_usage').get()).toEqual({ n: 0 });
  });

  it('refuses a request it cannot read', async () => {
    const bad = [
      { meter: 'aiCredits', item: 'i', used: 1 },
      { meter: 'rules', used: 1 },
      { meter: 'rules', item: 'i'.repeat(201), used: 1 },
      { meter: 'rules', item: 'i', used: -1 },
      { meter: 'rules', item: 'i', used: 1.5 },
      { meter: 'rules', item: 'i' },
      { meter: 'rules', item: 'i', used: 1, adding: 'yes' },
    ];
    for (const body of bad)
      expect(await status('/item-count', { owner: 'p:user_ada', ...body })).toBe(400);
  });
});

describe('usage for several owners at once', () => {
  it('reads every owner in one batch, spend, gauges and items together', async () => {
    await subscribe(db.env, 't:team_1', NOW);
    await post('/spend', { owner: 'p:user_ada', meter: 'aiCredits', amount: 4 });
    await post('/spend', { owner: 't:team_1', meter: 'callMinutes', amount: 9 });
    await post('/gauge', { owner: 't:team_1', gauge: 'publicRoadmaps', op: 'add', key: 'w1' });
    await post('/gauge', { owner: 't:team_1', gauge: 'publicRoadmaps', op: 'add', key: 'w2' });
    await post('/item-count', { owner: 't:team_1', meter: 'rules', item: 'plan-1', used: 3 });
    const batch = vi.spyOn(db.env.SUBSCRIPTION_DB, 'batch');
    const read = await readOwners(
      db.env.SUBSCRIPTION_DB,
      ['p:user_ada', 't:team_1', 't:team_1', 'p:nobody'],
      NOW,
    );
    expect(batch).toHaveBeenCalledTimes(1);
    expect([...read.subscriptions.keys()]).toEqual(['t:team_1']);
    expect(read.usage.get('p:user_ada')).toEqual({ aiCredits: { used: 4 } });
    expect(read.usage.get('t:team_1')).toEqual({
      callMinutes: { used: 9 },
      publicRoadmaps: { used: 2 },
      rules: { used: 3 },
    });
    expect(read.usage.has('p:nobody')).toBe(false);
  });

  it('splits more owners than one statement binds, and ignores a meter it does not know', async () => {
    db.sql
      .prepare("INSERT INTO spend_counters VALUES ('p:user_ada', 'retired', '2026-11', 5, 0)")
      .run();
    db.sql.prepare("INSERT INTO gauge_entries VALUES ('p:user_ada', 'retired', 'k', 0)").run();
    db.sql.prepare("INSERT INTO item_usage VALUES ('p:user_ada', 'retired', 'i', 5, 0)").run();
    await post('/spend', { owner: 'p:user_199', meter: 'aiCredits', amount: 2 });
    const owners = Array.from({ length: 200 }, (_, i) => `p:user_${i}` as const);
    const batch = vi.spyOn(db.env.SUBSCRIPTION_DB, 'batch');
    const read = await readOwners(db.env.SUBSCRIPTION_DB, ['p:user_ada', ...owners], NOW);
    expect(batch).toHaveBeenCalledTimes(3);
    expect(read.usage.get('p:user_199')).toEqual({ aiCredits: { used: 2 } });
    expect(read.usage.get('p:user_ada')).toBeUndefined();
  });
});
