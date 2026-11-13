import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_DERIVED_CARDS_MAX,
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_RULES_MAX,
  ITEMS_MAX,
  addDays,
  defaultCatalogue,
  localDay,
  type ItemTypeDef,
} from '@liveplanner/items';
import { AUTOMATION_NO_MATCH_LOG_MAX, runsToday } from './automation-log';
import { AUTOMATION_EVENTS_PER_WAKE } from './automation-runner';
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

// The plan filled to its cap with copies of one card (`n` of them, numbered on from it), straight into its SQL.
function fill(id: string, n = ITEMS_MAX - 1) {
  w.plans.get('A')!.db.exec(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n})
     INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
     SELECT plan_id, id || '-' || n.i, type, item_key + n.i, rank, fields, rev, created_at, updated_at, created_by,
            updated_by
       FROM items, n WHERE id = '${id}'`,
  );
}

// A card type with a Blocked By field, for Card Unblocked.
const BLOCKS: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'f-blocked'],
  custom: [
    {
      id: 'f-blocked',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
  ],
};

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

  // A branch reads the plan's cards (blueprint "Worked out at run time", `cardsNow`): 50 rules with a For Related
  // Cards step on a full plan, 25 triggers. Each run read all 2,000 cards afresh, 1,250 reads in one wake (measured
  // 8,500 ms on an M-series Mac); now once, while nothing writes (measured 270 ms).
  it('a wake of 25 triggers past 50 branch rules on a full plan reads its cards once', async () => {
    const c = await w.make('A', { title: 'Busy' });
    fill(c.id);
    for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
      await w.rule({
        name: `Branch ${i}`,
        trigger: { kind: 'field_changed', fields: ['priority'] },
        conditions: [{ kind: 'field', field: 'title', op: 'contains', value: `never ${i}` }],
        steps: [
          { kind: 'for', related: { kind: 'linked' }, conditions: [], then: [{ kind: 'flag' }] },
        ],
      });
    for (let i = 0; i < AUTOMATION_EVENTS_PER_WAKE; i += 1)
      await w.send('POST', `/api/projects/A/items/${c.id}`, {
        set: { priority: i % 2 ? 'high' : 'low' },
      });
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    expect(
      w.plans.get('A')!.db.prepare('SELECT COUNT(*) AS n FROM automation_queue').get(),
    ).toEqual({ n: 0 });
    expect(wake).toBeLessThan(cpuBudgetMs(1500));
  }, 30_000);

  // Card Unblocked (spec "Triggers"): a blocker of 2,000 cards finished seven times before one wake, under 17 Card
  // Unblocked rules. Each rule ran on every card it freed (34,000 runs, and every event hashed and claimed them all
  // again); now on the first 100.
  it('a blocker of a full plan runs each Card Unblocked rule on 100 cards', async () => {
    const put = await w.send('PUT', '/api/projects/A/item-types', {
      itemTypes: { version: defaultCatalogue().version, types: [BLOCKS] },
    });
    expect(put.status).toBeLessThan(300);
    const blocker = await w.make('A', { title: 'Blocker' });
    const c = await w.make('A', { title: 'Blocked', 'f-blocked': [blocker.id] });
    fill(c.id, ITEMS_MAX - 2);
    const RULES = 17;
    for (let i = 0; i < RULES; i += 1)
      await w.rule({
        name: `Free ${i}`,
        trigger: { kind: 'card_unblocked' },
        conditions: [{ kind: 'field', field: 'title', op: 'contains', value: 'never' }],
        steps: [{ kind: 'flag' }],
      });
    // Done, back to Doing, done again: the wake reads the plan as it is, so the seven finishes reach one moment.
    for (let i = 0; i < 13; i += 1)
      await w.send('POST', `/api/projects/A/items/${blocker.id}/move`, {
        status: i % 2 ? 'doing' : 'done',
      });
    const db = w.plans.get('A')!.db;
    const store = room().automations.store;
    const before = store.claims;
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    // 17 rules, 100 cards each: every one claimed and checked once, none matching.
    expect(store.claims - before).toBe(RULES * AUTOMATION_DERIVED_CARDS_MAX);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM automation_runs WHERE result != 'no_match'").get(),
    ).toEqual({ n: 0 });
    expect(wake).toBeLessThan(cpuBudgetMs(4000));
  }, 60_000);

  // Phase 2 (docs/specs/026-plan/automations.md "Time triggers"; blueprint "The wake"): a full plan and 50 time
  // rules due at once. Five hear every card (each runs on its first 100, the queue's 500), the other 45 check every
  // card against a condition that never holds: 100,000 card checks in one wake, then its first 25 runs.
  it('a wake with 50 time rules due over 2,000 cards stays within its budget', async () => {
    const QUARTER = 15 * 60_000;
    const moment = Math.floor(Date.now() / QUARTER) * QUARTER;
    const at = new Date(moment).toISOString().slice(11, 16);
    const c = await w.make('A', { title: 'Late', due: addDays(localDay(moment, 'UTC'), -1) });
    fill(c.id);
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
