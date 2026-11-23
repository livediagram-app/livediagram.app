import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule, AutomationRun } from '@liveplanner/items';
import type { AutomationErrorBody, AutomationsListResponse } from '@liveplanner/api-schema';
import { endRepeatWorld, OWNER } from '../test-repeat-world';
import {
  automationWorld,
  identityOf,
  ruleBody,
  type AutomationWorld,
} from './test-automation-world';
import { fakeSubscription, setPlanOwner, type FakeSubscription } from '../tier/test-tier';
import { copiedRuleStatements, rulesFromFile } from './automation-copy';
import { rulesCopyMax } from '../tier/room-tier';
import { RUNS_USED } from '@liveworkspace/automations/room';

// The plan's tier's limits on its Automations (docs/specs/026-plan/automations.md "Tiers"): with Pro on the runs a
// month and the rules are its OWNER's, over everything they own, whoever acts; the plan's own 1,000 runs a day and 50
// rules hold on every tier, and alone with Pro off. End to end through the real worker and room, the subscription
// service a stand-in (tier/test-tier.ts).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const ME = `p:${OWNER}`;

let w: AutomationWorld;
let fake: FakeSubscription;
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

// A subscription that starts or ends reaches a plan within a minute (the room keeps its limits that long): the
// owner's tier set, and the minute passed.
const becomes = (owner: string, tier: Parameters<FakeSubscription['set']>[1]) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  fake.set(owner, tier);
  vi.setSystemTime(Date.now() + 61_000);
};

const on = async (tiers: Parameters<typeof fakeSubscription>[0] = {}) => {
  fake = fakeSubscription(tiers);
  w = await automationWorld('A', { pro: fake });
};
const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const list = async () => (await w.call('GET', '')).json<AutomationsListResponse>();
const rules = async (n: number) => {
  for (let i = 0; i < n; i += 1) await w.rule({ name: `Rule ${i}` });
};
const add = (name: string, who: Parameters<AutomationWorld['call']>[3] = 'owner') =>
  w.call('POST', '', ruleBody({ name }), who);
// `n` runs made today, as the Audit Trail counts them.
const ranToday = (n: number) => {
  const insert = plan().db.prepare(
    "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', '{}')",
  );
  for (let i = 0; i < n; i += 1) insert.run(`old${i}`, Date.now());
};
const manual = () => w.rule({ name: 'By hand', trigger: { kind: 'manual' } });
const runNow = async (rule: AutomationRule) => {
  const c = await w.make('A', { title: 'Card' });
  return w.call('POST', `/${rule.id}/run`, { item: c.id });
};

// What the owner's other items hold, as the service sums them.
const elsewhere = (n: number, owner = ME) => fake.items.set(`${owner}:rules:other-plan`, n);
const hook = async (rule: AutomationRule) => {
  const made = await (await w.call('POST', `/${rule.id}/secret`)).json<{ secret: string }>();
  return () =>
    w.raw(
      new Request(`https://api.test/api/hooks/automations/A/${rule.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${made.secret}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
    );
};

describe('with Pro off', () => {
  beforeEach(async () => {
    // The service is there to be asked, and the flag is not set: nothing may ask it.
    fake = fakeSubscription({ [ME]: 'pro' });
    w = await automationWorld();
    Object.assign(w.env, { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
    plan().restart();
  });

  it('keeps the plan’s own limits, names no owner and never asks the subscription service', async () => {
    expect(await list()).toMatchObject({ runsPerDay: 1000, rulesMax: 50 });
    expect((await list()).owner).toBeUndefined();
    await rules(50);
    const full = await add('One too many');
    expect(full.status).toBe(409);
    // The refusal's body as it always was: no limit named.
    expect(await full.json()).toEqual({ error: 'automation_rules_full' });
    expect(fake.calls).toEqual([]);
  });

  it('runs up to the plan’s 1,000 a day, and refuses there as it always did', async () => {
    const rule = await manual();
    ranToday(999);
    expect((await runNow(rule)).status).toBe(200);
    const spent = await runNow(rule);
    expect(spent.status).toBe(429);
    expect(await spent.json()).toEqual({ error: 'automation_budget_spent' });
    await room().alarm();
    expect(fake.calls).toEqual([]);
  });

  it('keeps a copy’s and a file’s rules to the plan’s 50', () => {
    expect(rulesCopyMax()).toBe(50);
  });
});

describe('rules over the owner’s total', () => {
  it('refuses the rule past Free’s 25 over everything the owner holds, and a duplicate with it', async () => {
    await on();
    await rules(5);
    elsewhere(20);
    expect(await list()).toMatchObject({ runsPerDay: 1000, rulesMax: 50, owner: ME });
    const full = await add('Sixth');
    expect(full.status).toBe(409);
    expect(await full.json<AutomationErrorBody>()).toEqual({
      error: 'automation_rules_full',
      limit: 'automationRules',
      used: 25,
      max: 25,
    });
    const [first] = (await list()).rules;
    const copy = await w.call('POST', `/${first!.id}/duplicate`);
    expect(copy.status).toBe(409);
    expect(await copy.json()).toMatchObject({ limit: 'automationRules', max: 25 });
  });

  it('allows more on Pro, and counts each add and delete for the owner', async () => {
    await on({ [ME]: 'pro' });
    elsewhere(20);
    await rules(2);
    expect((await add('Third')).status).toBe(201);
    expect(fake.items.get(`${ME}:rules:A`)).toBe(3);
    const [first] = (await list()).rules;
    expect((await w.call('POST', `/${first!.id}/duplicate`)).status).toBe(201);
    expect(fake.items.get(`${ME}:rules:A`)).toBe(4);
    await w.call('DELETE', `/${first!.id}`);
    expect(fake.items.get(`${ME}:rules:A`)).toBe(3);
  });

  it('refuses at the plan’s own 50 with no tier named, on any tier', async () => {
    await on({ [ME]: 'pro' });
    await rules(50);
    const full = await add('Fifty-first');
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'automation_rules_full' });
  });

  it('takes the next rule straight after an upgrade, asking for the limits once more before it refuses', async () => {
    await on({});
    await rules(5);
    elsewhere(20);
    expect((await add('Sixth')).status).toBe(409);
    // The owner pays; the room and the client both still remember Free.
    fake.tiers.set(ME, 'pro');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6_000);
    expect((await add('Sixth')).status).toBe(201);
  });

  it('switches nothing on while the owner holds more rules than their tier, and does again at the limit', async () => {
    await on({ [ME]: 'pro' });
    await rules(12);
    elsewhere(15);
    const held = (await list()).rules;
    const toggle = (id: string, enabled: boolean) => w.call('POST', `/${id}/toggle`, { enabled });
    expect((await toggle(held[0]!.id, false)).status).toBe(200);
    becomes(ME, 'free');
    // Over Free's 25: switching off and keeping on are fine, switching on is refused in the tier's numbers.
    expect((await toggle(held[1]!.id, false)).status).toBe(200);
    expect((await toggle(held[2]!.id, true)).status).toBe(200);
    const refused = await toggle(held[0]!.id, true);
    expect(refused.status).toBe(409);
    expect(await refused.json<AutomationErrorBody>()).toEqual({
      error: 'automation_rules_full',
      limit: 'automationRules',
      used: 27,
      max: 25,
    });
    // Down to 25, the limit exactly: every rule may be on.
    for (const r of held.slice(10)) await w.call('DELETE', `/${r.id}`);
    expect((await toggle(held[0]!.id, true)).status).toBe(200);
  });

  it('counts a collaborator’s rule against the owner, never the person acting', async () => {
    // The plan is a Pro person's; the Editor on its link is not that person.
    await on({ 'p:user_ada': 'pro' });
    setPlanOwner(plan().db, 'A', 'user_ada');
    elsewhere(30, 'p:user_ada');
    expect((await add('More', 'editor_link')).status).toBe(201);
    expect(await list()).toMatchObject({ owner: 'p:user_ada' });
    expect(fake.items.get('p:user_ada:rules:A')).toBe(1);
  });

  it('holds a Free owner’s plan to Free when the person acting has Pro themselves', async () => {
    await on({ 'p:user_2abcdefghijklmnopqrstuvwxyz1': 'pro' });
    setPlanOwner(plan().db, 'A', 'user_ada');
    elsewhere(25, 'p:user_ada');
    expect((await add('More', 'editor_link')).status).toBe(409);
  });

  it('applies the team’s tier to a team’s plan, whatever its members hold', async () => {
    // A Pro person's plan in a Free team's library: the team's Free.
    await on({ [ME]: 'pro' });
    setPlanOwner(plan().db, 'A', OWNER, 'team_1');
    elsewhere(25, 't:team_1');
    expect((await add('More', 'team')).status).toBe(409);
    expect(await list()).toMatchObject({ owner: 't:team_1' });
    // The team subscribes: its limit, though the member acting is Free.
    becomes('t:team_1', 'team');
    becomes(ME, 'free');
    expect((await add('More', 'team')).status).toBe(201);
  });

  it('ignores a tier a request claims in its body or headers', async () => {
    await on();
    elsewhere(25);
    const claimed = await w.call('POST', '', {
      ...ruleBody({ name: 'More' }),
      tier: 'pro',
      limits: { automationRules: 999 },
      owner: 'p:user_ada',
    });
    expect(claimed.status).toBe(409);
    const headed = await room().route(
      'A',
      new Request('https://api.test/api/projects/A/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tier': 'pro',
          'X-Subscription-Tier': 'team',
          'X-Subscription-App': 'liveplanner.app',
          'X-Owner-Scope': 'p:user_ada',
        },
        body: JSON.stringify(ruleBody({ name: 'More' })),
      }),
      identityOf('A', 'owner'),
    );
    expect(headed.status).toBe(409);
    expect((await list()).rules).toHaveLength(0);
  });

  it('keeps every rule running and editable once the tier dropped, and takes no new one until under', async () => {
    await on({ [ME]: 'pro' });
    await rules(12);
    elsewhere(14);
    becomes(ME, 'free');
    const held = await list();
    expect(held.rules).toHaveLength(12);
    expect(held.rules.every((r) => r.enabled)).toBe(true);
    const [first, second] = held.rules;
    expect((await w.call('PUT', `/${first!.id}`, ruleBody({ name: 'Renamed' }))).status).toBe(200);
    // The others still run.
    const c = await w.make('A', { title: 'Ship' });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    await room().alarm();
    expect((await w.items('A')).find((i) => i.id === c.id)!.fields['labels']).toEqual(['shipped']);
    // No new one at 26, nor at 25: only under the limit.
    expect((await add('New')).status).toBe(409);
    await w.call('DELETE', `/${first!.id}`);
    expect((await add('New')).status).toBe(409);
    await w.call('DELETE', `/${second!.id}`);
    expect((await add('New')).status).toBe(201);
  });

  it('keeps a copy’s and a file’s rules up to the limit handed in', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...ruleBody({ name: `R${i}` }) }));
    expect(rulesFromFile(many, 1)).toHaveLength(50);
    expect(rulesFromFile(many, 1, new Map(), [], 500)).toHaveLength(60);
    const env = { PLAN_DB: { prepare: () => ({ bind: () => ({}) }) } } as never;
    const stored = rulesFromFile(many, 1, new Map(), [], 500);
    expect(copiedRuleStatements(env, stored, 1)).toHaveLength(50);
    expect(copiedRuleStatements(env, stored, 1, 500)).toHaveLength(60);
  });
});

describe('runs over the owner’s month', () => {
  it('spends one of the owner’s runs for a run that acts, and none for a test', async () => {
    await on();
    const rule = await manual();
    expect((await runNow(rule)).status).toBe(200);
    expect(fake.spent.get(`${ME}:automationRuns`)).toBe(1);
    const c = await w.make('A', { title: 'Tried' });
    expect((await w.call('POST', '/test', { rule: ruleBody({}), item: c.id })).status).toBe(200);
    expect(fake.spent.get(`${ME}:automationRuns`)).toBe(1);
  });

  it('refuses Run Rule once the month is used, in the tier’s numbers until the 1st', async () => {
    await on();
    const rule = await manual();
    fake.spent.set(`${ME}:automationRuns`, 500);
    const used = await runNow(rule);
    expect(used.status).toBe(429);
    expect(await used.json()).toEqual({
      error: 'automation_runs_used',
      limit: 'automationRunsPerMonth',
      used: 500,
      max: 500,
    });
    expect(Number(used.headers.get('Retry-After'))).toBeGreaterThan(0);
    // The rule stays on, and the Audit Trail says it once.
    expect((await list()).rules[0]!.enabled).toBe(true);
    const lines = await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>();
    expect(lines.runs.filter((r) => r.reason === RUNS_USED)).toHaveLength(1);
  });

  it('holds a wake to the month: a trigger past it runs nothing, and asks the service once', async () => {
    await on();
    await w.rule({});
    await w.rule({ name: 'Second' });
    fake.spent.set(`${ME}:automationRuns`, 500);
    for (const title of ['One', 'Two']) {
      const c = await w.make('A', { title });
      await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    }
    await room().alarm();
    expect((await w.items('A')).every((i) => i.fields['labels'] === undefined)).toBe(true);
    expect(fake.to('spend')).toHaveLength(1);
  });

  it('answers an Incoming Webhook call 429 while the month is known used, and past the plan’s day', async () => {
    await on();
    const manualRule = await manual();
    const call = await hook(await w.rule({ name: 'Hook', trigger: { kind: 'incoming_webhook' } }));
    fake.spent.set(`${ME}:automationRuns`, 500);
    expect((await runNow(manualRule)).status).toBe(429);
    const month = await call();
    expect(month.status).toBe(429);
    expect(await month.json()).toMatchObject({ error: 'automation_runs_used', max: 500 });
    ranToday(1000);
    const day = await call();
    expect(day.status).toBe(429);
    expect(await day.json()).toEqual({ error: 'automation_budget_spent' });
  });

  it('refuses Run Rule past the plan’s 1,000 a day with no tier named', async () => {
    await on({ [ME]: 'pro' });
    const rule = await manual();
    ranToday(1000);
    const spent = await runNow(rule);
    expect(spent.status).toBe(429);
    expect(await spent.json()).toEqual({ error: 'automation_budget_spent' });
    expect(await list()).toMatchObject({ runsToday: 1000, runsPerDay: 1000 });
  });

  it('spends the team’s month on a team’s plan when the person acting is Free', async () => {
    await on({ 't:team_1': 'team' });
    setPlanOwner(plan().db, 'A', OWNER, 'team_1');
    const rule = await manual();
    const c = await w.make('A', { title: 'Card' });
    const run = await w.call('POST', `/${rule.id}/run`, { item: c.id }, 'team');
    expect(run.status).toBe(200);
    expect((await run.json<{ run: AutomationRun }>()).run.result).toBe('done');
    expect(fake.spent.get('t:team_1:automationRuns')).toBe(1);
  });
});

describe('what the subscription service is asked and told', () => {
  it('reads the owner’s entitlement once for a busy plan, not once a request, wake or run', async () => {
    await on();
    await w.rule({});
    for (let i = 0; i < 5; i += 1) {
      const c = await w.make('A', { title: `Card ${i}` });
      await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
      await room().alarm();
      await list();
    }
    expect(fake.to('entitlement')).toEqual([{ owner: ME }]);
    // One spend a run that acted.
    expect(fake.to('spend')).toHaveLength(5);
  });

  it('reads it again once a minute has passed, and at once when the plan changes owner', async () => {
    await on();
    await list();
    await list();
    expect(fake.to('entitlement')).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    await list();
    expect(fake.to('entitlement')).toHaveLength(2);
    setPlanOwner(plan().db, 'A', 'user_ada');
    await list();
    expect(fake.to('entitlement').at(-1)).toEqual({ owner: 'p:user_ada' });
  });
});
