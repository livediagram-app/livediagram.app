import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { AUTOMATION_RULES_MAX, AUTOMATION_RUNS_PER_DAY } from '@liveplanner/items';
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
  });

  it('a wake runs 25 triggers past 50 rules within its budget', async () => {
    await fiftyRules();
    const c = await w.make('A', { title: 'Busy' });
    await saves(c.id);
    room().automations.schedule.at = Date.now();
    const wake = await cpuMsOfAsync(() => room().alarm());
    const n = w.plans.get('A')!.db.prepare('SELECT COUNT(*) AS n FROM automation_runs').get();
    // 1,250 checks, held to the day's 1,000 runs (a run that matched nothing is a run, and counts).
    expect(n).toEqual({ n: Math.min(25 * AUTOMATION_RULES_MAX, AUTOMATION_RUNS_PER_DAY) });
    expect(wake).toBeLessThan(cpuBudgetMs(1500));
  });
});
