import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRun } from '@liveplanner/items';
import { WAKE_FAILURES_MAX, WAKE_GAVE_UP } from '@liveworkspace/automations/room';
import { endRepeatWorld } from '../test-repeat-world';
import { runAutomations } from './plan-room-automations';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// A plan's wake that fails as a whole backs off (1, 2, 4 … minutes) and gives up after 12 in a row, saying so once
// on the Audit Trail (docs/specs/026-plan/automations.md "Runs, limits and loops").
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;

describe('a plan wake that keeps failing', () => {
  it('backs off, then gives up on the 12th and starts afresh', async () => {
    await w.rule({ steps: [{ kind: 'flag' }] });
    const c = await w.make('A', { title: 'Stuck' });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    const schedule = room().automations.schedule;
    const enabled = vi.spyOn(room().automations.store, 'enabled').mockImplementation(() => {
      throw new Error('bad stored data');
    });
    let now = Date.now();
    const gaps: number[] = [];
    for (let i = 1; i < WAKE_FAILURES_MAX; i += 1) {
      await runAutomations(room(), now);
      expect(schedule.failures).toBe(i);
      gaps.push((schedule.retryAt - now) / 60_000);
      now = schedule.wakeAt!;
    }
    expect(gaps).toEqual([1, 2, 4, 8, 16, 32, 60, 60, 60, 60, 60]);
    await runAutomations(room(), now);
    expect(schedule).toMatchObject({ failures: 0, retryAt: 0, at: null });
    enabled.mockRestore();
    expect((await runs()).filter((r) => r.reason === WAKE_GAVE_UP)).toHaveLength(1);
  });

  it('clears the count on a wake that works', async () => {
    await w.rule({ steps: [{ kind: 'flag' }] });
    const c = await w.make('A', { title: 'Once' });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    const schedule = room().automations.schedule;
    const enabled = vi.spyOn(room().automations.store, 'enabled').mockImplementation(() => {
      throw new Error('bad stored data');
    });
    const now = Date.now();
    await runAutomations(room(), now);
    await runAutomations(room(), now + 1);
    expect(schedule.failures).toBe(1);
    enabled.mockRestore();
    await runAutomations(room(), schedule.wakeAt!);
    expect(schedule).toMatchObject({ failures: 0, retryAt: 0 });
    expect((await runs()).map((r) => r.result)).toContain('done');
  });
});
