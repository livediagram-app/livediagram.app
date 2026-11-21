import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_EMPTY, AI_FAILED, AI_NOT_SET_UP, AI_UNREADABLE } from '../../ai';
import { Failed } from '../../failed';
import type { ItemEvent, ItemPart, ItemRun } from '../../item';
import {
  AUTOMATION_AI_PER_DAY,
  AUTOMATION_FAILURES_TO_PAUSE,
  AUTOMATION_RUNS_PER_DAY,
  AUTOMATION_WAITING_RUNS_MAX,
} from '../../limits';
import type { AutomationsAi } from '../automation-ai';
import { listRuns, runsToday } from '../automation-log';
import { SENDS_UNREACHABLE } from '../automation-sends';
import { WAIT_CONDITIONS, WAIT_RULE_CHANGED } from '../automation-waits';
import { WAKE_RETRY_MS } from '../automation-wake';
import {
  EMAIL_COUNT_FAILED,
  EMAIL_EMPTY,
  EMAIL_NOBODY,
  EMAIL_NOT_SET_UP,
  NAME_EMPTY,
  SNAPSHOT_GONE,
} from './actions';
import { AI_NO_TEXT, AI_SUMMARISED } from './ai';
import { queueItemEvent } from './intake';
import { BUDGET_SPENT, CHAIN_KEPT, CHAIN_STOPPED, WENT_WRONG, runItemRule } from './run';
import { ANA, BEN, queued, rowsOf, world, type World } from './test-kit';
import {
  ITEM_EVENTS_PER_WAKE,
  ITEM_MORE_MS,
  QUEUE_FULL,
  runItemAutomations,
  runItemWake,
} from './wake';

// The clock is the test's: each trigger lands a second after the last, so the Audit Trail's order is never a tie.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now());
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

let n = 0;
const joined = (over: Partial<ItemEvent> = {}): ItemEvent => ({
  id: `e${(n += 1)}`,
  kind: 'joined',
  at: Date.now(),
  by: ANA,
  role: 'editor',
  ...over,
});

const runs = (w: World): ItemRun[] => listRuns<ItemRun>(w.sql, { limit: 200 });
const wake = (w: World, now = Date.now()) => runItemAutomations(w.engine, now);
const fire = async (w: World, event?: ItemEvent) => {
  vi.setSystemTime(Date.now() + 1000);
  queueItemEvent(w.sql, w.engine, event ?? joined());
  await wake(w);
  return runs(w);
};
const texts = (run: ItemRun) => run.steps.map((s) => ('text' in s ? s.text : ''));
const ai = (reply: unknown): AutomationsAi => ({ run: () => Promise.resolve(reply) });
const fillRuns = (w: World, count: number) =>
  w.sql.exec(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
     INSERT INTO automation_runs (id, rule_id, at, result, body) SELECT 'x' || i, 'r', ?, 'done', '{}' FROM n`,
    Date.now(),
  );

describe('a run', () => {
  it('claims its id, runs the steps in order and settles Done, counted once a wake', async () => {
    const w = world();
    const rule = w.rule({
      trigger: { kind: 'joined' },
      steps: [
        { kind: 'take_snapshot', name: '{{item.name}} by {{person}}' },
        { kind: 'clear_box' },
      ],
    });
    const [run] = await fire(w);
    expect(run).toMatchObject({
      ruleId: rule.id,
      ruleName: rule.name,
      result: 'done',
      subject: null,
    });
    expect(run!.steps).toEqual([
      { kind: 'trigger', text: 'Ana Costa joined', by: ANA },
      { kind: 'action', ok: true, text: 'Took a snapshot named “Launch Plan by Ana Costa”' },
      { kind: 'action', ok: true, text: 'Cleared the box' },
    ]);
    expect(w.taken).toEqual([
      {
        name: 'Launch Plan by Ana Costa',
        author: { id: 'automation', name: rule.name, color: '#7c3aed' },
      },
    ]);
    expect(w.cleared.count).toBe(1);
    expect(queued(w.sql)).toEqual([]);
    expect(w.engine.schedule.at).toBeNull();
    await w.settled();
    expect(w.events.map((e) => [e.category, e.action, e.type])).toEqual([
      ['Document', 'Ran', 'AutomationDone'],
      ['Document', 'Ran', 'AutomationTrigger.Joined'],
    ]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });

  it('never runs twice for one trigger', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'joined' } });
    const event = joined();
    const deps = w.engine.deps()!;
    const state = { outline: null, today: 0 };
    expect(await runItemRule(deps, state, rule, event)).not.toBeNull();
    expect(await runItemRule(deps, state, rule, event)).toBeNull();
    expect(w.taken).toHaveLength(1);
  });

  it('is about the event’s tab, by its name and link, or the name a removed tab left', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'tab_added' },
      steps: [{ kind: 'take_snapshot', name: '{{tab.name}} {{tab.url}}' }],
    });
    w.rule({
      trigger: { kind: 'tab_removed' },
      steps: [{ kind: 'take_snapshot', name: 'Gone: {{tab.name}}{{tab.url}}' }],
    });
    w.addTab('t1', 'Roadmap');
    expect(w.engine.schedule.due(Date.now())).toBe(true);
    await wake(w);
    w.removeTab('t1');
    await wake(w);
    const all = runs(w);
    const added = all.find((r) => r.subject?.url)!;
    const removed = all.find((r) => r !== added)!;
    expect(added.subject).toEqual({
      id: 't1',
      title: 'Roadmap',
      url: 'https://app.example/d/1?tab=t1',
    });
    expect(texts(added)).toEqual([
      'Someone added Roadmap',
      'Took a snapshot named “Roadmap https://app.example/d/1?tab=t1”',
    ]);
    expect(removed.subject).toEqual({ id: 't1', title: 'Roadmap' });
    expect(texts(removed)[1]).toBe('Took a snapshot named “Gone: Roadmap”');
  });

  it('logs No Match when a condition does not hold, free of the day’s budget', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'joined' },
      conditions: [{ kind: 'who', who: [{ person: BEN.id }] }, { kind: 'made_up' }],
    });
    const [run] = await fire(w);
    expect(run!.result).toBe('no_match');
    expect(run!.steps.slice(1)).toEqual([
      { kind: 'condition', ok: false, text: 'Who Did It is Ben Okafor' },
      { kind: 'condition', ok: false, text: 'made_up is not a condition here' },
    ]);
    expect(runsToday(w.sql, Date.now())).toBe(0);
    expect(w.taken).toEqual([]);
  });

  it('stops at a failed step, the steps before it done, and says what is gone', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        { kind: 'take_snapshot', name: 'First' },
        { kind: 'email', to: { person: 'left-the-team' }, subject: 'Hi', body: 'There' },
        { kind: 'take_snapshot', name: 'Never' },
      ],
    });
    const [run] = await fire(w);
    expect(run).toMatchObject({
      result: 'failed',
      reason: 'The person is gone',
      gone: { kind: 'person', id: 'left-the-team' },
    });
    expect(w.taken.map((t) => t.name)).toEqual(['First']);
    expect(run!.steps).toHaveLength(3);
  });

  it('pauses the rule after ten failures in a row, and runs it no more', async () => {
    const w = world();
    const rule = w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'revert_snapshot', snapshot: 'missing' }],
    });
    for (let i = 0; i <= AUTOMATION_FAILURES_TO_PAUSE; i += 1)
      queueItemEvent(w.sql, w.engine, joined());
    await wake(w);
    const failed = runs(w);
    expect(failed).toHaveLength(AUTOMATION_FAILURES_TO_PAUSE);
    expect(failed[0]).toMatchObject({
      result: 'failed',
      reason: SNAPSHOT_GONE,
      gone: { kind: 'snapshot', id: 'missing' },
    });
    expect(w.engine.store.get(rule.id)).toMatchObject({
      enabled: false,
      paused: { reason: SNAPSHOT_GONE, gone: { kind: 'snapshot', id: 'missing' } },
    });
    await w.settled();
    expect(w.events.filter((e) => e.type === 'AutomationPaused')).toHaveLength(1);
  });

  it('says what each step would do on a dry run, claims nothing and changes nothing', async () => {
    const w = world({ ai: { client: ai({ response: { summary: 'x' } }) } });
    w.addTab('t1', 'Roadmap');
    const rule = w.rule({
      trigger: { kind: 'joined' },
      conditions: [{ kind: 'tab', tabs: ['t1'] }],
      steps: [
        { kind: 'ai', task: 'summarise' },
        { kind: 'take_snapshot', name: 'S {{summary}}' },
        { kind: 'wait', hours: 48 },
        {
          kind: 'notify',
          via: 'slack',
          webhook: 'c1',
          name: 'Launch Channel',
          text: 'Hi {{tab.name}}',
        },
        { kind: 'notify', via: 'slack', webhook: 'c1', text: 'Hi' },
        {
          kind: 'if',
          conditions: [{ kind: 'tab', tabs: ['t1'], not: true }],
          then: [{ kind: 'clear_box' }],
          else: [{ kind: 'revert_snapshot', snapshot: 'snap-1' }],
        },
        { kind: 'email', to: { owner: true }, subject: 'About {{tab.name}}', body: 'B' },
        { kind: 'add_tab', template: 'retro', name: 'Retro' },
        { kind: 'made_up' },
      ],
    });
    const run = await runItemRule(
      w.engine.deps()!,
      { outline: null, today: 0 },
      rule,
      joined({ tab: 't1' }),
      {
        dry: true,
      },
    );
    expect(run!.result).toBe('failed');
    expect(texts(run!)).toEqual([
      'Ana Costa joined',
      'Tab is Roadmap',
      'Would summarise with AI',
      'Would take a snapshot named “S ”',
      'Would wait 2 days',
      'Would post to Launch Channel: Hi Roadmap',
      'Would post to the webhook: Hi',
      'Tab is not Roadmap',
      'Would revert to “a snapshot”',
      'Would email the owner: About Roadmap',
      'Would add a tab named “Retro”',
      'made_up is not a step here',
    ]);
    expect(runs(w)).toEqual([]);
    expect(w.taken).toEqual([]);
    expect(w.reverted).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_waiting')).toEqual([]);
  });

  it('runs an If / Else’s list for whether its conditions hold', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        {
          kind: 'if',
          conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
          then: [{ kind: 'take_snapshot', name: 'Then' }],
          else: [{ kind: 'take_snapshot', name: 'Else' }],
        },
      ],
    });
    await fire(w);
    await fire(w, joined({ role: 'viewer' }));
    expect(w.taken.map((t) => t.name)).toEqual(['Then', 'Else']);
    expect(texts(runs(w)[0]!)).toEqual([
      'Ana Costa joined',
      'Who Did It is an Editor',
      'Took a snapshot named “Else”',
    ]);
  });

  it('fails a step it has no runner for, and a step that throws its own failure', async () => {
    const w = world({
      run: {
        clear_box: () => Promise.reject(new Failed('The box is locked', { kind: 'tab', id: 't9' })),
      },
    });
    const first = w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'unwired' }] });
    w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'clear_box' }] });
    const both = await fire(w);
    const unwired = both.find((r) => r.ruleId === first.id);
    const locked = both.find((r) => r.ruleId !== first.id);
    expect(unwired).toMatchObject({ result: 'failed', reason: "Unwired can't run here" });
    expect(locked).toMatchObject({
      result: 'failed',
      reason: 'The box is locked',
      gone: { kind: 'tab', id: 't9' },
    });
  });

  it('fails with "Something went wrong" when a step throws anything else, and never throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world({ run: { clear_box: () => Promise.reject(new Error('boom')) } });
    w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'clear_box' }] });
    const [run] = await fire(w);
    expect(run).toMatchObject({ result: 'failed', reason: WENT_WRONG });
    await w.settled();
    expect(w.events.map((e) => e.type)).toContain('AutomationCrashed');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });

  it('answers null when even settling the failure throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world({ outline: () => Promise.reject(new Error('no item')) });
    const rule = w.rule({ trigger: { kind: 'joined' } });
    const deps = w.engine.deps()!;
    const sql = deps.sql();
    const exec = sql.exec.bind(sql);
    vi.spyOn(sql, 'exec').mockImplementation(((query: string, ...rest: unknown[]) => {
      if (query.includes('ON CONFLICT (id) DO UPDATE SET result')) throw new Error('disk');
      return exec(query, ...rest);
    }) as typeof sql.exec);
    expect(await runItemRule(deps, { outline: null, today: 0 }, rule, joined())).toBeNull();
  });

  it('reads an app’s own values from its room and from the event', async () => {
    const w = world({ values: () => Promise.resolve({ 'room.name': 'Atrium' }) });
    w.rule({
      trigger: { kind: 'poll_ended' },
      steps: [{ kind: 'take_snapshot', name: '{{room.name}}: {{poll.question}} {{nothing}}' }],
    });
    await fire(w, joined({ kind: 'poll_ended', data: { 'poll.question': 'Lunch?' } }));
    expect(w.taken[0]!.name).toBe('Atrium: Lunch?');
  });
});

describe('the chain', () => {
  const byRule = (rule: string, chain: number) => joined({ role: 'automation', rule, chain });

  it('never hears its own change, and a rule that keeps its changes to itself starts nothing', async () => {
    const w = world();
    const quiet = w.rule({ trigger: { kind: 'joined' } });
    const other = w.rule({ trigger: { kind: 'joined' } });
    await fire(w, byRule(quiet.id, 1));
    expect(runs(w)).toHaveLength(1);
    expect(runs(w)[0]).toMatchObject({ ruleId: other.id, result: 'skipped', reason: CHAIN_KEPT });
    expect(w.taken).toEqual([]);
  });

  it('lets a rule’s change start other rules when it says so, five deep at most', async () => {
    const w = world();
    const source = w.rule({ trigger: { kind: 'poll_ended' }, chain: true });
    w.rule({ trigger: { kind: 'joined' } });
    await fire(w, byRule(source.id, 4));
    expect(runs(w)[0]!.result).toBe('done');
    await fire(w, byRule(source.id, 5));
    expect(runs(w)[0]).toMatchObject({ result: 'skipped', reason: CHAIN_STOPPED });
    const { chain: _chain, ...unchained } = byRule(source.id, 1);
    await fire(w, unchained);
    expect(runs(w)[0]!.result).toBe('done');
  });

  it('drops a stopped run whose conditions did not hold', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'joined' },
      conditions: [{ kind: 'who', who: [{ person: BEN.id }] }],
    });
    await fire(w, byRule('gone-rule', 1));
    expect(runs(w)).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_runs')).toEqual([]);
  });

  it('tags a rule’s own tab with the rule and the chain, so the next rule obeys them', async () => {
    const w = world();
    const adder = w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'add_tab', template: 'retro', name: 'Retro {{person}}' }],
    });
    w.rule({ trigger: { kind: 'tab_added' } });
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    await fire(w);
    const [event] = queued(w.sql);
    expect(event).toMatchObject({
      kind: 'tab_added',
      role: 'automation',
      rule: adder.id,
      chain: 1,
      data: { 'tab.name': 'Retro Ana Costa' },
    });
    // A rule's own write is no edit.
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    vi.setSystemTime(Date.now() + 1000);
    await wake(w);
    expect(runs(w)[0]).toMatchObject({ result: 'skipped', reason: CHAIN_KEPT });
  });
});

describe('the shared steps', () => {
  it('refuse a snapshot or a tab whose name came out empty, and say why the kit refused', async () => {
    const w = world({
      snapshots: {
        list: () => Promise.resolve([]),
        take: () => Promise.resolve({ ok: false, reason: 'too_large' }),
        revert: () => Promise.resolve({ ok: false, reason: 'unreadable' }),
      },
      addTab: () => Promise.resolve({ failed: 'This document holds as many tabs as it may' }),
    });
    const reasons: (string | undefined)[] = [];
    for (const step of [
      { kind: 'take_snapshot', name: '{{tab.name}}' },
      { kind: 'take_snapshot', name: 'Big' },
      { kind: 'revert_snapshot', snapshot: 's' },
      { kind: 'add_tab', template: 't', name: '{{tab.name}}' },
      { kind: 'add_tab', template: 't', name: 'Retro' },
    ] satisfies ItemPart[]) {
      const rule = w.rule({ trigger: { kind: 'joined' }, steps: [step] });
      reasons.push((await fire(w))[0]!.reason);
      w.engine.store.remove(rule.id);
    }
    expect(reasons).toEqual([
      NAME_EMPTY,
      "Couldn't take the snapshot: too_large",
      "Couldn't revert: unreadable",
      NAME_EMPTY,
      'This document holds as many tabs as it may',
    ]);
  });

  it('say so where the app cannot add a tab', async () => {
    const w = world({ addTab: undefined });
    w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'add_tab', template: 't', name: 'Retro' }],
    });
    expect((await fire(w))[0]!.reason).toBe("This document can't add a tab from a template");
  });

  it('revert inside a silent window: no edit, no tab event, and the snapshot by name', async () => {
    const w = world();
    w.addTab('t1');
    w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1', name: 'Clean board' }],
    });
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const [run] = await fire(w);
    expect(texts(run!)[1]).toBe('Reverted to “Clean board”');
    expect(w.reverted).toEqual(['snap-1']);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_edits')).toEqual([]);
  });

  it('email the owner, whoever started it and a person, each through their account', async () => {
    const w = world();
    const mail = (to: unknown) => ({
      kind: 'email',
      to,
      subject: ' Hi {{person}} ',
      body: 'About {{item.name}}',
    });
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        mail({ owner: true }),
        mail({ trigger: true }),
        mail({ person: BEN.id }),
      ] as ItemPart[],
    });
    const [run] = await fire(w, joined({ by: BEN }));
    expect(texts(run!).slice(1)).toEqual([
      'Emailed the owner',
      'Emailed whoever started it',
      'Emailed Ben Okafor',
    ]);
    expect(w.mailed.map((m) => m.to)).toEqual([ANA.id, BEN.id, BEN.id]);
    expect(w.mailed[0]!.mail).toMatchObject({
      subject: 'Hi Ben Okafor',
      body: 'About Launch Plan',
    });
  });

  it('fail an email with nobody to send to, no address, no words, or no mailer', async () => {
    const reasons: (string | undefined)[] = [];
    const one = async (w: World, to: unknown, event = joined(), subject = 'Hi') => {
      w.rule({
        trigger: { kind: 'joined' },
        steps: [{ kind: 'email', to, subject, body: 'B' }],
      });
      reasons.push((await fire(w, event))[0]!.reason);
    };
    await one(world(), { trigger: true }, joined({ by: undefined }));
    await one(
      world(),
      { trigger: true },
      joined({ by: { id: 'nobody', name: 'A Guest', color: '' } }),
    );
    await one(world(), { owner: true }, joined(), '{{tab.name}}');
    await one(world({ mail: null }), { owner: true });
    expect(reasons).toEqual([
      EMAIL_NOBODY,
      "Couldn't email whoever started it: no address to send to",
      EMAIL_EMPTY,
      EMAIL_NOT_SET_UP,
    ]);
  });

  it('email typed-in addresses with their own unsubscribe links, past the day’s limit Skipped', async () => {
    const w = world();
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        {
          kind: 'email',
          to: { addresses: ['a@example.com', 'b@example.com'] },
          subject: 'S',
          body: 'B',
        },
      ],
    });
    const [first] = await fire(w);
    expect(first!.result).toBe('done');
    expect(texts(first!)[1]).toBe('Emailed a@example.com and 1 more');
    expect(w.mailed[0]!.links!.unsubscribeUrl).toMatch(/^https:\/\/app\.example\/optout\/.{43}$/);
    // One unsubscribed; the day's count nearly spent.
    w.sql.exec(
      "UPDATE automation_email_addresses SET unsubscribed_at = 1 WHERE address = 'a@example.com'",
    );
    w.sql.exec('UPDATE automation_email_days SET sent = 50');
    const [second] = await fire(w);
    expect(second).toMatchObject({
      result: 'skipped',
      reason: 'This document has sent its 50 emails to typed-in addresses today',
    });
    expect(texts(second!)[1]).toBe("Emailed nobody (1 unsubscribed, 1 left out by today's limit)");
    expect(w.mailed).toHaveLength(2);
    // A day's count that cannot be read sends nothing.
    w.sql.exec("UPDATE automation_email_days SET sent = 'x'");
    const [third] = await fire(w);
    expect(third).toMatchObject({ result: 'failed', reason: EMAIL_COUNT_FAILED });
  });

  it('name typed-in addresses that could not be sent to, and fail the step only when none went', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    const refused = new Set(['b@example.com']);
    w.kit.mail!.sendToAddress = (to) =>
      refused.has(to) ? Promise.reject(new Error('refused')) : Promise.resolve();
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        {
          kind: 'email',
          to: { addresses: ['a@example.com', 'b@example.com'] },
          subject: 'S',
          body: 'B',
        },
      ],
    });
    const [some] = await fire(w);
    expect(some!.result).toBe('done');
    expect(texts(some!)[1]).toBe("Emailed a@example.com (couldn't send to b@example.com)");
    refused.add('a@example.com');
    const [none] = await fire(w);
    expect(none).toMatchObject({ result: 'failed' });
    expect(texts(none!)[1]).toBe("Emailed nobody (couldn't send to a@example.com and 1 more)");
  });

  it('post a message through a connection, about the run’s tab, and fail on a refusal', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    w.rule({
      trigger: { kind: 'joined' },
      steps: [
        {
          kind: 'notify',
          via: 'slack',
          webhook: 'c1',
          name: 'Launch Channel',
          text: 'Hi {{person}}',
        },
        { kind: 'notify', via: 'teams', webhook: 'c2', text: '{{comment}}' },
        { kind: 'take_snapshot', name: 'Never' },
      ],
    });
    const [run] = await fire(w, joined({ tab: 't1' }));
    expect(w.posted).toHaveLength(1);
    expect(w.posted[0]).toMatchObject({
      webhookId: 'c1',
      text: 'Hi Ana Costa',
      subject: { title: 'Roadmap', url: 'https://app.example/d/1?tab=t1' },
    });
    expect(run).toMatchObject({ result: 'failed', reason: 'The message came out empty' });
    expect(texts(run!).slice(1)).toEqual([
      'Queued for Launch Channel',
      'The message came out empty',
    ]);
    expect(w.taken).toEqual([]);
  });

  it('names the connection a failed message went through, and sends with no subject for the item alone', async () => {
    const unreachable = world({ sends: null });
    unreachable.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'notify', via: 'slack', webhook: 'c1', text: 'Hi' }],
    });
    expect((await fire(unreachable))[0]).toMatchObject({
      result: 'failed',
      reason: SENDS_UNREACHABLE,
    });
    const w = world({
      sends: {
        push: (_item, messages) =>
          Promise.resolve(
            messages.map((m) => ({
              key: m.key,
              queued: false as const,
              reason: 'Launch Channel is paused',
              code: 'webhook_paused',
            })),
          ),
      },
    });
    const rule = w.rule({
      trigger: { kind: 'joined' },
      steps: [{ kind: 'notify', via: 'slack', webhook: 'c1', text: 'Hi' }],
    });
    for (let i = 0; i < AUTOMATION_FAILURES_TO_PAUSE; i += 1)
      queueItemEvent(w.sql, w.engine, joined());
    await wake(w);
    expect(w.engine.store.get(rule.id)!.paused).toMatchObject({
      reason: 'Launch Channel is paused',
      webhook: 'c1',
    });
  });
});

describe('Summarise with AI', () => {
  const steps: ItemPart[] = [
    { kind: 'ai', task: 'summarise', tab: 'run' },
    { kind: 'take_snapshot', name: 'S: {{summary}}' },
  ];

  it('keeps the summary for the steps after, and counts the ask', async () => {
    const asked: unknown[] = [];
    const client: AutomationsAi = {
      run: (_model, inputs) => {
        asked.push(inputs);
        return Promise.resolve({ response: { summary: 'All **good** https://evil.example' } });
      },
    };
    const w = world({ ai: { client, gateway: 'gw' } });
    w.addTab('t1');
    w.rule({ trigger: { kind: 'joined' }, steps });
    const [run] = await fire(w, joined({ tab: 't1' }));
    expect(run!.steps[1]).toEqual({ kind: 'action', ok: true, text: AI_SUMMARISED, ai: true });
    expect(w.taken[0]!.name).toBe('S: All good');
    expect(JSON.stringify(asked[0])).toContain('Text of t1');
    expect(w.engine.store.aiAsks).toBe(1);
  });

  it('fails with why: no binding, no text, a model that errs, a reply that does not read, an empty one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reasons: (string | undefined)[] = [];
    const one = async (w: World) => {
      w.rule({
        trigger: { kind: 'joined' },
        steps: [{ kind: 'ai', task: 'summarise', tab: 't1' }],
      });
      const [run] = await fire(w);
      reasons.push(run!.reason);
      return run!;
    };
    await one(world());
    await one(world({ ai: { client: ai({}) }, text: () => Promise.resolve('  ') }));
    const erred = await one(
      world({ ai: { client: { run: () => Promise.reject(new Error('down')) } } }),
    );
    await one(world({ ai: { client: ai({ response: 'no json here' }) } }));
    await one(world({ ai: { client: ai({ response: { summary: ' ** ' } }) } }));
    expect(reasons).toEqual([AI_NOT_SET_UP, AI_NO_TEXT, AI_FAILED, AI_UNREADABLE, AI_EMPTY]);
    // An ask that was made counts against the day, whatever came of it.
    expect(erred.steps[1]).toMatchObject({ ok: false, ai: true });
  });

  it('skips the step past the day’s cap: the run goes on and ends Skipped', async () => {
    const w = world({ ai: { client: ai({ response: { summary: 'x' } }) } });
    w.rule({ trigger: { kind: 'joined' }, steps });
    // The day's calls, as each was counted when asked.
    w.sql.exec(
      'INSERT INTO automation_ai_days (day, asks) VALUES (?, ?)',
      Math.floor((Date.now() + 1000) / 86_400_000) * 86_400_000,
      AUTOMATION_AI_PER_DAY,
    );
    const [run] = await fire(w);
    expect(run).toMatchObject({
      result: 'skipped',
      reason: 'This document has used its 100 AI steps today',
    });
    expect(w.taken[0]!.name).toBe('S:');
  });

  it('reads the day’s count again only when another ask was made meanwhile', async () => {
    const w = world({ ai: { client: ai({ response: { summary: 'x' } }) } });
    const rule = w.rule({ trigger: { kind: 'joined' }, steps: [steps[0]!, steps[0]!] });
    const exec = vi.spyOn(w.sql, 'exec');
    const state = { outline: null, today: 0 };
    await runItemRule(w.engine.deps()!, state, rule, joined());
    const counted = () =>
      exec.mock.calls.filter(([q]) => String(q).includes('automation_ai_drafts')).length;
    expect(counted()).toBe(1);
    w.engine.store.aiAsks += 1;
    await runItemRule(w.engine.deps()!, state, rule, joined());
    expect(counted()).toBe(2);
  });
});

describe('Wait', () => {
  const HOUR = 60 * 60 * 1000;
  const steps: ItemPart[] = [
    { kind: 'ai', task: 'summarise' },
    { kind: 'wait', hours: 2 },
    { kind: 'take_snapshot', name: 'After: {{summary}} {{person}}' },
  ];
  const waiting = (w: World) => {
    vi.setSystemTime(Date.UTC(2027, 0, 5, 12, 0));
    return w.rule({
      trigger: { kind: 'joined' },
      steps,
      conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
    });
  };
  const summariser = () => world({ ai: { client: ai({ response: { summary: 'Calm' } }) } });

  it('holds the rest, then goes on from the next step as a run of its own, with what it knew', async () => {
    const w = summariser();
    waiting(w);
    const armed = w.armed.count;
    const [held] = await fire(w);
    expect(held).toMatchObject({ result: 'waiting', waitsUntil: Date.now() + 2 * HOUR });
    expect(w.armed.count).toBeGreaterThan(armed);
    expect(w.engine.schedule.wakeAt).toBe(Date.now() + 2 * HOUR);
    expect(w.taken).toEqual([]);
    vi.setSystemTime(Date.now() + 2 * HOUR);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await wake(w);
    const [after, before] = runs(w);
    expect(before!.result).toBe('done');
    expect(after).toMatchObject({ result: 'done', afterWait: 2 });
    expect(texts(after!)).toEqual([
      'After waiting 2 hours',
      'Who Did It is an Editor',
      'Took a snapshot named “After: Calm Ana Costa”',
    ]);
    await w.settled();
    expect(w.events.map((e) => e.type)).toContain('AutomationWaiting');
  });

  it('skips a held run whose rule changed or went off while it waited', async () => {
    const w = summariser();
    const rule = waiting(w);
    await fire(w);
    w.engine.store.update({ ...rule, edited: { by: ANA, at: 2000 } });
    expect(runs(w)[0]).toMatchObject({ result: 'skipped', reason: WAIT_RULE_CHANGED });
    // A resume already on the queue when the rule changes: skipped as it runs.
    const again = w.engine.store.get(rule.id)!;
    await fire(w);
    vi.setSystemTime(Date.now() + 2 * HOUR);
    const resume = JSON.parse(
      String(rowsOf(w.sql, 'SELECT event FROM automation_waiting')[0]!['event']),
    ) as ItemEvent;
    w.sql.exec('DELETE FROM automation_waiting');
    w.sql.exec(
      "UPDATE automation_rules SET body = json_set(body, '$.edited.at', 3000) WHERE id = ?",
      again.id,
    );
    w.sql.exec('INSERT INTO automation_queue (event, at) VALUES (?, ?)', JSON.stringify(resume), 1);
    w.engine.schedule.restore(Date.now());
    await wake(w);
    expect(runs(w).map((r) => [r.result, r.reason])).toContainEqual(['skipped', WAIT_RULE_CHANGED]);
    expect(runs(w).filter((r) => r.result === 'waiting')).toEqual([]);
    expect(w.taken).toEqual([]);
  });

  it('settles a held run No Match when its conditions no longer hold, or Skipped when its rule is off', async () => {
    const w = summariser();
    const rule = waiting(w);
    await fire(w);
    const row = rowsOf(w.sql, 'SELECT event FROM automation_waiting')[0]!;
    const resume = JSON.parse(String(row['event'])) as ItemEvent;
    w.sql.exec('DELETE FROM automation_waiting');
    const { waited: _waited, step: _step, ...bare } = resume;
    const run = await runItemRule(w.engine.deps()!, { outline: null, today: 0 }, rule, {
      ...bare,
      role: 'viewer',
    });
    expect(run).toMatchObject({ result: 'no_match', reason: WAIT_CONDITIONS });
    expect(run!.afterWait).toBeUndefined();
    expect(texts(run!)[0]).toBe('After waiting 1 hour');
    // Off since it was queued: the wake settles the waiting run itself.
    await fire(w);
    const next = JSON.parse(
      String(rowsOf(w.sql, 'SELECT event FROM automation_waiting')[0]!['event']),
    ) as ItemEvent;
    w.sql.exec('DELETE FROM automation_waiting');
    w.sql.exec('UPDATE automation_rules SET enabled = 0 WHERE id = ?', rule.id);
    w.sql.exec('INSERT INTO automation_queue (event, at) VALUES (?, ?)', JSON.stringify(next), 1);
    w.engine.schedule.restore(Date.now());
    await wake(w);
    expect(runs(w).find((r) => r.id === next.origin)).toMatchObject({
      result: 'skipped',
      reason: WAIT_RULE_CHANGED,
    });
  });

  it('goes on from the rule’s first step when the held event names none', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'joined' } });
    const run = await runItemRule(w.engine.deps()!, { outline: null, today: 0 }, rule, {
      ...joined(),
      kind: 'resume',
      edited: rule.edited.at,
    });
    expect(run!.result).toBe('done');
    expect(w.taken).toHaveLength(1);
  });

  it('fails when the item holds as many waiting runs as it may', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'wait', hours: 1 }] });
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_WAITING_RUNS_MAX})
       INSERT INTO automation_waiting (id, rule_id, at, event) SELECT 'w' || i, 'r', 9e15, '{}' FROM n`,
    );
    const [run] = await fire(w);
    expect(run).toMatchObject({
      result: 'failed',
      reason: 'Too many runs are waiting in this document',
    });
  });
});

describe('a wake', () => {
  it('leaves the rest of a full batch a moment, and logs a dropped burst once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    for (let i = 0; i <= ITEM_EVENTS_PER_WAKE; i += 1) queueItemEvent(w.sql, w.engine, joined());
    w.engine.queued(3);
    const now = Date.now();
    await wake(w, now);
    expect(runs(w).filter((r) => r.result === 'done')).toHaveLength(ITEM_EVENTS_PER_WAKE);
    expect(runs(w).find((r) => r.reason === QUEUE_FULL)).toMatchObject({
      result: 'skipped',
      ruleId: '',
    });
    expect(w.engine.schedule.at).toBe(now + ITEM_MORE_MS);
    expect(w.engine.schedule.dropped).toBe(0);
    await w.settled();
    expect(w.events.map((e) => e.type)).toContain('AutomationQueueFull');
  });

  it('stops at its wall-time cap, and drops a queue row it cannot read', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'clear_box' }] });
    // A slow step: two minutes pass while it runs.
    w.kit.run = {
      clear_box: () => {
        vi.setSystemTime(Date.now() + 120_000);
        return Promise.resolve({ ok: true, text: 'Cleared' });
      },
    };
    w.sql.exec("INSERT INTO automation_queue (event, at) VALUES ('not json', 1)");
    queueItemEvent(w.sql, w.engine, joined());
    queueItemEvent(w.sql, w.engine, joined());
    const now = Date.now();
    await wake(w, now);
    expect(queued(w.sql)).toHaveLength(1);
    expect(w.engine.schedule.at).toBe(now + ITEM_MORE_MS);
  });

  it('runs a rule as it now stands: one turned off or changed since the wake began runs no more', async () => {
    const w = world();
    const first = w.rule({ trigger: { kind: 'joined' }, steps: [{ kind: 'clear_box' }] });
    const second = w.rule({ trigger: { kind: 'joined' } });
    const third = w.rule({ trigger: { kind: 'joined' } });
    w.kit.run = {
      clear_box: () => {
        w.sql.exec(
          "UPDATE automation_rules SET body = json_set(body, '$.enabled', json('false')) WHERE id = ?",
          second.id,
        );
        w.sql.exec(
          "UPDATE automation_rules SET body = json_set(body, '$.trigger.kind', 'manual') WHERE id = ?",
          third.id,
        );
        return Promise.resolve({ ok: true, text: 'Cleared' });
      },
    };
    await fire(w);
    expect(runs(w).map((r) => r.ruleId)).toEqual([first.id]);
  });

  it('spends the day’s budget, then runs nothing, and says so on a held run', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'joined' } });
    fillRuns(w, AUTOMATION_RUNS_PER_DAY);
    w.sql.exec(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES ('held', ?, ?, 'waiting', ?)",
      rule.id,
      Date.now(),
      JSON.stringify({ id: 'held', ruleId: rule.id, at: Date.now(), result: 'waiting', steps: [] }),
    );
    w.sql.exec(
      'INSERT INTO automation_queue (event, at) VALUES (?, 1)',
      JSON.stringify({
        id: 'w:held',
        kind: 'resume',
        at: 1,
        ruleId: rule.id,
        origin: 'held',
        edited: 1000,
      }),
    );
    await fire(w);
    expect(w.taken).toEqual([]);
    expect(runs(w).find((r) => r.id === 'held')).toMatchObject({
      result: 'skipped',
      reason: BUDGET_SPENT,
    });
  });

  it('says the budget is spent once a rule a day, never once a trigger, and counts the line as no run', async () => {
    const w = world();
    const one = w.rule({ trigger: { kind: 'joined' } });
    const two = w.rule({ trigger: { kind: 'joined' } });
    fillRuns(w, AUTOMATION_RUNS_PER_DAY);
    for (let i = 0; i < 3; i += 1) queueItemEvent(w.sql, w.engine, joined({ id: `j${i}` }));
    await fire(w);
    for (let i = 3; i < 5; i += 1) queueItemEvent(w.sql, w.engine, joined({ id: `j${i}` }));
    await fire(w);
    expect(w.taken).toEqual([]);
    const lines = runs(w).filter((r) => r.reason === BUDGET_SPENT);
    expect(lines.map((r) => r.ruleId).sort()).toEqual([one.id, two.id].sort());
    expect(lines[0]).toMatchObject({ result: 'skipped', steps: [] });
    expect(runsToday(w.sql, Date.now())).toBe(AUTOMATION_RUNS_PER_DAY);
  });

  it('tries again in a minute when it fails as a whole, and still posts its tally', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    w.rule({ trigger: { kind: 'everyone_left', minutes: 1 } });
    queueItemEvent(w.sql, w.engine, joined());
    queueItemEvent(w.sql, w.engine, joined({ kind: 'left', tab: 't1', at: 0 }));
    w.engine.schedule.timeAt = 1;
    const now = Date.now();
    vi.spyOn(w.engine.store, 'enabled').mockImplementation(() => {
      throw new Error('storage');
    });
    await expect(wake(w, now)).resolves.toBeUndefined();
    expect(w.engine.schedule.retryAt).toBe(now + WAKE_RETRY_MS);
    expect(w.engine.schedule.due(now)).toBe(false);
    expect(w.engine.schedule.settleDue(now)).toBe(false);
    expect(w.engine.schedule.wakeAt).toBe(now + WAKE_RETRY_MS);
    await w.settled();
    expect(w.events.map((e) => e.type)).toEqual(['AutomationWakeFailed']);
    // Held off, an early alarm runs nothing and counts nothing.
    await wake(w, now + 1);
    expect(w.engine.schedule.failures).toBe(1);
  });

  it('holds a time that was due when the wake failed for the retry too', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    const now = Date.now() + 48 * 60 * 60 * 1000;
    vi.spyOn(w.engine.store, 'get').mockImplementation(() => {
      throw new Error('storage');
    });
    await wake(w, now);
    expect(w.engine.schedule.timeDue(now)).toBe(false);
    expect(w.engine.schedule.timeDue(now + WAKE_RETRY_MS)).toBe(true);
  });

  it('runs the queue with no tally to count into', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    queueItemEvent(w.sql, w.engine, joined());
    expect(await runItemWake(w.engine.deps()!, w.engine.schedule, Date.now())).toBe(1);
  });

  it('runs nothing for an item put away, or a room that holds no item', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    queueItemEvent(w.sql, w.engine, joined());
    w.state.held = false;
    await wake(w);
    expect(w.engine.schedule.at).toBeNull();
    w.state.held = true;
    w.engine.schedule.at = 1;
    w.kit.putAway = () => true;
    await wake(w);
    expect(w.engine.schedule.at).toBeNull();
    expect(runs(w)).toEqual([]);
  });

  it('fires a settle that came due, then runs its rule on the tab it was about', async () => {
    const w = world();
    w.addTab('t1', 'Atrium');
    const rule = w.rule({
      trigger: { kind: 'everyone_left', minutes: 5 },
      steps: [{ kind: 'take_snapshot', name: 'Empty: {{tab.name}}' }],
    });
    queueItemEvent(w.sql, w.engine, joined({ kind: 'left', tab: 't1', at: 1000 }));
    await wake(w, 2000);
    expect(runs(w)).toEqual([]);
    await wake(w, 1000 + 5 * 60_000);
    expect(runs(w)[0]).toMatchObject({
      ruleId: rule.id,
      result: 'done',
      subject: { id: 't1', title: 'Atrium' },
    });
    expect(texts(runs(w)[0]!)).toEqual(['Everyone left', 'Took a snapshot named “Empty: Atrium”']);
  });
});
