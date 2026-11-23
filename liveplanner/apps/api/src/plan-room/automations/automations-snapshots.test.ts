import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRule, AutomationRun } from '@liveplanner/items';
import type { PlanEnv } from '../../types';
import { endRepeatWorld } from '../test-repeat-world';
import { planKitSnapshots } from './automation-snapshots';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// Take Snapshot and Revert to Snapshot on a plan (docs/specs/026-plan/automations.md "Snapshot steps"; blueprint
// automations.md "Snapshot steps"), end to end through the room: a weekly Scheduled rule runs once for the plan, on a
// fake clock, taking a snapshot by a filled name and putting the plan back for everyone; a token never saves a revert;
// a revert's snapshot is kept, at most 5; one gone fails the run with why and the rule needs attention by its name.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

let w: AutomationWorld;
const tally = vi.fn();
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(tally);
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const MONDAY_9 = Date.UTC(2026, 10, 23, 9, 0);
const WEEK = 7 * 24 * 60 * 60_000;
const weekly = { kind: 'scheduled' as const, every: 'week' as const, days: [1], at: '09:00' };
const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
type Listed = {
  snapshots: { id: string; name: string; kind: string; author: { name: string } | null }[];
};
const snapshots = async () =>
  (await (await w.as('owner', 'GET', '/snapshots')).json<Listed>()).snapshots;
const snap = async (name: string) => {
  const res = await w.as('owner', 'POST', '/snapshots', { name });
  expect(res.status).toBe(201);
  return (await res.json<{ snapshot: { id: string } }>()).snapshot.id;
};
const titles = async () => (await w.items('A')).map((i) => i.fields['title'] as string).sort();
// The rule's moment due, the clock at it, and the wake.
async function wake(rule: AutomationRule, at: number) {
  vi.setSystemTime(at + 1);
  plan()
    .db.prepare('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?')
    .run(at, rule.id);
  room().automations.schedule.restoreTimes();
  await room().alarm();
}

describe('a weekly rule that reverts the plan', () => {
  it('runs once a week for the plan, putting it back for everyone, by the rule', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: MONDAY_9 - WEEK });
    await w.make('A', { title: 'Kept' });
    const start = await snap('Monday Start');
    const rule = await w.rule({
      name: 'Monday Reset',
      trigger: weekly,
      steps: [{ kind: 'revert_snapshot', snapshot: start, name: 'Monday Start' }],
      timeZone: 'UTC',
    });
    // History keeps it for the rule.
    await w.make('A', { title: 'Added in the week' });
    await w.make('A', { title: 'Another' });
    expect(await titles()).toEqual(['Added in the week', 'Another', 'Kept']);

    await wake(rule, MONDAY_9);
    expect(await titles()).toEqual(['Kept']);
    const [run] = await runs();
    expect(run).toMatchObject({ ruleId: rule.id, result: 'done' });
    expect(run!.steps.at(-1)).toMatchObject({
      ok: true,
      text: expect.stringContaining('Monday Start'),
    });
    // Once for the plan: one run, however many cards.
    expect((await runs()).length).toBe(1);
    // The safety snapshot is the rule's, by name.
    const list = await snapshots();
    expect(list.some((s) => s.kind === 'before-revert' && s.author?.name === 'Monday Reset')).toBe(
      true,
    );
    expect(list.some((s) => s.id === start)).toBe(true);

    // The next week, again: the moment's id is its own, so a repeated wake runs nothing more.
    await w.make('A', { title: 'Week two' });
    await wake(rule, MONDAY_9 + WEEK);
    await wake(rule, MONDAY_9 + WEEK);
    expect(await titles()).toEqual(['Kept']);
    expect((await runs()).length).toBe(2);
    expect(tally.mock.calls.some((c) => c[0] === '[automations] snapshot')).toBe(true);
  });

  it('takes a snapshot by a filled name, then reverts, in one run', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: MONDAY_9 - WEEK });
    const start = await snap('Start');
    const rule = await w.rule({
      name: 'Backup Then Reset',
      trigger: weekly,
      steps: [
        { kind: 'take_snapshot', name: 'Week of {{now.date}}' },
        { kind: 'revert_snapshot', snapshot: start, name: 'Start' },
      ],
      timeZone: 'UTC',
    });
    await w.make('A', { title: 'Work' });
    await wake(rule, MONDAY_9);
    const [run] = await runs();
    expect(run!.result).toBe('done');
    const taken = (await snapshots()).find((s) => s.name.startsWith('Week of '));
    expect(taken?.name).not.toContain('{{');
    expect(taken?.author?.name).toBe('Backup Then Reset');
    expect(await titles()).toEqual([]);
  });
});

describe('a snapshot gone', () => {
  it('fails the run with why, and the rule needs attention by the snapshot’s name', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: MONDAY_9 - WEEK });
    const start = await snap('Monday Start');
    const rule = await w.rule({
      name: 'Monday Reset',
      trigger: weekly,
      steps: [{ kind: 'revert_snapshot', snapshot: start, name: 'Monday Start' }],
      timeZone: 'UTC',
    });
    await w.make('A', { title: 'Kept' });
    // Gone as a copied plan's would be: not here at all.
    plan().db.prepare('DELETE FROM snapshots WHERE id = ?').run(start);
    await wake(rule, MONDAY_9);
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'failed', gone: { kind: 'snapshot', id: start } });
    expect(await titles()).toEqual(['Kept']);
    const listed = await (
      await w.call('GET', '')
    ).json<{
      rules: { id: string; needs: string[]; attention: unknown[] }[];
    }>();
    const row = listed.rules.find((r) => r.id === rule.id)!;
    expect(row.needs).toEqual(['Snapshot “Monday Start” is gone']);
    expect(row.attention).toEqual([{ kind: 'snapshot', id: start, name: 'Monday Start' }]);
  });
});

describe('who saves a snapshot step', () => {
  it('lets a token add Take Snapshot but never a revert, on create, save or copy', async () => {
    const start = await snap('Start');
    const revert = { kind: 'revert_snapshot', snapshot: start, name: 'Start' };
    const body = (steps: unknown[]) => ({
      name: 'Reset',
      trigger: weekly,
      conditions: [],
      steps,
      chain: false,
      timeZone: 'UTC',
    });
    const refused = await w.call('POST', '', body([revert]), 'token');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: 'automation_needs_a_person' });
    const took = await w.call(
      'POST',
      '',
      body([{ kind: 'take_snapshot', name: 'Weekly' }]),
      'token',
    );
    expect(took.status).toBe(201);
    const { rule } = await took.json<{ rule: AutomationRule }>();
    const save = await w.call('PUT', `/${rule.id}`, body([revert]), 'token');
    expect(save.status).toBe(403);
    // A person saves it; a token may not copy it.
    const mine = await w.call('PUT', `/${rule.id}`, body([revert]));
    expect(mine.status).toBe(200);
    const copy = await w.call('POST', `/${rule.id}/duplicate`, undefined, 'token');
    expect(copy.status).toBe(403);
    // Only an Editor of the whole plan manages rules at all.
    const participant = await w.call('POST', '', body([revert]), 'participant');
    expect(participant.status).toBe(403);
  });

  it('keeps a revert’s snapshot, at most 5 for the plan’s rules', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const id = await snap(`S${i}`);
      ids.push(id);
      const res = await w.call('POST', '', {
        name: `Reset ${i}`,
        trigger: weekly,
        conditions: [],
        steps: [{ kind: 'revert_snapshot', snapshot: id, name: `S${i}` }],
        chain: false,
        timeZone: 'UTC',
      });
      if (i <= 5) expect(res.status).toBe(201);
      else {
        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({ error: 'automation_snapshots_full' });
      }
    }
    // The five kept outlive the latest-five rule: more snapshots never push them out.
    for (let i = 0; i < 6; i += 1) await snap(`More ${i}`);
    const left = new Set((await snapshots()).map((s) => s.id));
    for (const id of ids.slice(0, 5)) expect(left.has(id)).toBe(true);
    // A kept one can't be deleted.
    const del = await w.as('owner', 'DELETE', `/snapshots/${ids[0]}`);
    expect(del.status).toBeGreaterThanOrEqual(400);
  });

  it('refuses a revert that is not last, and a snapshot step on a per-card time rule', async () => {
    const start = await snap('Start');
    const res = await w.call('POST', '', {
      name: 'Bad',
      trigger: weekly,
      conditions: [],
      steps: [
        { kind: 'revert_snapshot', snapshot: start },
        { kind: 'take_snapshot', name: 'x' },
      ],
      chain: false,
      timeZone: 'UTC',
    });
    expect(res.status).toBe(400);
    const perCard = await w.call('POST', '', {
      name: 'Bad Too',
      trigger: weekly,
      conditions: [],
      steps: [{ kind: 'flag' }, { kind: 'take_snapshot', name: 'x' }],
      chain: false,
      timeZone: 'UTC',
    });
    expect(perCard.status).toBe(400);
  });
});

describe('the plan’s snapshots as a rule’s kit reads them', () => {
  it('lists them by id and name', async () => {
    const start = await snap('Start');
    const env = Reflect.get(room(), 'roomEnv') as PlanEnv;
    expect(await planKitSnapshots(env, 'A').list()).toEqual([{ id: start, name: 'Start' }]);
  });
});

describe('a test of the steps', () => {
  it('says what each would do and changes nothing', async () => {
    const start = await snap('Start');
    const card = await w.make('A', { title: 'Stays' });
    const res = await w.call('POST', '/test', {
      rule: {
        name: 'Try',
        trigger: { kind: 'card_moved', to: ['done'] },
        conditions: [],
        steps: [
          { kind: 'take_snapshot', name: 'Try {{card.title}}' },
          { kind: 'revert_snapshot', snapshot: start, name: 'Start' },
        ],
        chain: false,
        timeZone: 'UTC',
      },
      item: card.id,
    });
    expect(res.status).toBe(200);
    const { run } = await res.json<{ run: AutomationRun }>();
    const text = run.steps.map((s) => s.text).join('\n');
    expect(text).toContain('Would take a snapshot named “Try Stays”');
    expect(text).toContain('Would revert to “Start”');
    expect(await titles()).toEqual(['Stays']);
    expect((await snapshots()).length).toBe(1);
  });
});
