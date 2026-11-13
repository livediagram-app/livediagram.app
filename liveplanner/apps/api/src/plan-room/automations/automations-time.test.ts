import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  defaultCatalogue,
  localDay,
  weekdayOf,
  type AutomationRun,
  type AutomationRule,
  type ItemTypeDef,
} from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';
import { timeWaited } from './automation-time';

// Time triggers on the plan's own alarm (docs/specs/026-plan/automations.md "Time triggers"; blueprint
// automations.md "Phase 2", "The wake"), end to end: the schedule's row comes due, the wake picks the cards and queues
// them, the runner runs each once. The rules here keep UTC and a moment at the last quarter hour, so the test needs
// no clock of its own.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'labels', 'due', 'f-parent'],
  custom: [{ id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' }],
};

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
  const put = await w.send('PUT', '/api/projects/A/item-types', {
    itemTypes: { version: defaultCatalogue().version, types: [TASK] },
  });
  expect(put.status).toBeLessThan(300);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const QUARTER = 15 * 60_000;
const DAY = 24 * 60 * 60_000;
const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const card = async (id: string) => (await w.items('A')).find((i) => i.id === id)!;
const runs = async (query = '') =>
  (await (await w.call('GET', `/runs${query}`)).json<{ runs: AutomationRun[] }>()).runs;
// The last quarter hour, as a rule's time in UTC.
const moment = () => Math.floor(Date.now() / QUARTER) * QUARTER;
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const today = () => localDay(moment(), 'UTC');
const nextAt = (ruleId: string) =>
  plan().db.prepare('SELECT next_at FROM automation_schedule WHERE rule_id = ?').get(ruleId)?.[
    'next_at'
  ] as number | undefined;
// The rule's row due at `at`, and the wake.
async function wake(rule: AutomationRule, at = moment()) {
  plan()
    .db.prepare('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?')
    .run(at, rule.id);
  room().automations.schedule.restoreTimes();
  await room().alarm();
}
const daily = (extra: Partial<AutomationRule> = {}) =>
  w.rule({
    name: 'Daily',
    trigger: { kind: 'scheduled', every: 'day', at: clock(moment()) },
    steps: [{ kind: 'flag' }],
    timeZone: 'UTC',
    ...extra,
  });

describe('a Scheduled rule', () => {
  it('runs once per moment on every card its conditions match, by Automation', async () => {
    const a = await w.make('A', { title: 'One', labels: ['go'] });
    const b = await w.make('A', { title: 'Two' });
    const rule = await daily({
      conditions: [{ kind: 'field', field: 'labels', op: 'contains', value: ['go'] }],
    });
    expect(nextAt(rule.id)).toBeGreaterThan(Date.now());
    await wake(rule);
    expect((await card(a.id)).fields['flagged']).toBe(true);
    expect((await card(b.id)).fields['flagged']).toBeUndefined();
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done', card: { id: a.id } });
    expect(run!.steps[0]).toEqual({
      kind: 'trigger',
      text: `Automation · Every Day at ${clock(moment()).replace(/^0/, '')}`,
    });
    // The row moved on to the next moment; the same moment again runs nothing.
    expect(nextAt(rule.id)).toBeGreaterThan(Date.now());
    await wake(rule);
    expect(await runs()).toHaveLength(1);
  });

  it('after missing days runs only the latest moment, once, and drops one more than a day late', async () => {
    const c = await w.make('A', { title: 'Late' });
    const rule = await daily({ steps: [{ kind: 'comment', text: 'Again' }] });
    await wake(rule, moment() - 3 * DAY);
    expect(await runs()).toHaveLength(1);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM card_threads').get()).toEqual({ n: 1 });
    // Weekly on the day two days ago: that moment is more than a day late, so nothing runs.
    const weekly = await w.rule({
      name: 'Weekly',
      trigger: {
        kind: 'scheduled',
        every: 'week',
        days: [weekdayOf(addDays(today(), -2))],
        at: clock(moment()),
      },
      steps: [{ kind: 'flag' }],
      timeZone: 'UTC',
    });
    await wake(weekly, moment() - 2 * DAY);
    expect((await card(c.id)).fields['flagged']).toBeUndefined();
    expect(nextAt(weekly.id)).toBeGreaterThan(Date.now());
  });

  it('runs on the 100 due first and says the rest were left out', async () => {
    for (let i = 0; i < 103; i += 1) await w.make('A', { title: `C${i}` });
    const rule = await daily();
    await wake(rule);
    const skipped = await runs('?result=skipped');
    expect(skipped).toMatchObject([
      { reason: timeWaited(100, 103, 'scheduled'), ruleName: 'Daily' },
    ]);
    expect(timeWaited(100, 103, 'scheduled')).toBe(
      'Ran on 100 of 103 matching cards: the rest were left out, at most 100 a time',
    );
    const queued = plan().db.prepare('SELECT COUNT(*) AS n FROM automation_queue').get();
    // One wake ran the first 25; the other 75 wait for the next.
    expect(queued).toEqual({ n: 75 });
    for (let i = 0; i < 3; i += 1) {
      room().automations.schedule.at = Date.now();
      await room().alarm();
    }
    expect(await runs('?result=done&limit=200')).toHaveLength(100);
    // The "Ran on 100 of 103" line is the Audit Trail's own: it spends none of the day's runs, nor counts as one.
    const list = await (
      await w.call('GET', '')
    ).json<{ runsToday: number; rules: { stats: { runsThisWeek: number } }[] }>();
    expect(list.runsToday).toBe(100);
    expect(list.rules[0]!.stats.runsThisWeek).toBe(100);
  });

  it('waits for room in the queue rather than dropping a moment', async () => {
    await w.make('A', { title: 'Waits' });
    const rule = await daily();
    plan().db.exec(
      "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500) INSERT INTO automation_queue (event, at) SELECT 'not json', 0 FROM n",
    );
    plan()
      .db.prepare('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?')
      .run(moment(), rule.id);
    room().automations.schedule.restoreTimes();
    const { runTimeTriggers } = await import('./automation-time');
    expect(
      await runTimeTriggers(room().automations.deps()!, room().automations.schedule, Date.now()),
    ).toBe(0);
    // Still due, and asked again in a second.
    expect(nextAt(rule.id)).toBe(moment());
    expect(room().automations.schedule.timeAt).toBeGreaterThan(Date.now());
  });

  it('keeps no schedule for a rule turned off or deleted, and one again when turned on', async () => {
    const rule = await daily();
    await w.call('POST', `/${rule.id}/toggle`, { enabled: false });
    expect(nextAt(rule.id)).toBeUndefined();
    expect(room().automations.schedule.timeAt).toBeNull();
    await w.call('POST', `/${rule.id}/toggle`, { enabled: true });
    expect(nextAt(rule.id)).toBeGreaterThan(Date.now());
    const list = await (
      await w.call('GET', '')
    ).json<{
      rules: { stats: { nextAt: number | null } }[];
    }>();
    expect(list.rules[0]!.stats.nextAt).toBe(nextAt(rule.id));
    // Changed to a card trigger: no row.
    await w.call('PUT', `/${rule.id}`, {
      ...rule,
      trigger: { kind: 'card_moved', to: ['done'] },
    });
    expect(nextAt(rule.id)).toBeUndefined();
    const again = await daily({ name: 'Again' });
    await w.call('DELETE', `/${again.id}`);
    expect(nextAt(again.id)).toBeUndefined();
  });

  it('drops a row whose rule is gone, and a wake that throws tries again a minute later', async () => {
    plan()
      .db.prepare('INSERT INTO automation_schedule (rule_id, next_at) VALUES (?, ?)')
      .run('gone', 1);
    room().automations.schedule.restoreTimes();
    await room().alarm();
    expect(nextAt('gone')).toBeUndefined();
    const rule = await daily();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = room().automations.store;
    vi.spyOn(store, 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    await wake(rule);
    expect(room().automations.schedule.timeAt).toBeGreaterThan(Date.now() + 30_000);
  });
});

describe('Due In and Overdue', () => {
  it('Overdue reminds once per card per due date, re-armed by a moved date, never a Done card', async () => {
    const late = await w.make('A', { title: 'Late', due: addDays(today(), -1) });
    await w.make('A', { title: 'Finished', due: addDays(today(), -5) }, 'done');
    await w.make('A', { title: 'Not yet', due: today() });
    const rule = await w.rule({
      name: 'Nudge',
      trigger: { kind: 'overdue', at: clock(moment()) },
      steps: [{ kind: 'comment', text: '{{card.title}} is overdue, says {{person}}' }],
      timeZone: 'UTC',
    });
    await wake(rule);
    const done = await runs();
    expect(done.map((r) => r.card?.title)).toEqual(['Late']);
    await wake(rule);
    expect(await runs()).toHaveLength(1);
    // A new due date fires again; moved back to the one that fired, it doesn't.
    await w.send('POST', `/api/projects/A/items/${late.id}`, {
      set: { due: addDays(today(), -2) },
    });
    await wake(rule);
    expect(await runs()).toHaveLength(2);
    await w.send('POST', `/api/projects/A/items/${late.id}`, {
      set: { due: addDays(today(), -1) },
    });
    await wake(rule);
    expect(await runs()).toHaveLength(2);
    const threads = plan().db.prepare('SELECT comments FROM card_threads').all();
    expect(String(threads[0]!['comments'])).toContain('Late is overdue, says Automation');
  });

  it('Overdue past 100 cards reaches the rest on the next wakes, never the same 100 again', async () => {
    for (let i = 0; i < 103; i += 1)
      await w.make('A', { title: `L${i}`, due: addDays(today(), -1 - (i % 3)) });
    const rule = await w.rule({
      name: 'Nudge',
      trigger: { kind: 'overdue', at: clock(moment()) },
      steps: [{ kind: 'flag' }],
      timeZone: 'UTC',
    });
    const drain = async () => {
      for (let i = 0; i < 5; i += 1) {
        room().automations.schedule.at = Date.now();
        await room().alarm();
      }
    };
    await wake(rule);
    await drain();
    expect(await runs('?result=done&limit=200')).toHaveLength(100);
    expect(await runs('?result=skipped')).toMatchObject([
      { reason: timeWaited(100, 103, 'overdue') },
    ]);
    expect(timeWaited(100, 103, 'overdue')).toBe(
      'Ran on 100 of 103 matching cards: the rest wait for the next time',
    );
    await wake(rule);
    await drain();
    expect(await runs('?result=done&limit=200')).toHaveLength(103);
    expect(await runs('?result=skipped')).toHaveLength(1);
    expect((await w.items('A')).every((i) => i.fields['flagged'] === true)).toBe(true);
  });

  it('Overdue never reminds a card again once its run has left the Audit Trail', async () => {
    await w.make('A', { title: 'Late', due: addDays(today(), -1) });
    const rule = await w.rule({
      name: 'Nudge',
      trigger: { kind: 'overdue', at: clock(moment()) },
      steps: [{ kind: 'comment', text: 'Overdue' }],
      timeZone: 'UTC',
    });
    await wake(rule);
    expect(await runs()).toHaveLength(1);
    // The run ages out (30 days, or 2,000 newer runs), as trimRuns drops it.
    plan().db.exec('DELETE FROM automation_runs');
    await wake(rule);
    expect(await runs()).toHaveLength(0);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM card_threads').get()).toEqual({ n: 1 });
    // What it ran on is its trigger's: kept through a save, forgotten with another trigger or the rule deleted.
    const fired = () => plan().db.prepare('SELECT COUNT(*) AS n FROM automation_fired').get();
    await w.call('PUT', `/${rule.id}`, { ...rule, name: 'Nudge again' });
    expect(fired()).toEqual({ n: 1 });
    await w.call('PUT', `/${rule.id}`, {
      ...rule,
      trigger: { kind: 'due_in', days: 1, at: '09:00' },
    });
    expect(fired()).toEqual({ n: 0 });
    await wake(rule);
    const other = await w.rule({ ...rule, name: 'Other' });
    await wake(other);
    expect(fired()).toEqual({ n: 1 });
    await w.call('DELETE', `/${other.id}`);
    expect(fired()).toEqual({ n: 0 });
  });

  it('Due In runs on the cards due that many days on', async () => {
    const soon = await w.make('A', { title: 'Soon', due: addDays(today(), 2) });
    await w.make('A', { title: 'Later', due: addDays(today(), 3) });
    const rule = await w.rule({
      name: 'Soon',
      trigger: { kind: 'due_in', days: 2, at: clock(moment()) },
      steps: [{ kind: 'add_label', label: 'soon' }],
      timeZone: 'UTC',
    });
    await wake(rule);
    expect((await runs()).map((r) => r.card?.id)).toEqual([soon.id]);
  });

  it('refuses whoever triggered it on a time rule', async () => {
    const res = await w.call('POST', '', {
      name: 'Bad',
      trigger: { kind: 'overdue', at: '09:00' },
      conditions: [{ kind: 'who', who: [{ role: 'agent' }] }],
      steps: [{ kind: 'flag' }],
      chain: false,
      timeZone: 'UTC',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'automation_condition_unsupported',
      path: 'conditions.0',
    });
  });

  it('tests on a card as if its moment had come', async () => {
    const c = await w.make('A', { title: 'Try' });
    const res = await w.call('POST', '/test', {
      rule: {
        name: 'Try',
        trigger: { kind: 'overdue', at: '09:00' },
        conditions: [],
        steps: [{ kind: 'flag' }],
        chain: false,
        timeZone: 'UTC',
      },
      item: c.id,
    });
    const { run } = await res.json<{ run: AutomationRun }>();
    expect(run.result).toBe('done');
    expect(run.steps[0]).toMatchObject({ text: 'Automation · Overdue at 9:00' });
    expect((await card(c.id)).fields['flagged']).toBeUndefined();
  });
});

describe('a copy', () => {
  it('schedules the time rules it keeps on', async () => {
    const rule = await daily();
    const source = await room().exportCopy('A', null, null);
    await w.send('GET', '/api/projects/B/items');
    const b = w.plans.get('B')!;
    await b.room.importCopy('B', source!.copy);
    const row = b.db
      .prepare('SELECT next_at FROM automation_schedule WHERE rule_id = ?')
      .get(rule.id);
    expect(row?.['next_at']).toBeGreaterThan(Date.now());
  });
});
