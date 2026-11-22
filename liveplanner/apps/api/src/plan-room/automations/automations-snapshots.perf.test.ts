import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { AutomationRun, Item } from '@liveplanner/items';
import { insertItems, listItems } from '../../db/items';
import type { PlanEnv } from '../../types';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// What a rule's snapshot steps cost a big plan (docs/specs/026-plan/automations.md "Snapshot steps"; the card's risk
// "Big plans"): one Scheduled run on a plan of 5,000 cards takes a snapshot of it and reverts it to another, inside a
// wake's CPU (measured 163 ms; the budget leaves room for a slow runner). CPU time, never wall-clock (testing.md).
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const CARDS = 5_000;
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

const PERSON = { id: 'u1', name: 'Ana', color: '#000' };
const card = (n: number): Item => ({
  id: `c${n}`,
  type: 'task',
  key: n,
  rank: `a${String(n).padStart(6, '0')}`,
  status: 'todo',
  fields: { title: `Card ${n} with a title as long as most are` },
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: PERSON,
  updatedBy: PERSON,
});

describe('snapshot steps on a big plan', () => {
  it(`take and revert ${CARDS} cards in one run, inside the budget`, async () => {
    const plan = w.plans.get('A')!;
    const env = Reflect.get(plan.room, 'roomEnv') as PlanEnv;
    await insertItems(
      env,
      'A',
      Array.from({ length: CARDS }, (_, i) => card(i + 1)),
    );
    const taken = await w.as('owner', 'POST', '/snapshots', { name: 'Start' });
    const start = (await taken.json<{ snapshot: { id: string } }>()).snapshot.id;
    plan.db.prepare('UPDATE items SET fields = \'{"title":"Changed"}\'').run();
    // The rule's time the last quarter hour, so its moment has come.
    const at = Math.floor(Date.now() / 900_000) * 900_000;
    const rule = await w.rule({
      name: 'Reset',
      trigger: { kind: 'scheduled', every: 'day', at: new Date(at).toISOString().slice(11, 16) },
      steps: [
        { kind: 'take_snapshot', name: 'Before {{now.date}}' },
        { kind: 'revert_snapshot', snapshot: start, name: 'Start' },
      ],
      timeZone: 'UTC',
    });
    plan.db
      .prepare('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?')
      .run(at, rule.id);
    plan.room.automations.schedule.restoreTimes();
    const ms = await cpuMsOfAsync(() => plan.room.alarm());
    const { runs } = await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>();
    expect(runs[0]?.result).toBe('done');
    const items = await listItems(env, 'A');
    expect(items.length).toBe(CARDS);
    expect(items.every((i) => i.fields['title'] !== 'Changed')).toBe(true);
    expect(ms).toBeLessThan(cpuBudgetMs(2_000));
  });
});
