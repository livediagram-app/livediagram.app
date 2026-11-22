import {
  CROSS_APP_RULE_DAY_MAX,
  type AutomationStepAnswer,
  type AutomationStepPush,
  type CrossAppStep,
} from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemEvent, ItemRun } from '../item';
import {
  CROSS_APP_EMPTY,
  CROSS_APP_LOOP,
  CROSS_APP_NO_AUTHOR,
  CROSS_APP_NOT_SET_UP,
  CROSS_APP_RULE_CAPPED,
  CROSS_APP_UNREACHED,
} from '../cross-app/words';
import { listRuns } from './automation-log';
import { fillCrossAppStep, kitCrossApp, runCrossAppStep, type CrossAppRun } from './cross-app';
import { queueItemEvent } from './item/intake';
import { crossAppEvent } from './item/run';
import { runItemAutomations } from './item/wake';
import { ANA, itemSql, world, type World } from './item/test-kit';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now());
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const kb = { app: 'liveknowledge' as const, item: 'k1', title: 'Docs' };
const page: CrossAppStep = { kind: 'kb_page', target: kb, title: 'Notes', body: 'Body' };

function client(answer: AutomationStepAnswer | Error) {
  const pushed: { itemId: string; push: AutomationStepPush }[] = [];
  return {
    pushed,
    push: (itemId: string, push: AutomationStepPush) => {
      pushed.push({ itemId, push });
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
}

const runOf = (over: Partial<CrossAppRun> = {}): CrossAppRun => ({
  client: client({ ok: true, text: 'Wrote a page' }),
  sql: itemSql(),
  app: 'liveplanner',
  itemId: 'p1',
  rule: { id: 'r1', name: 'Release Note' },
  author: 'user_ana',
  from: { title: 'Plan', url: 'https://liveplanner.app/project/p1' },
  chain: { id: 'c1', hops: 0, rules: [] },
  key: 'run:1',
  now: Date.now(),
  ...over,
});

describe('a step in another app', () => {
  it('pushes the filled step as its author and keeps the target’s words', async () => {
    const c = client({ ok: true, text: 'Wrote “Notes” in Docs' });
    expect(await runCrossAppStep(runOf({ client: c }), page)).toEqual({
      ok: true,
      text: 'Wrote “Notes” in Docs',
    });
    expect(c.pushed).toEqual([
      {
        itemId: 'p1',
        push: {
          key: 'run:1',
          author: 'user_ana',
          rule: { id: 'r1', name: 'Release Note' },
          from: { title: 'Plan', url: 'https://liveplanner.app/project/p1' },
          chain: { id: 'c1', hops: 0, rules: [] },
          step: page,
        },
      },
    ]);
  });

  it('pauses on lost access or a target gone, skips on a loop or a cap, and fails otherwise', async () => {
    const answers: [AutomationStepAnswer, object][] = [
      [
        { ok: false, code: 'no_access', reason: '' },
        { ok: false, text: 'Stopped: no access to “Docs”', pause: true },
      ],
      [
        { ok: false, code: 'target_gone', reason: 'The parent page is gone' },
        { ok: false, text: 'The parent page is gone', pause: true },
      ],
      [
        { ok: false, code: 'loop', reason: '' },
        { ok: false, text: CROSS_APP_LOOP, skip: true },
      ],
      [
        { ok: false, code: 'chain_long', reason: '' },
        { ok: false, text: 'Stopped after 3 hops across apps', skip: true },
      ],
      [
        { ok: false, code: 'capped', reason: '' },
        { ok: false, skip: true },
      ],
      [
        { ok: false, code: 'failed', reason: 'Too big' },
        { ok: false, text: 'Too big' },
      ],
    ];
    for (const [answer, outcome] of answers)
      expect(await runCrossAppStep(runOf({ client: client(answer) }), page)).toMatchObject(outcome);
    const notice: CrossAppStep = { kind: 'inbox_notice', to: [{ person: 'ana' }], text: 'x' };
    expect(
      await runCrossAppStep(
        runOf({ client: client({ ok: false, code: 'no_access', reason: '' }) }),
        notice,
      ),
    ).toMatchObject({ text: 'Stopped: no access to the people', pause: true });
    expect(await runCrossAppStep(runOf({ client: client(new Error('down')) }), page)).toEqual({
      ok: false,
      text: CROSS_APP_UNREACHED,
    });
  });

  it('asks nothing without a client, a step, an author, or past the chain or the rule’s day', async () => {
    const c = client({ ok: true, text: 'x' });
    expect(await runCrossAppStep(runOf({ client: null }), page)).toEqual({
      ok: false,
      text: CROSS_APP_NOT_SET_UP,
    });
    expect(await runCrossAppStep(runOf({ client: c }), null)).toEqual({
      ok: false,
      text: CROSS_APP_EMPTY,
    });
    expect(await runCrossAppStep(runOf({ client: c, author: null }), page)).toEqual({
      ok: false,
      text: CROSS_APP_NO_AUTHOR,
      pause: true,
    });
    const looped = runOf({ client: c, chain: { id: 'c', hops: 1, rules: ['liveplanner:p1:r1'] } });
    expect(await runCrossAppStep(looped, page)).toEqual({
      ok: false,
      text: CROSS_APP_LOOP,
      skip: true,
    });
    const sql = itemSql();
    sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${CROSS_APP_RULE_DAY_MAX + 1})
       INSERT INTO automation_runs (id, rule_id, at, result, body) SELECT 'x' || i, 'r1', ?, 'done', '{}' FROM n`,
      Date.now(),
    );
    expect(await runCrossAppStep(runOf({ client: c, sql }), page)).toEqual({
      ok: false,
      text: CROSS_APP_RULE_CAPPED,
      skip: true,
    });
    expect(c.pushed).toEqual([]);
  });

  it('fills each kind’s texts, and answers null for one that came out empty', () => {
    const fill = (t: string) => t.replace('{{x}}', 'X').replace('{{none}}', '');
    const target = { app: 'liveplanner' as const, item: 'p', title: 'P' };
    expect(
      fillCrossAppStep(
        {
          kind: 'plan_card',
          target,
          board: 'b',
          column: 'Done',
          title: ' {{x}} ',
          description: 'd {{x}}',
          assignee: '{{x}}',
          linkBack: true,
          skipIfOpen: false,
        },
        fill,
      ),
    ).toEqual({
      kind: 'plan_card',
      target,
      board: 'b',
      column: 'Done',
      title: 'X',
      description: 'd X',
      assignee: 'X',
      linkBack: true,
      skipIfOpen: false,
    });
    const card = { kind: 'plan_card', target, board: 'b', column: 'c', description: '' } as const;
    expect(
      fillCrossAppStep(
        { ...card, title: 't', assignee: '{{none}}', linkBack: false, skipIfOpen: false },
        fill,
      ),
    ).not.toHaveProperty('assignee');
    expect(
      fillCrossAppStep({ ...card, title: 't', linkBack: false, skipIfOpen: false }, fill),
    ).not.toHaveProperty('assignee');
    expect(
      fillCrossAppStep({ ...card, title: '{{none}}', linkBack: false, skipIfOpen: false }, fill),
    ).toBeNull();
    expect(fillCrossAppStep({ ...page, body: '{{x}}' }, fill)).toEqual({ ...page, body: 'X' });
    expect(fillCrossAppStep({ ...page, body: '{{none}}' }, fill)).toBeNull();
    const post = { kind: 'space_post', target: kb, spaceTab: 't', text: '{{x}}' } as never;
    expect(fillCrossAppStep(post, fill)).toMatchObject({ text: 'X' });
    expect(fillCrossAppStep({ ...(post as object), text: '' } as never, fill)).toBeNull();
    const tab = { kind: 'doc_tab', target: kb, docTemplate: 'x', name: '{{x}}' } as never;
    expect(fillCrossAppStep(tab, fill)).toMatchObject({ name: 'X' });
    expect(fillCrossAppStep({ ...(tab as object), name: '' } as never, fill)).toBeNull();
    const notice: CrossAppStep = {
      kind: 'inbox_notice',
      to: [{ person: 'ana' }, { value: '{{x}}' }, { value: '{{none}}' }],
      text: '{{x}}',
    };
    expect(fillCrossAppStep(notice, fill)).toEqual({
      kind: 'inbox_notice',
      to: [{ person: 'ana' }, { value: 'X' }],
      text: 'X',
    });
    expect(fillCrossAppStep({ ...notice, to: [{ value: '{{none}}' }] }, fill)).toBeNull();
  });

  it('reaches the index through the app’s own client, or nothing', async () => {
    expect(kitCrossApp(null)).toBeNull();
    const c = client({ ok: true, text: 'x' });
    const kit = kitCrossApp({ pushAutomationStep: c.push })!;
    await kit.push('p1', {} as AutomationStepPush);
    expect(c.pushed).toHaveLength(1);
  });

  it('names its telemetry event by how it went', () => {
    expect(crossAppEvent({ ok: true, text: '' })).toBe('CrossAppDone');
    expect(crossAppEvent({ ok: false, text: '', pause: true })).toBe('CrossAppNoAccess');
    expect(crossAppEvent({ ok: false, text: CROSS_APP_LOOP, skip: true })).toBe('CrossAppLoop');
    expect(crossAppEvent({ ok: false, text: 'Stopped after 3 hops', skip: true })).toBe(
      'CrossAppLoop',
    );
    expect(crossAppEvent({ ok: false, text: CROSS_APP_RULE_CAPPED, skip: true })).toBe(
      'CrossAppCapped',
    );
    expect(crossAppEvent({ ok: false, text: 'x' })).toBe('CrossAppFailed');
  });
});

describe('a rule with a step in another app', () => {
  const runs = (w: World): ItemRun[] => listRuns<ItemRun>(w.sql, { limit: 50 });
  let n = 0;
  const fire = async (w: World, over: Partial<ItemEvent> = {}) => {
    vi.setSystemTime(Date.now() + 1000);
    queueItemEvent(w.sql, w.engine, {
      id: `e${(n += 1)}`,
      kind: 'joined',
      at: Date.now(),
      by: ANA,
      role: 'editor',
      ...over,
    });
    await runItemAutomations(w.engine, Date.now());
    return runs(w);
  };
  const withClient = (answer: AutomationStepAnswer) => {
    const c = client(answer);
    return { c, w: world({ crossApp: { client: c, app: 'livediagram' } }) };
  };
  const steps = [
    { kind: 'kb_page', target: kb, title: '{{item.name}}', body: 'By {{person}}' },
    { kind: 'take_snapshot', name: 'After' },
  ];

  it('runs it as the author, in its chain, and goes on', async () => {
    const { c, w } = withClient({ ok: true, text: 'Wrote “Launch Plan” in Docs' });
    const rule = w.rule({ trigger: { kind: 'joined' }, steps });
    const [run] = await fire(w, {
      cross: { id: 'chain-1', hops: 1, rules: ['liveplanner:p9:r9'] },
    });
    expect(run).toMatchObject({ result: 'done' });
    expect(run!.steps.map((s) => ('text' in s ? s.text : ''))).toEqual([
      'Ana Costa joined',
      'Wrote “Launch Plan” in Docs',
      'Took a snapshot named “After”',
    ]);
    expect(c.pushed[0]!.push).toMatchObject({
      author: ANA.id,
      rule: { id: rule.id },
      from: { title: 'Launch Plan', url: 'https://app.example/d/1' },
      chain: { id: 'chain-1', hops: 1, rules: ['liveplanner:p9:r9'] },
      step: { title: 'Launch Plan', body: 'By Ana Costa' },
    });
    expect(c.pushed[0]!.push.key).toMatch(/:0$/);
  });

  it('links back to the run’s tab when it has one', async () => {
    const { c, w } = withClient({ ok: true, text: 'Done' });
    w.rule({ trigger: { kind: 'tab_added' }, steps });
    w.addTab('t1', 'Roadmap');
    await runItemAutomations(w.engine, Date.now());
    expect(c.pushed[0]!.push.from).toEqual({
      title: 'Launch Plan',
      url: 'https://app.example/d/1?tab=t1',
    });
  });

  it('pauses the rule at once when its author lost access', async () => {
    const { w } = withClient({ ok: false, code: 'no_access', reason: '' });
    const rule = w.rule({ trigger: { kind: 'joined' }, steps });
    const [run] = await fire(w);
    expect(run).toMatchObject({ result: 'failed', reason: 'Stopped: no access to “Docs”' });
    expect(w.engine.store.get(rule.id)).toMatchObject({
      enabled: false,
      paused: { reason: 'Stopped: no access to “Docs”' },
    });
    // Off already: a second pause changes nothing.
    expect(w.engine.store.pauseNow(rule.id, 'again', Date.now())).toBe(false);
    expect(w.engine.store.pauseNow('gone', 'again', Date.now())).toBe(false);
    await w.settled();
    expect(w.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['CrossAppNoAccess', 'AutomationPaused']),
    );
  });

  it('skips a step that would loop and ends Skipped once the rest is done', async () => {
    const { w } = withClient({ ok: false, code: 'loop', reason: '' });
    w.rule({ trigger: { kind: 'joined' }, steps });
    const [run] = await fire(w);
    expect(run).toMatchObject({ result: 'skipped', reason: CROSS_APP_LOOP });
    expect(w.taken).toHaveLength(1);
  });

  it('fails where the app has no steps in other apps, and a test says what it would do', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'joined' }, steps });
    const [run] = await fire(w);
    expect(run).toMatchObject({ result: 'failed', reason: CROSS_APP_NOT_SET_UP });
    const deps = w.engine.deps()!;
    const { runItemRule } = await import('./item/run');
    const dry = await runItemRule(
      deps,
      { outline: null, today: 0 },
      rule,
      {
        id: 'dry',
        kind: 'joined',
        at: Date.now(),
        by: ANA,
      },
      { dry: true },
    );
    expect(dry!.steps[1]).toMatchObject({ text: 'Would write a page “Launch Plan” in “Docs”' });
  });
});
