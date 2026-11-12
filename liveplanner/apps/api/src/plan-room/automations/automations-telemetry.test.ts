import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationSecretResponse } from '@liveplanner/api-schema';
import { endRepeatWorld } from '../test-repeat-world';
import type { Env } from '../../types';
import { AutomationTally, tallyRun } from './automation-telemetry';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// What a plan's Automations do on their own, counted from the api (docs/specs/026-plan/automations.md "Telemetry"):
// each wake's runs in one post, the trouble the engine meets, and Incoming Webhook calls to a live rule only.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

type Row = [string, string, string | null];
let w: AutomationWorld;
let posts: Row[][];

// The central telemetry service, faked: each post's events as [category, action, type]; every other call as before.
function recordTelemetry(env: Env) {
  Reflect.set(env, 'TELEMETRY_ENABLED', 'true');
  Reflect.set(env, 'TELEMETRY_KEY', 'k');
  vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
    if (url.includes('/telemetry') && init?.body) {
      const { events } = JSON.parse(init.body) as {
        events: { category: string; action: string; type: string | null }[];
      };
      posts.push(events.map((e) => [e.category, e.action, e.type]));
      return new Response(null, { status: 204 });
    }
    return Response.json({ ok: true });
  });
}

beforeEach(async () => {
  posts = [];
  for (const level of ['info', 'warn', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation(() => {});
  w = await automationWorld();
  // The room keeps its own copy of the env, made when it started.
  for (const env of [w.env, room().roomEnv!]) recordTelemetry(env);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const move = (id: string, status: string) =>
  w.send('POST', `/api/projects/A/items/${id}/move`, { status });
const types = () => posts.flat().map((r) => r[2]);

describe('a wake', () => {
  it('posts its runs once, each with its result and trigger', async () => {
    await w.rule({});
    const a = await w.make('A', { title: 'One' });
    const b = await w.make('A', { title: 'Two' });
    await move(a.id, 'done');
    await move(b.id, 'done');
    posts = [];
    await room().alarm();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual([
      ['Plan', 'Ran', 'AutomationDone'],
      ['Plan', 'Ran', 'AutomationDone'],
      ['Plan', 'Ran', 'AutomationTrigger.CardMoved'],
      ['Plan', 'Ran', 'AutomationTrigger.CardMoved'],
    ]);
  });

  it('counts No Match, and a wake with nothing to run posts nothing', async () => {
    await w.rule({ conditions: [{ kind: 'field', field: 'priority', op: 'is', value: 'high' }] });
    const c = await w.make('A', { title: 'Plain' });
    await move(c.id, 'done');
    posts = [];
    await room().alarm();
    expect(types()).toEqual(['AutomationNoMatch', 'AutomationTrigger.CardMoved']);
    posts = [];
    await room().alarm();
    expect(posts).toEqual([]);
  });

  it('counts each failure and the pause once', async () => {
    await w.rule({ steps: [{ kind: 'move', status: 'gone-column' }] });
    for (let i = 0; i < 10; i += 1) {
      const c = await w.make('A', { title: `F${i}` });
      await move(c.id, 'done');
      await room().alarm();
    }
    expect(types().filter((t) => t === 'AutomationFailed')).toHaveLength(10);
    expect(types().filter((t) => t === 'AutomationPaused')).toHaveLength(1);
  });

  it('counts a dropped burst once', async () => {
    await w.rule({ trigger: { kind: 'card_created' } });
    plan().db.exec(
      "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500) INSERT INTO automation_queue (event, at) SELECT 'not json', 0 FROM n",
    );
    await w.make('A', { title: 'Dropped' });
    for (let i = 0; i < 21; i += 1) {
      room().automations.schedule.at = Date.now();
      await room().alarm();
    }
    expect(types().filter((t) => t === 'AutomationQueueFull')).toHaveLength(1);
  });

  it('leaves Test on a Card to the browser', async () => {
    const rule = await w.rule({});
    const c = await w.make('A', { title: 'Try' });
    posts = [];
    const res = await w.call('POST', '/test', { rule, item: c.id, ruleId: rule.id });
    expect(res.status).toBe(200);
    expect(posts).toEqual([]);
  });
});

describe('an Incoming Webhook call', () => {
  const hook = (ruleId: string, secret: string) =>
    w.raw(
      new Request(`https://api.test/api/hooks/automations/A/${ruleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: '{}',
      }),
    );

  it('counts accepted and refused calls to a live rule, and nothing for an address no rule holds', async () => {
    const rule = await w.rule({
      name: 'From CI',
      trigger: { kind: 'incoming_webhook' },
      steps: [{ kind: 'comment', text: 'Built' }],
    });
    const made = await (
      await w.call('POST', `/${rule.id}/secret`)
    ).json<AutomationSecretResponse>();
    posts = [];
    expect((await hook(rule.id, made.secret)).status).toBe(202);
    expect((await hook(rule.id, 'lwh_wrong')).status).toBe(401);
    expect((await hook('no-such-rule', made.secret)).status).toBe(401);
    expect(types()).toEqual(['AutomationHookAccepted', 'AutomationHookUnauthorized']);
  });
});

describe('the tally', () => {
  it('puts results ahead of triggers and sends at most one batch', async () => {
    const tally = new AutomationTally();
    for (let i = 0; i < 60; i += 1) tallyRun(tally, i % 2 ? 'skipped' : 'waiting', 'scheduled');
    tally.track('Plan', 'Ran', 'AutomationCrashed');
    expect(tally.size).toBe(121);
    posts = [];
    await tally.flush(w.env);
    expect(posts[0]).toHaveLength(100);
    expect(posts[0]!.slice(0, 61).every((r) => !r[2]!.startsWith('AutomationTrigger.'))).toBe(true);
    expect(posts[0]![60]).toEqual(['Plan', 'Ran', 'AutomationCrashed']);
    expect(posts[0]![61]).toEqual(['Plan', 'Ran', 'AutomationTrigger.Scheduled']);
    expect(tally.size).toBe(0);
    await tally.flush(w.env);
    expect(posts).toHaveLength(1);
  });

  it('counts a failed result', () => {
    const tally = new AutomationTally();
    tallyRun(tally, 'failed', 'pull_request_checks');
    expect(tally.size).toBe(2);
  });
});
