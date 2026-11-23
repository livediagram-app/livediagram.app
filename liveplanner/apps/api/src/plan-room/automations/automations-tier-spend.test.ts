import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CAPPED,
  AI_CREDITS_USED,
  type AutomationRule,
  type AutomationRun,
  type AutomationStep,
} from '@liveplanner/items';
import type { AutomationErrorBody, AutomationsListResponse } from '@liveplanner/api-schema';
import { endRepeatWorld, OWNER } from '../test-repeat-world';
import { automationWorld, ruleBody, type AutomationWorld } from './test-automation-world';
import { fakeSubscription, setPlanOwner, type FakeSubscription } from '../tier/test-tier';
import type { AutomationsAi } from '../../types';
import {
  MESSAGE_RUNS_USED,
  type AutomationSend,
  type AutomationSendsClient,
} from './automation-sends';

// What a run spends of its plan's OWNER's month with Pro on (docs/specs/026-plan/automations.md "Tiers"): one
// automation run for the run and one for each message, and one AI credit a call, before the work, and what a run does
// when there is none. End to end
// through the real worker and room; the subscription service, the index's sends and Workers AI are stand-ins.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let sent: AutomationSend[][];
let checked: AutomationSend[][];
// The webhooks the index refuses a send to (paused).
let refusedHooks: Set<string>;
const client: AutomationSendsClient = {
  pushAutomationSends: (_plan, sends, opts) => {
    // A `check` only asks (automation-sends.ts): nothing is sent by it.
    (opts?.check ? checked : sent).push([...sends]);
    return Promise.resolve({
      results: sends.map((s) =>
        refusedHooks.has(s.webhookId)
          ? { key: s.key, queued: false, reason: 'This webhook is paused', code: 'webhook_paused' }
          : { key: s.key, queued: true },
      ),
    });
  },
};
vi.mock('./automation-sends', async (original) => ({
  ...(await original<typeof import('./automation-sends')>()),
  sendsClient: () => client,
}));

let asked: number;
const ai: AutomationsAi = {
  run: () => {
    asked += 1;
    return Promise.resolve({ response: { summary: 'A summary.' } });
  },
};

const ME = `p:${OWNER}`;
let w: AutomationWorld;
let fake: FakeSubscription;
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  sent = [];
  checked = [];
  refusedHooks = new Set();
  asked = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

// A world with the AI binding; `tiers` turns Pro on with those owners' tiers, absent leaves it off.
const world = async (tiers?: Parameters<typeof fakeSubscription>[0]) => {
  fake = fakeSubscription(tiers ?? {});
  w = await automationWorld('A', tiers ? { pro: fake } : {});
  Reflect.set(w.env, 'AI', ai);
  if (!tiers) Object.assign(w.env, { SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher });
  w.plans.get('A')!.restart();
};
const room = () => w.plans.get('A')!.room;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const notify = (name: string): AutomationStep => ({
  kind: 'notify',
  via: 'slack',
  webhook: `wh-${name}`,
  name,
  text: 'Shipped {{card.title}}',
});
const SUMMARISE: AutomationStep = { kind: 'ai', task: 'summarise' };
// A card moved to Done with the rule's wake rung: the run.
const ran = async (title = 'Pricing') => {
  const c = await w.make('A', { title });
  await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
  await room().alarm();
  return (await runs())[0]!;
};
const texts = (run: AutomationRun) => run.steps.map((s) => s.text);
const stored = async (rule: AutomationRule) =>
  (await (await w.call('GET', '')).json<AutomationsListResponse>()).rules.find(
    (r) => r.id === rule.id,
  )!;

// The spends of one meter, in order.
const spends = (meter: string) => fake.to('spend').filter((c) => c['meter'] === meter);
const runSpends = () => spends('automationRuns').map((c) => c['amount']);

describe('messages as automation runs', () => {
  it('are not counted with Pro off: every message goes and nothing is asked', async () => {
    await world();
    await w.rule({ name: 'Tell', steps: [notify('Launch')] });
    const run = await ran();
    expect(run.result).toBe('done');
    expect(texts(run)).toContain('Queued for Launch');
    expect(sent).toHaveLength(1);
    expect(fake.calls).toEqual([]);
    expect(checked).toEqual([]);
  });

  it('past the month: the message is not sent, the run says why and the rule is untouched', async () => {
    await world({});
    // The run's own takes the 500th; its message has none left.
    fake.spent.set(`${ME}:automationRuns`, 499);
    const rule = await w.rule({ name: 'Tell', steps: [{ kind: 'flag' }, notify('Launch')] });
    const run = await ran();
    expect(run).toMatchObject({ result: 'skipped', reason: MESSAGE_RUNS_USED });
    expect(run.steps.at(-1)).toMatchObject({ ok: false, text: MESSAGE_RUNS_USED });
    expect(sent).toEqual([]);
    const after = await stored(rule);
    expect(after).toMatchObject({ enabled: true, stats: { failuresInARow: 0 }, needs: [] });
    expect(after.paused).toBeUndefined();
  });

  it('spend one each from the owner’s month on Pro, after the run’s own, before they are pushed', async () => {
    await world({ [ME]: 'pro' });
    await w.rule({ name: 'Tell', steps: [notify('Launch'), notify('Sales')] });
    const run = await ran();
    expect(run.result).toBe('done');
    expect(sent[0]).toHaveLength(2);
    expect(runSpends()).toEqual([1, 2]);
  });

  it('send what the month has left and hold the rest, in two calls at most', async () => {
    await world({ [ME]: 'pro' });
    fake.spent.set(`${ME}:automationRuns`, 9_998);
    await w.rule({ name: 'Tell', steps: [notify('Launch'), notify('Sales')] });
    const run = await ran();
    expect(run).toMatchObject({ result: 'skipped', reason: MESSAGE_RUNS_USED });
    expect(texts(run)).toEqual(expect.arrayContaining(['Queued for Launch', MESSAGE_RUNS_USED]));
    expect(sent[0]!.map((s) => s.webhookId)).toEqual(['wh-Launch']);
    expect(runSpends()).toEqual([1, 2, 1]);
  });

  it('spend none for a message the index would refuse: it is asked first, and nothing is queued by asking', async () => {
    await world({ [ME]: 'pro' });
    refusedHooks.add('wh-Sales');
    await w.rule({ name: 'Tell', steps: [notify('Launch'), notify('Sales')] });
    const run = await ran();
    expect(texts(run)).toEqual(
      expect.arrayContaining(['Queued for Launch', 'This webhook is paused']),
    );
    // Both were asked about, one was paid for and one was pushed.
    expect(checked.map((c) => c.map((s) => s.webhookId))).toEqual([['wh-Launch', 'wh-Sales']]);
    expect(runSpends()).toEqual([1, 1]);
    expect(sent.map((c) => c.map((s) => s.webhookId))).toEqual([['wh-Launch']]);
    // Every webhook refusing: only the run itself is spent.
    refusedHooks.add('wh-Launch');
    await ran('Next');
    expect(runSpends()).toEqual([1, 1, 1]);
    expect(sent).toHaveLength(1);
  });

  it('are uncounted for a guest’s plan, which the subscription service is never asked about', async () => {
    await world({});
    setPlanOwner(w.plans.get('A')!.db, 'A', 'guest_abc');
    await w.rule({ name: 'Tell', steps: [notify('Launch')] });
    const run = await ran();
    expect(run.result).toBe('done');
    expect(sent).toHaveLength(1);
    expect(fake.calls).toEqual([]);
    const list = await (await w.call('GET', '')).json<AutomationsListResponse>();
    expect(list).toMatchObject({ guest: true, rulesMax: 25 });
    expect(list.owner).toBeUndefined();
  });

  it('are the plan’s owner’s, and a team’s for a team’s plan, never the person’s who moved the card', async () => {
    await world({ 't:team_1': 'team' });
    setPlanOwner(w.plans.get('A')!.db, 'A', OWNER, 'team_1');
    await w.rule({ name: 'Tell', steps: [notify('Launch')] });
    expect((await ran()).result).toBe('done');
    expect(spends('automationRuns').map((c) => c['owner'])).toEqual(['t:team_1', 't:team_1']);
  });

  it('spend nothing for Test on a Card, and only the run for a message that came out empty', async () => {
    await world({ [ME]: 'pro' });
    const c = await w.make('A', { title: 'Card' });
    const body = ruleBody({ name: 'Tell', steps: [notify('Launch')] });
    const test = await w.call('POST', '/test', { rule: body, item: c.id });
    expect((await test.json<{ run: AutomationRun }>()).run.steps.at(-1)!.text).toMatch(
      /^Would post to Launch/,
    );
    expect(fake.to('spend')).toEqual([]);
    await w.rule({
      name: 'Empty',
      steps: [{ ...notify('Launch'), text: '{{card.assignee}}' } as AutomationStep],
    });
    await ran();
    expect(runSpends()).toEqual([1]);
  });
});

describe('AI credits', () => {
  it('are not counted with Pro off', async () => {
    await world();
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    expect((await ran()).result).toBe('done');
    expect(asked).toBe(1);
    expect(fake.calls).toEqual([]);
  });

  it('spend one of the owner’s before each call', async () => {
    await world({});
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    expect((await ran()).result).toBe('done');
    expect(asked).toBe(1);
    expect(spends('aiCredits')).toEqual([{ owner: ME, meter: 'aiCredits', amount: 1 }]);
  });

  it('skip the step softly at Free’s 50, asking no model, and never pause the rule', async () => {
    await world({});
    fake.spent.set(`${ME}:aiCredits`, 49);
    const rule = await w.rule({ name: 'Sum', steps: [SUMMARISE, { kind: 'flag' }] });
    expect((await ran('Last')).result).toBe('done');
    const run = await ran('Over');
    expect(run).toMatchObject({ result: 'skipped', reason: AI_CREDITS_USED });
    expect(run.steps.find((s) => s.text === AI_CREDITS_USED)).toMatchObject({ ok: false });
    // The steps after it still ran.
    expect(run.steps.at(-1)).toMatchObject({ kind: 'action', ok: true });
    expect(asked).toBe(1);
    expect(await stored(rule)).toMatchObject({ enabled: true, stats: { failuresInARow: 0 } });
  });

  it('allow more on Pro, and a team’s plan spends the team’s', async () => {
    await world({ [ME]: 'pro', 't:team_1': 'team' });
    fake.spent.set(`${ME}:aiCredits`, 50);
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    expect((await ran()).result).toBe('done');
    setPlanOwner(w.plans.get('A')!.db, 'A', OWNER, 'team_1');
    expect((await ran('Team')).result).toBe('done');
    expect(spends('aiCredits').map((c) => c['owner'])).toEqual([ME, 't:team_1']);
  });

  it('spend nothing for Test on a Card, nor once the day’s safety cap is reached', async () => {
    await world({ [ME]: 'pro' });
    const c = await w.make('A', { title: 'Card' });
    const body = ruleBody({ name: 'Sum', steps: [SUMMARISE] });
    await w.call('POST', '/test', { rule: body, item: c.id });
    expect(fake.to('spend')).toEqual([]);
    // The day's 100 AI steps stay in force on every tier.
    const day = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    w.plans
      .get('A')!
      .db.prepare('INSERT INTO automation_ai_days (day, asks) VALUES (?, ?)')
      .run(day, 100);
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    expect(await ran()).toMatchObject({ result: 'skipped', reason: AI_CAPPED });
    expect(spends('aiCredits')).toEqual([]);
    expect(asked).toBe(0);
  });
});

describe('an AI step’s credit and the day’s cap', () => {
  const aiRows = () =>
    w.plans
      .get('A')!
      .db.prepare('SELECT COUNT(*) AS n FROM automation_runs WHERE body LIKE \'%"ai":true%\'')
      .get() as { n: number };

  it('never spends a credit on a call the day’s cap then refuses: the day’s place is taken first', async () => {
    await world({ [ME]: 'pro' });
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    // While the credit is being spent, other requests use up the day (as a burst of runs would).
    const real = fake.fetcher.fetch;
    const db = w.plans.get('A')!.db;
    fake.fetcher.fetch = async (input, init) => {
      if (
        String(input).endsWith('/spend') &&
        typeof init?.body === 'string' &&
        init.body.includes('aiCredits')
      ) {
        const insert = db.prepare(
          "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'x', ?, 'done', ?)",
        );
        for (let i = 0; i < 100; i += 1)
          insert.run(`burst${i}`, Date.now(), JSON.stringify({ steps: [{ ai: true }] }));
      }
      return real(input, init);
    };
    const run = await ran();
    // The credit was spent, so the model was asked: never a spent credit and then "capped".
    expect(spends('aiCredits')).toHaveLength(1);
    expect(asked).toBe(1);
    expect(run.reason).not.toBe(AI_CAPPED);
  });

  it('gives the day’s place back when the credit is refused', async () => {
    await world({});
    fake.spent.set(`${ME}:aiCredits`, 50);
    await w.rule({ name: 'Sum', steps: [SUMMARISE] });
    for (let i = 0; i < 3; i += 1)
      expect(await ran(`Card ${i}`)).toMatchObject({ result: 'skipped', reason: AI_CREDITS_USED });
    expect(asked).toBe(0);
    expect(aiRows().n).toBe(0);
  });
});

describe('Describe a Rule', () => {
  const draft = (who: Parameters<AutomationWorld['call']>[3] = 'owner') =>
    w.call('POST', '/draft', { prompt: 'Flag done cards', timeZone: 'Europe/London' }, who);

  it('spends nothing with Pro off', async () => {
    await world();
    await draft();
    expect(asked).toBeGreaterThan(0);
    expect(fake.calls).toEqual([]);
  });

  it('spends one of the plan’s owner’s credits a draft, whoever asks', async () => {
    await world({ 'p:user_ada': 'pro' });
    setPlanOwner(w.plans.get('A')!.db, 'A', 'user_ada');
    await draft('editor_link');
    expect(fake.to('spend')).toEqual([{ owner: 'p:user_ada', meter: 'aiCredits', amount: 1 }]);
  });

  it('is refused 429 with the limit once the month’s credits are used, asking no model', async () => {
    await world({});
    fake.spent.set(`${ME}:aiCredits`, 50);
    const res = await draft();
    expect(res.status).toBe(429);
    expect(await res.json<AutomationErrorBody>()).toEqual({
      error: 'automation_ai_credits_used',
      message: AI_CREDITS_USED,
      limit: 'aiCreditsPerMonth',
      used: 50,
      max: 50,
    });
    expect(asked).toBe(0);
  });
});
