// An item's Automations on its owner's tier, in every app (liveworkspace/docs/specs/018-automations/automations.md
// "Runs, limits and loops"; 019-subscription "Tiers and limits"): the owner's runs a month spent, their rules counted
// over everything they own, AI credits spent, the fixed per-item bounds on every tier, and nothing asked with Pro off.
// The subscription service is a stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ItemTier,
  subscriptionClientOf,
  type EntitlementCache,
  type SubscriptionFetcher,
  type TierHead,
} from '@liveworkspace/subscription';
import { fakeSubscription, type FakeSubscription } from '@liveworkspace/subscription/testing';
import { AI_CREDITS_UNCHECKED, AI_CREDITS_USED } from '../../ai';
import type { ItemEvent, ItemRun } from '../../item';
import type { AutomationsAi } from '../automation-ai';
import { makeHookSecret, type HookCall } from '../automation-incoming';
import { listRuns } from '../automation-log';
import { MESSAGE_RUNS_USED } from '../automation-sends';
import {
  automationLimitsOf,
  leaveRuleCount,
  listTier,
  RUNS_USED,
  rulesAtLimit,
  rulesOverLimit,
} from '../tier';
import { answerItemHook } from './hook';
import { queueItemEvent } from './intake';
import type { ItemCaller } from './route-kit';
import { handleItemAutomationRoutes } from './routes';
import { ANA, world, type World } from './test-kit';
import { runItemAutomations } from './wake';

const OWNER = 'user_ana';
const ME = `p:${OWNER}`;
const EDITOR: ItemCaller = { editor: true, signedIn: true, person: ANA, reader: true };

let fake: FakeSubscription;
let cache: EntitlementCache;
let head: TierHead | null;
let fetcher: SubscriptionFetcher;
let tier: ItemTier;
let deferred: Promise<unknown>[];

function proWorld(
  tiers: Parameters<typeof fakeSubscription>[0] = {},
  over: Parameters<typeof world>[0] = {},
  pro = true,
): World {
  cache = new Map();
  fake = fakeSubscription(tiers, () => cache.clear());
  fetcher = fake.fetcher;
  head = { ownerId: OWNER, teamId: null, name: 'Launch Plan' };
  deferred = [];
  const env = {
    PRO_ENABLED: pro ? 'true' : 'false',
    SUBSCRIPTION_KEY: 'key',
    SUBSCRIPTION: { fetch: (input: string, init?: RequestInit) => fetcher.fetch(input, init) },
  };
  tier = new ItemTier({
    client: () => subscriptionClientOf(env, 'livedocuments.app', { cache }),
    head: () => head,
    defer: (work) => void deferred.push(work),
  });
  return world(over, { tier: () => tier });
}

async function call(w: World, method: string, path: string, body?: unknown) {
  const url = new URL(`https://app.example/api/documents/item-1/automations${path}`);
  const response = await handleItemAutomationRoutes({
    engine: w.engine,
    method,
    segments: url.pathname.split('/').slice(5),
    url,
    caller: EDITOR,
    request: new Request(url, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  });
  const text = await response!.text();
  return {
    status: response!.status,
    body: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
  };
}
const rules = (w: World, n: number) => {
  for (let i = 0; i < n; i += 1) w.rule({ name: `Rule ${i}` });
};
const body = (name: string) => ({
  name,
  trigger: { kind: 'manual' },
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Kept' }],
  chain: false,
  timeZone: 'UTC',
});
// A subscription changing reaches the item past the minute it keeps its limits.
const becomes = (owner: string, to: Parameters<FakeSubscription['set']>[1]) => {
  fake.set(owner, to);
  vi.setSystemTime(Date.now() + 61_000);
};

let n = 0;
const joined = (): ItemEvent => ({
  id: `e${(n += 1)}`,
  kind: 'joined',
  at: Date.now(),
  by: ANA,
  role: 'editor',
});
const fire = async (w: World) => {
  vi.setSystemTime(Date.now() + 1000);
  queueItemEvent(w.sql, w.engine, joined());
  await runItemAutomations(w.engine, Date.now());
  return listRuns<ItemRun>(w.sql, { limit: 50 });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.UTC(2027, 0, 4, 12));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// What the owner's other items hold, as the service sums them.
const elsewhere = (rules: number) => fake.items.set(`${ME}:rules:other-item`, rules);

describe('the Rules list', () => {
  it('says the fixed bounds and the owner, and the same bounds with Pro off', async () => {
    const w = proWorld();
    expect((await call(w, 'GET', '')).body).toMatchObject({
      runsPerDay: 1000,
      rulesMax: 50,
      owner: ME,
    });
    const off = proWorld({}, {}, false);
    const listed = (await call(off, 'GET', '')).body;
    expect(listed).toMatchObject({ runsPerDay: 1000, rulesMax: 50 });
    expect(listed['owner']).toBeUndefined();
    expect(fake.calls).toEqual([]);
  });

  it('keeps the fixed bounds while the room has no tier yet', async () => {
    const w = world({}, { tier: () => null });
    expect((await call(w, 'GET', '')).body).toMatchObject({ runsPerDay: 1000, rulesMax: 50 });
  });

  it('holds a guest’s item to Free’s rules itself, and counts nothing for an item that is nobody’s', async () => {
    const w = proWorld();
    head = { ownerId: 'guest_1', teamId: null, name: 'Guest Plan' };
    expect((await call(w, 'GET', '')).body).toMatchObject({ rulesMax: 25, guest: true });
    head = null;
    const nobody = (await call(w, 'GET', '')).body;
    expect(nobody).toMatchObject({ rulesMax: 50 });
    expect(nobody['owner']).toBeUndefined();
    expect(listTier({ runsPerDay: 1, rulesMax: 1 }, null)).toEqual({ runsPerDay: 1, rulesMax: 1 });
    expect(automationLimitsOf({ guest: false, limit: () => 3 as never })).toEqual({
      runsPerDay: 1000,
      rulesMax: 50,
    });
  });
});

describe('rules over the owner’s total', () => {
  it('refuses a rule past Free’s 25 over everything the owner holds, in the tier’s numbers, and a duplicate', async () => {
    const w = proWorld();
    rules(w, 5);
    elsewhere(20);
    const full = await call(w, 'POST', '', body('Sixth'));
    expect(full).toEqual({
      status: 409,
      body: { error: 'automation_rules_full', limit: 'automationRules', used: 25, max: 25 },
    });
    expect((await call(w, 'POST', '/r1/duplicate')).status).toBe(409);
    // The refusal recorded only what the item holds, never one more.
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(5);
  });

  it('takes the next rule straight after an upgrade, and counts it', async () => {
    const w = proWorld();
    rules(w, 5);
    elsewhere(20);
    expect((await call(w, 'POST', '', body('Sixth'))).status).toBe(409);
    fake.tiers.set(ME, 'pro');
    vi.setSystemTime(Date.now() + 6_000);
    expect((await call(w, 'POST', '', body('Sixth'))).status).toBe(201);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(6);
    expect((await call(w, 'POST', '/r1/duplicate')).status).toBe(201);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(7);
    expect((await call(w, 'DELETE', '/r1')).status).toBe(204);
    await Promise.all(deferred);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(6);
  });

  it('refuses at the item’s own 50 with no tier named, on any tier', async () => {
    const w = proWorld({ [ME]: 'pro' });
    rules(w, 50);
    expect(await call(w, 'POST', '', body('Fifty-first'))).toEqual({
      status: 409,
      body: { error: 'automation_rules_full' },
    });
  });

  it('refuses a guest’s item at Free’s 25, saying it is a guest’s', async () => {
    const w = proWorld();
    head = { ownerId: 'guest_1', teamId: null, name: 'Guest Plan' };
    rules(w, 25);
    await call(w, 'GET', '');
    expect(await call(w, 'POST', '', body('More'))).toEqual({
      status: 409,
      body: {
        error: 'automation_rules_full',
        limit: 'automationRules',
        used: 25,
        max: 25,
        guest: true,
      },
    });
  });

  it('adds the rule when the service refused the request itself: the item’s own bound holds', async () => {
    const w = proWorld();
    rules(w, 2);
    await tier.refresh();
    fetcher = { fetch: () => Promise.resolve(new Response('no', { status: 403 })) };
    expect((await call(w, 'POST', '', body('Third'))).status).toBe(201);
  });

  it('tells the count again when another add landed while it was asked', async () => {
    const w = proWorld();
    rules(w, 1);
    await tier.refresh();
    const count = tier.count.bind(tier);
    vi.spyOn(tier, 'count').mockImplementationOnce(async (...args) => {
      w.rule({ name: 'Landed Meanwhile' });
      return count(...args);
    });
    expect((await call(w, 'POST', '', body('Second'))).status).toBe(201);
    await Promise.all(deferred);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(3);
  });

  it('switches nothing on while the owner holds more than their tier, and does again at the limit', async () => {
    const w = proWorld({ [ME]: 'pro' });
    rules(w, 12);
    elsewhere(15);
    expect((await call(w, 'POST', '/r1/toggle', { enabled: false })).status).toBe(200);
    becomes(ME, 'free');
    await call(w, 'GET', '');
    expect((await call(w, 'POST', '/r2/toggle', { enabled: false })).status).toBe(200);
    expect((await call(w, 'POST', '/r3/toggle', { enabled: true })).status).toBe(200);
    expect(await call(w, 'POST', '/r1/toggle', { enabled: true })).toEqual({
      status: 409,
      body: { error: 'automation_rules_full', limit: 'automationRules', used: 27, max: 25 },
    });
    for (const id of ['r11', 'r12']) expect((await call(w, 'DELETE', `/${id}`)).status).toBe(204);
    await Promise.all(deferred);
    expect((await call(w, 'POST', '/r1/toggle', { enabled: true })).status).toBe(200);
  });

  it('takes a purged item’s rules off the owner’s total, and tells nothing with Pro off', async () => {
    const w = proWorld();
    rules(w, 3);
    expect((await call(w, 'POST', '', body('Fourth'))).status).toBe(201);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBe(4);
    vi.setSystemTime(Date.now() + 61_000);
    await leaveRuleCount(tier, 'item-1');
    await Promise.all(deferred);
    expect(fake.items.get(`${ME}:rules:item-1`)).toBeUndefined();
    const recount = vi.fn();
    await leaveRuleCount({ on: false, fresh: () => true, refresh: vi.fn(), recount }, 'x');
    expect(recount).not.toHaveBeenCalled();
    // Limits read within the minute: nothing is read again first.
    const refresh = vi.fn();
    await leaveRuleCount({ on: true, fresh: () => true, refresh, recount }, 'x');
    expect(refresh).not.toHaveBeenCalled();
    expect(recount).toHaveBeenCalledWith('rules', 'x', 0);
  });

  it('asks once more before refusing, and goes by the new limits when the upgrade landed', async () => {
    proWorld({ [ME]: 'pro' });
    await tier.refresh();
    const store = { runsPerDay: 1, rulesMax: 50 };
    expect(await rulesOverLimit(store, null, 51, 'i')).toMatchObject({ owner: false, max: 50 });
    expect(await rulesOverLimit(store, null, 50, 'i')).toBeNull();
    expect(await rulesAtLimit(store, null, 10, 'i')).toBeNull();
    const over = { ok: true, used: 30, limit: 25, tier: 'free' as const };
    const within = { ok: true, used: 30, limit: 500, tier: 'pro' as const };
    const refused = { ok: false, used: 25, limit: 25, tier: 'free' as const };
    const counting = (answers: unknown[], moved: boolean) => ({
      count: vi.fn(() => Promise.resolve(answers.shift() as typeof over)),
      recheck: () => Promise.resolve(moved),
    });
    expect(await rulesOverLimit(store, counting([over, within], true), 10, 'i')).toBeNull();
    expect(await rulesOverLimit(store, counting([over], false), 10, 'i')).toEqual({
      used: 30,
      max: 25,
      owner: true,
    });
    expect(await rulesOverLimit(store, counting([null], false), 10, 'i')).toBeNull();
    expect(await rulesAtLimit(store, counting([refused, within], true), 10, 'i')).toBeNull();
    expect(await rulesAtLimit(store, counting([refused], false), 10, 'i')).toEqual({
      used: 25,
      max: 25,
      owner: true,
    });
  });
});

// The day's fixed runs, for the bound's tests.
const fillDay = (w: World, n: number, at: number) =>
  w.sql.exec(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
     INSERT INTO automation_runs (id, rule_id, at, result, body) SELECT 'x' || i, 'r', ?, 'done', '{}' FROM n`,
    n,
    at,
  );

describe('runs over the owner’s month', () => {
  it('spends one of the owner’s runs for a run that acts, and none for a No Match', async () => {
    const w = proWorld();
    w.rule({ trigger: { kind: 'joined' } });
    w.rule({
      trigger: { kind: 'joined' },
      conditions: [{ kind: 'made_up' }],
    });
    const runs = await fire(w);
    expect(runs.map((r) => r.result).sort()).toEqual(['done', 'no_match']);
    expect(fake.spent.get(`${ME}:automationRuns`)).toBe(1);
    expect(w.engine.store.runsPerDay).toBe(1000);
  });

  it('with the month used, runs nothing, says so once a rule a day, and keeps the rule on', async () => {
    const w = proWorld();
    const rule = w.rule({ trigger: { kind: 'joined' } });
    fake.spent.set(`${ME}:automationRuns`, 500);
    expect(await fire(w)).toMatchObject([{ result: 'skipped', reason: RUNS_USED }]);
    vi.setSystemTime(Date.now() + 61_000);
    expect(await fire(w)).toHaveLength(1);
    expect(w.engine.store.get(rule.id)?.enabled).toBe(true);
    expect(w.engine.store.get(rule.id)?.paused).toBeUndefined();
    // The month turns: it runs again.
    vi.setSystemTime(Date.UTC(2027, 1, 1, 0, 5));
    fake.spent.clear();
    const runs = await fire(w);
    expect(runs.filter((r) => r.result === 'done')).toHaveLength(1);
  });

  it('measures the calls: one spend a run that acts, and none at all once a refusal says the month is used', async () => {
    const w = proWorld();
    const n = 10;
    for (let i = 0; i < n; i += 1) w.rule({ name: `Rule ${i}`, trigger: { kind: 'joined' } });
    const wake = async (events: number) => {
      vi.setSystemTime(Date.now() + 1000);
      for (let e = 0; e < events; e += 1) queueItemEvent(w.sql, w.engine, joined());
      const before = fake.to('spend').length;
      await runItemAutomations(w.engine, Date.now());
      return fake.to('spend').length - before;
    };
    // Every rule acts on each of the 3 events: 30 runs, 30 spends.
    expect(await wake(3)).toBe(3 * n);
    // The month runs out partway: the first refusal stops every later ask in the wake, whatever is queued.
    fake.spent.set(`${ME}:automationRuns`, 500 - 5);
    expect(await wake(3)).toBe(6);
    const lines = listRuns<ItemRun>(w.sql, { limit: 200 }).filter((r) => r.reason === RUNS_USED);
    // One line a rule a day (every rule met the used month on a later event), never one a trigger.
    expect(lines).toHaveLength(n);
    // Within the minute, a new wake asks nothing either.
    expect(await wake(2)).toBe(0);
  });

  it('runs on, uncounted, when the service refused the request itself', async () => {
    const w = proWorld();
    w.rule({ trigger: { kind: 'joined' } });
    await tier.refresh();
    fetcher = { fetch: () => Promise.resolve(new Response('no', { status: 403 })) };
    const [run] = await fire(w);
    expect(run!.result).toBe('done');
  });

  it('refuses Run Rule with the month used in the tier’s numbers, until the first of next month', async () => {
    const w = proWorld();
    w.rule({ id: 'by-hand', trigger: { kind: 'manual' } });
    fake.spent.set(`${ME}:automationRuns`, 500);
    const url = new URL('https://app.example/api/documents/item-1/automations/by-hand/run');
    const response = await handleItemAutomationRoutes({
      engine: w.engine,
      method: 'POST',
      segments: url.pathname.split('/').slice(5),
      url,
      caller: EDITOR,
      request: new Request(url, { method: 'POST', body: '{}' }),
    });
    expect(response!.status).toBe(429);
    expect(await response!.json()).toEqual({
      error: 'automation_runs_used',
      limit: 'automationRunsPerMonth',
      used: 500,
      max: 500,
    });
    expect(Number(response!.headers.get('Retry-After'))).toBe(
      (Date.UTC(2027, 1, 1) - Date.now()) / 1000,
    );
  });

  it('refuses Run Rule past the item’s 1,000 a day with no tier named', async () => {
    const w = proWorld();
    w.rule({ id: 'by-hand', trigger: { kind: 'manual' } });
    fillDay(w, 1000, Date.now());
    expect(await call(w, 'POST', '/by-hand/run', {})).toEqual({
      status: 429,
      body: { error: 'automation_budget_spent' },
    });
  });

  it('refuses an Incoming Webhook call past the day’s runs, and while the month is known used', async () => {
    const w = proWorld();
    const rule = w.rule({ trigger: { kind: 'incoming_webhook' } });
    const now = Date.now();
    const { secret } = await makeHookSecret(w.kit.hookUrl, w.sql, rule.id, now);
    const hookCall: HookCall = {
      body: new TextEncoder().encode('{}'),
      authorization: `Bearer ${secret}`,
      signature: null,
    };
    w.engine.store.runsUsed = { at: now, until: now + 1000, used: 500, max: 500 };
    expect(await answerItemHook(w.engine, rule.id, hookCall, now)).toMatchObject({
      status: 429,
      body: { error: 'automation_runs_used', limit: 'automationRunsPerMonth', used: 500, max: 500 },
    });
    // Past the minute the room asks again rather than refuse.
    expect(w.engine.store.monthUsed(now + 61_000)).toBeNull();
    fillDay(w, 1000, now);
    expect(await answerItemHook(w.engine, rule.id, hookCall, now)).toMatchObject({
      status: 429,
      body: { error: 'automation_budget_spent' },
    });
  });
});

describe('spends', () => {
  const summarise = (w: World) => {
    w.addTab('t1');
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        { kind: 'ai', task: 'summarise', tab: 't1' },
        { kind: 'take_snapshot', name: 'S: {{summary}}' },
      ],
    });
  };
  const ai: AutomationsAi = { run: () => Promise.resolve({ response: { summary: 'All good' } }) };

  it('spends an AI credit for an AI step, and skips the step with its place back when the month is used', async () => {
    const w = proWorld({}, { ai: { client: ai } });
    summarise(w);
    const [ran] = await fire(w);
    expect(ran!.result).toBe('done');
    expect(fake.spent.get(`${ME}:aiCredits`)).toBe(1);
    fake.spent.set(`${ME}:aiCredits`, 50);
    const [skipped] = await fire(w);
    expect(skipped!.result).toBe('skipped');
    expect(skipped!.reason).toBe(AI_CREDITS_USED);
    // The ask was not made: the day counts only the first.
    expect(w.sql.exec('SELECT asks FROM automation_ai_days').toArray()[0]).toEqual({ asks: 1 });
  });

  it('skips the AI step, offering no upgrade, when the service refused the request', async () => {
    const w = proWorld({}, { ai: { client: ai } });
    summarise(w);
    await tier.refresh();
    fetcher = { fetch: () => Promise.resolve(new Response('no', { status: 403 })) };
    const [run] = await fire(w);
    expect(run!.reason).toBe(AI_CREDITS_UNCHECKED);
  });

  it('spends a run for each message, and holds back one past the month: the run is Skipped', async () => {
    const w = proWorld();
    // The run's own takes the 500th; its message has none left.
    fake.spent.set(`${ME}:automationRuns`, 499);
    w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'notify', via: 'slack', webhook: 'c1', text: 'Hi' }],
    });
    const [run] = await fire(w);
    expect(run!.result).toBe('skipped');
    expect(run!.reason).toBe(MESSAGE_RUNS_USED);
    expect(w.posted).toHaveLength(0);
  });

  it('spends a credit for Describe a Rule, refusing in the tier’s numbers when the month is used', async () => {
    const reply = {
      outcome: 'rule',
      rule: { name: 'Snap', trigger: { kind: 'manual' }, conditions: [], steps: [] },
    };
    const w = proWorld({}, { ai: { client: { run: () => Promise.resolve({ response: reply }) } } });
    const ask = { prompt: 'Snapshot on demand', timeZone: 'Europe/Lisbon' };
    fake.spent.set(`${ME}:aiCredits`, 50);
    expect(await call(w, 'POST', '/draft', ask)).toMatchObject({
      status: 429,
      body: { error: 'automation_ai_credits_used', limit: 'aiCreditsPerMonth', used: 50, max: 50 },
    });
    // A refusal that knows no limit (the client could not count it) names none.
    vi.spyOn(tier, 'spend').mockResolvedValueOnce({
      ok: false,
      used: 0,
      limit: null,
      tier: 'free',
      unmetered: 'unreachable',
    });
    expect((await call(w, 'POST', '/draft', ask)).body).toMatchObject({ max: 0 });
    fetcher = { fetch: () => Promise.resolve(new Response('no', { status: 403 })) };
    expect(await call(w, 'POST', '/draft', ask)).toMatchObject({
      status: 503,
      body: { error: 'automation_ai_unavailable', message: AI_CREDITS_UNCHECKED },
    });
  });
});
