import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  AUTOMATION_BRANCH_CARDS_MAX,
  AUTOMATION_DERIVED_CARDS_MAX,
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_RULES_MAX,
  ITEMS_MAX,
  addDays,
  defaultCatalogue,
  localDay,
  type AutomationStep,
  type ItemTypeDef,
} from '@liveplanner/items';
import { AUTOMATION_NO_MATCH_LOG_MAX, runsToday } from './automation-log';
import { AUTOMATION_EVENTS_PER_WAKE, derivedCapped } from './automation-runner';
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

  // The same, every run writing (`noteWrite`): each write raised the store's rev, so the next branch read all 2,000
  // cards again, 1,000 reads in one wake (measured 7,530 ms on an M-series Mac); now the run's own writes go into the
  // cards held, and only a write from elsewhere reads them afresh (measured 690 ms).
  it('a wake of 25 triggers past 50 branch rules that each write reads its cards once', async () => {
    const c = await w.make('A', { title: 'Busy' });
    fill(c.id);
    for (let i = 0; i < AUTOMATION_RULES_MAX; i += 1)
      await w.rule({
        name: `Writer ${i}`,
        trigger: { kind: 'field_changed', fields: ['priority'] },
        conditions: [],
        // Each rule names the card its own way, so every run's write changes it.
        steps: [
          { kind: 'set_field', field: 'title', value: { text: `Writer ${i}` } },
          { kind: 'for', related: { kind: 'linked' }, conditions: [], then: [{ kind: 'flag' }] },
        ],
      });
    for (let i = 0; i < AUTOMATION_EVENTS_PER_WAKE; i += 1)
      await w.send('POST', `/api/projects/A/items/${c.id}`, {
        set: { priority: i % 2 ? 'high' : 'low' },
      });
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    const db = w.plans.get('A')!.db;
    // Every run up to the day's 1,000 wrote the card.
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM automation_runs WHERE result = 'done'").get(),
    ).toEqual({ n: 1000 });
    expect(wake).toBeLessThan(cpuBudgetMs(1500));
  }, 60_000);

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
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM automation_runs WHERE result != 'no_match' AND id NOT LIKE 'derived:%'",
        )
        .get(),
    ).toEqual({ n: 0 });
    // The cards past the first 100 are said once a rule on the Audit Trail, the seven finishes reaching one moment,
    // and spend none of the day.
    const capped = db
      .prepare("SELECT rule_id, result, body FROM automation_runs WHERE id LIKE 'derived:%'")
      .all() as { rule_id: string; result: string; body: string }[];
    expect(capped).toHaveLength(RULES);
    expect(new Set(capped.map((r) => r.rule_id)).size).toBe(RULES);
    for (const r of capped) {
      expect(r.result).toBe('skipped');
      expect(JSON.parse(r.body)).toMatchObject({
        reason: derivedCapped(AUTOMATION_DERIVED_CARDS_MAX, ITEMS_MAX - 1),
      });
    }
    expect(runsToday(room().automations.sql(), Date.now())).toBe(0);
    expect(wake).toBeLessThan(cpuBudgetMs(4000));
  }, 60_000);

  // A branch that moves its related cards (blueprint "The run"): each move puts the card at the end of its new
  // column, which read every card of the plan afresh, 100 reads of 2,000 cards for one run (measured 910 ms on an M-series Mac);
  // now from the cards the wake holds, kept in step by the run's own writes (measured 85 ms).
  it('a branch that moves 100 related cards of a full plan reads its cards once', async () => {
    const put = await w.send('PUT', '/api/projects/A/item-types', {
      itemTypes: { version: defaultCatalogue().version, types: [BLOCKS] },
    });
    expect(put.status).toBeLessThan(300);
    const blocker = await w.make('A', { title: 'Blocker' });
    const c = await w.make('A', { title: 'Blocked', 'f-blocked': [blocker.id] });
    fill(c.id, ITEMS_MAX - 2);
    await w.rule({
      name: 'Finish the blocked',
      trigger: { kind: 'field_changed', fields: ['priority'] },
      conditions: [],
      steps: [
        {
          kind: 'for',
          related: { kind: 'blocking' },
          conditions: [],
          then: [{ kind: 'move', status: 'done' }],
        },
      ],
    });
    await w.send('POST', `/api/projects/A/items/${blocker.id}`, { set: { priority: 'high' } });
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    const db = w.plans.get('A')!.db;
    const done = db
      .prepare(
        "SELECT rank FROM items WHERE json_extract(fields, '$.status') = 'done' ORDER BY item_key",
      )
      .all() as { rank: string }[];
    // The first 100 by number, each at the end of Done as it landed: every rank past the one before it.
    expect(done).toHaveLength(AUTOMATION_BRANCH_CARDS_MAX);
    for (let i = 1; i < done.length; i += 1) expect(done[i]!.rank > done[i - 1]!.rank).toBe(true);
    expect(wake).toBeLessThan(cpuBudgetMs(400));
  }, 60_000);

  // Work Tracker 816 (spec "How a step runs"): a rule's writes split at its AI step, one write each side, on a full
  // plan, a wake of 25 triggers, against the same steps with the AI step last (one write). Measured on an M-series
  // Mac under load: 47 to 50 ms CPU split against 57 to 60 ms whole (the order of the two wakes, not the split,
  // decides which is cheaper): the second write reads no cards afresh, the move taking the cards the wake holds.
  it('a rule split at its AI step costs a full plan little more than one write', async () => {
    const answer = { response: { summary: 'A summary.' } };
    Reflect.set(w.env, 'AI', { run: () => Promise.resolve(answer) });
    w.plans.get('A')!.restart();
    const c = await w.make('A', { title: 'Busy' });
    fill(c.id);
    // The card's own Card Created event out of the way, so each wake runs its 25 saves.
    await room().alarm();
    // Every save changes the priority, across both wakes.
    let saved = 0;
    const wake = async (name: string, steps: AutomationStep[]) => {
      const rule = await w.rule({
        name,
        trigger: { kind: 'field_changed', fields: ['priority'] },
        conditions: [],
        steps,
      });
      for (let i = 0; i < AUTOMATION_EVENTS_PER_WAKE; i += 1, saved += 1)
        await w.send('POST', `/api/projects/A/items/${c.id}`, {
          set: { priority: saved % 2 ? 'low' : 'high' },
        });
      room().automations.schedule.at = Date.now();
      const ms = await cpuMsOfAsync(() => room().alarm());
      await w.call('DELETE', `/${rule.id}`);
      // The run's own changes (queued, starting nothing) drained, so the next wake runs its own 25.
      room().automations.schedule.at = Date.now();
      await room().alarm();
      return ms;
    };
    const title = { kind: 'set_field', field: 'title', value: { from: 'priority' } } as const;
    const ai = { kind: 'ai', task: 'summarise' } as const;
    const whole = await wake('Whole', [title, { kind: 'move', status: 'doing' }, ai]);
    const split = await wake('Split', [title, ai, { kind: 'move', status: 'review' }]);
    const db = w.plans.get('A')!.db;
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM automation_runs WHERE result = 'done'").get(),
    ).toEqual({ n: 2 * AUTOMATION_EVENTS_PER_WAKE });
    expect(split).toBeLessThan(cpuBudgetMs(1500));
    expect(split - whole).toBeLessThan(cpuBudgetMs(500));
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
