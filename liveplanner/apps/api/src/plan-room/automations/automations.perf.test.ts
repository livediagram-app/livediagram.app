import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_RULES_MAX,
  ITEMS_MAX,
  addDays,
  localDay,
} from '@liveplanner/items';
import { AUTOMATION_NO_MATCH_LOG_MAX, runsToday } from './automation-log';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// What Automations cost a plan (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The event"): a save in a plan of 50 rules that hear it, against the same saves with none, and a
// wake that runs a full batch of triggers past every rule. CPU time, never wall-clock (testing.md).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const SAVES = 50;
let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;

// Fifty rules hearing a change to Priority, none of whose conditions hold (the costly case: every rule is read
// and checked, none writes).
async function fiftyRules() {
  for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
    await w.rule({
      name: `Rule ${i}`,
      trigger: { kind: 'field_changed', fields: ['priority'] },
      conditions: [{ kind: 'field', field: 'title', op: 'contains', value: `never ${i}` }],
      steps: [{ kind: 'flag' }],
    });
}

const saves = async (id: string) => {
  for (let i = 0; i < SAVES; i += 1)
    await w.send('POST', `/api/projects/A/items/${id}`, {
      set: { priority: i % 2 ? 'high' : 'low' },
    });
};

// Wall-clock timeouts are generous: the budgets are CPU time, and a loaded machine stretches only the wall clock.
describe('Automations cost', () => {
  it('a save in a plan of 50 rules that hear it stays close to a save in a plan with none', async () => {
    const c = await w.make('A', { title: 'Busy' });
    await saves(c.id);
    const bare = await cpuMsOfAsync(() => saves(c.id));
    await fiftyRules();
    const heard = await cpuMsOfAsync(() => saves(c.id));
    // The save queues one event and never waits for a rule: nothing has run yet.
    expect(w.plans.get('A')!.db.prepare('SELECT COUNT(*) AS n FROM automation_runs').get()).toEqual(
      { n: 0 },
    );
    expect(heard).toBeLessThan(cpuBudgetMs(1000));
    // What the rules add to the 50 saves: the events they build and queue (measured: within noise of none).
    expect(heard - bare).toBeLessThan(cpuBudgetMs(250));
  }, 30_000);

  it('a wake runs 25 triggers past 50 rules within its budget', async () => {
    await fiftyRules();
    const c = await w.make('A', { title: 'Busy' });
    await saves(c.id);
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    const n = w.plans.get('A')!.db.prepare('SELECT COUNT(*) AS n FROM automation_runs').get();
    // 1,250 checks, every one a No Match: none spends the day's budget, and the log keeps the newest 500 of them.
    expect(n).toEqual({ n: AUTOMATION_NO_MATCH_LOG_MAX });
    expect(runsToday(w.plans.get('A')!.room.automations.sql(), Date.now())).toBe(0);
    expect(wake).toBeLessThan(cpuBudgetMs(1500));
  }, 30_000);

  // Phase 2 (docs/specs/026-plan/automations.md "Time triggers"; blueprint "The wake"): a full plan and 50 time
  // rules due at once. Five hear every card (each runs on its first 100, the queue's 500), the other 45 check every
  // card against a condition that never holds: 100,000 card checks in one wake, then its first 25 runs.
  it('a wake with 50 time rules due over 2,000 cards stays within its budget', async () => {
    const QUARTER = 15 * 60_000;
    const moment = Math.floor(Date.now() / QUARTER) * QUARTER;
    const at = new Date(moment).toISOString().slice(11, 16);
    const c = await w.make('A', { title: 'Late', due: addDays(localDay(moment, 'UTC'), -1) });
    w.plans.get('A')!.db.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${ITEMS_MAX - 1})
       INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       SELECT plan_id, id || '-' || n.i, type, item_key + n.i, rank, fields, rev, created_at, updated_at, created_by,
              updated_by
         FROM items, n WHERE id = '${c.id}'`,
    );
    for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
      await w.rule({
        name: `Time ${i}`,
        trigger: { kind: 'overdue', at },
        conditions:
          i < 5 ? [] : [{ kind: 'field', field: 'title', op: 'contains', value: `never ${i}` }],
        steps: [{ kind: 'flag' }],
        timeZone: 'UTC',
      });
    const db = w.plans.get('A')!.db;
    db.prepare('UPDATE automation_schedule SET next_at = ?').run(moment);
    room().automations.schedule.restoreTimes();
    const wake = await cpuMsOfAsync(() => room().alarm());
    const left = db.prepare('SELECT COUNT(*) AS n FROM automation_queue').get();
    const due = db
      .prepare('SELECT COUNT(*) AS n FROM automation_schedule WHERE next_at <= ?')
      .get(moment);
    // Every rule scanned and moved on; the queue took its 500 and the wake ran the first 25.
    expect(due).toEqual({ n: 0 });
    expect(left).toEqual({ n: AUTOMATION_QUEUE_MAX - 25 });
    expect(wake).toBeLessThan(cpuBudgetMs(1500));
  }, 30_000);
});
