import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { repeatCopyId, type Item, type RepeatRule } from '@liveplanner/items';
import { REPEAT_COPIES_PER_WAKE, REPEAT_MORE_MS, type RepeatSchedule } from './card-repeats';
import { createPlan, endRepeatWorld, repeatWorld, type RepeatWorld } from './test-repeat-world';

// Repeating cards from the plan's own alarm (docs/specs/026-plan/items.md "Repeating cards"), end to end: the real
// worker writes the rule, the plan's object settles it and makes the copies on its alarm.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const at = (iso: string) => Date.parse(iso);
const LONDON = 'Europe/London';
const rule = (r: Partial<RepeatRule> = {}): RepeatRule => ({
  every: 'day',
  from: '2026-11-02',
  timeZone: LONDON,
  ...r,
});

let w: RepeatWorld;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Monday 2 November 2026, 10:00 in London.
  vi.setSystemTime(at('2026-11-02T10:00:00Z'));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = repeatWorld();
  await createPlan(w, 'A');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const schedule = () => Reflect.get(plan().room, 'repeats') as RepeatSchedule;
const wakeAt = async (iso: string) => {
  vi.setSystemTime(at(iso));
  await plan().room.alarm();
};
const copiesOf = (items: Item[], source: Item) =>
  items.filter((i) => i.id !== source.id && i.fields['title'] === source.fields['title']);
// A woken object restores its state before it serves anything (blockConcurrencyWhile).
const woken = () => new Promise((r) => setTimeout(r, 0));
const rows = () => plan().db.prepare('SELECT * FROM item_repeats').all();

describe('a repeating card', () => {
  it('makes nothing the day it is set, then one copy at the next local midnight', async () => {
    const source = await w.make('A', {
      title: 'Weekly report',
      repeat: rule(),
      checklist: [{ text: 'Send', done: true }],
      due: '2026-11-02',
      labels: ['ops'],
    });
    // The write asked for a wake now; the wake settles the rule and asks for Tuesday's midnight.
    expect(schedule().at).toBe(Date.now());
    await plan().room.alarm();
    expect(copiesOf(await w.items('A'), source)).toHaveLength(0);
    expect(new Date(schedule().at!).toISOString()).toBe('2026-11-03T00:00:00.000Z');

    await wakeAt('2026-11-03T00:00:00Z');
    const [copy] = copiesOf(await w.items('A'), source);
    expect(copy).toMatchObject({
      id: repeatCopyId(source.id, '2026-11-03'),
      key: source.key + 1,
      createdBy: { name: 'Repeat' },
      fields: {
        title: 'Weekly report',
        status: 'todo',
        checklist: [{ text: 'Send', done: false }],
        due: '2026-11-03',
        labels: ['ops'],
      },
    });
    expect(copy!.fields['repeat']).toBeUndefined();
    expect(rows()).toMatchObject([{ item_id: source.id, last_made: '2026-11-03', dirty: 0 }]);
    // Its history says where it came from.
    const history = (await (
      await w.send('GET', `/api/projects/A/items/${copy!.id}/history`)
    ).json()) as { entries: { tag?: string }[] };
    expect(history.entries[0]?.tag).toBe('repeat');
  });

  it('never makes the same day twice: a second wake, and a restart', async () => {
    const source = await w.make('A', { title: 'Standup', repeat: rule() });
    await plan().room.alarm();
    await wakeAt('2026-11-03T00:00:01Z');
    await plan().room.alarm();
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
    // Evicted and woken: the schedule comes back from storage, and the day stays made.
    plan().restart();
    await woken();
    expect(new Date(schedule().at!).toISOString()).toBe('2026-11-04T00:00:00.000Z');
    await plan().room.alarm();
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
    // Even with its settled day lost, the day's copy id is taken: settled, never a second copy.
    plan().db.prepare(`UPDATE item_repeats SET last_made = '2026-11-02', next_at = 0`).run();
    plan().restart();
    await woken();
    await plan().room.alarm();
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
  });

  it('wakes late: one copy for the latest missed day, never a burst', async () => {
    const source = await w.make('A', {
      title: 'Invoices',
      repeat: rule({ every: 'week', days: [1] }),
    });
    await plan().room.alarm();
    await wakeAt('2026-11-25T15:00:00Z');
    const copies = copiesOf(await w.items('A'), source);
    expect(copies.map((c) => c.id)).toEqual([repeatCopyId(source.id, '2026-11-23')]);
    expect(new Date(schedule().at!).toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it("makes the 31st's copy on the 30th of a 30-day month, in the setter's zone", async () => {
    vi.setSystemTime(at('2026-10-31T09:00:00Z'));
    const source = await w.make('A', {
      title: 'Month end',
      repeat: rule({ every: 'month', date: 31, from: '2026-10-31', timeZone: 'Pacific/Auckland' }),
    });
    await plan().room.alarm();
    // Auckland's 30 November starts at 11:00 UTC on the 29th.
    expect(new Date(schedule().at!).toISOString()).toBe('2026-11-29T11:00:00.000Z');
    await wakeAt('2026-11-29T10:59:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(0);
    await wakeAt('2026-11-29T11:00:00Z');
    expect(copiesOf(await w.items('A'), source).map((c) => c.id)).toEqual([
      repeatCopyId(source.id, '2026-11-30'),
    ]);
  });

  it('wakes at local midnight across a clock change', async () => {
    vi.setSystemTime(at('2026-10-24T12:00:00Z'));
    await w.make('A', { title: 'Weekend', repeat: rule({ from: '2026-10-24' }) });
    await plan().room.alarm();
    // London is still on summer time at the start of 25 October.
    expect(new Date(schedule().at!).toISOString()).toBe('2026-10-24T23:00:00.000Z');
    await wakeAt('2026-10-24T23:00:00Z');
    expect(new Date(schedule().at!).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('lands in the chosen column, whatever state the source is in', async () => {
    const source = await w.make(
      'A',
      { title: 'Review', repeat: rule({ status: 'backlog' }) },
      'done',
    );
    await plan().room.alarm();
    await wakeAt('2026-11-03T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)[0]!.fields['status']).toBe('backlog');
  });

  it('stops for good when the repeat is stopped, and when the card is deleted', async () => {
    const source = await w.make('A', { title: 'Stop me', repeat: rule() });
    await plan().room.alarm();
    expect(
      (await w.send('POST', `/api/projects/A/items/${source.id}`, { clear: ['repeat'] })).status,
    ).toBe(200);
    await plan().room.alarm();
    expect(rows()).toEqual([]);
    await wakeAt('2026-11-05T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(0);

    const other = await w.make('A', { title: 'Delete me', repeat: rule() });
    expect(rows()).toHaveLength(1);
    await w.send('DELETE', `/api/projects/A/items/${other.id}`);
    expect(rows()).toEqual([]);
  });

  it('makes none while trashed, and resumes from today once restored', async () => {
    const source = await w.make('A', { title: 'Trash me', repeat: rule() });
    await plan().room.alarm();
    await w.send('POST', `/api/projects/A/items/${source.id}`, {
      set: { status: 'trash', trashedFrom: 'todo' },
    });
    await plan().room.alarm();
    expect(rows()).toMatchObject([{ next_at: null, dirty: 0 }]);
    expect(schedule().at).toBeNull();
    await wakeAt('2026-11-10T08:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(0);
    await w.send('POST', `/api/projects/A/items/${source.id}`, {
      set: { status: 'todo' },
      clear: ['trashedFrom'],
    });
    await plan().room.alarm();
    // Today's copy, none for the days it sat in the Trash.
    expect(copiesOf(await w.items('A'), source).map((c) => c.id)).toEqual([
      repeatCopyId(source.id, '2026-11-10'),
    ]);
  });

  it('bounds a wake, and picks the rest up a moment later', async () => {
    const n = REPEAT_COPIES_PER_WAKE + 5;
    const res = await w.send('POST', '/api/projects/A/items/bulk', {
      items: Array.from({ length: n }, (_, i) => ({
        type: 'task',
        fields: { title: `Card ${i}`, repeat: rule() },
        place: { status: 'todo' },
      })),
    });
    expect(res.status).toBe(201);
    await plan().room.alarm();
    expect(schedule().at).toBe(Date.now() + REPEAT_MORE_MS);
    await wakeAt('2026-11-02T10:00:01Z');
    await wakeAt('2026-11-03T00:00:00Z');
    expect(await w.items('A')).toHaveLength(n + REPEAT_COPIES_PER_WAKE);
    await wakeAt('2026-11-03T00:00:01Z');
    expect(await w.items('A')).toHaveLength(2 * n);
  });

  it('a duplicated plan starts its own copies from the day it sees the rule, never catching up', async () => {
    vi.setSystemTime(at('2026-11-20T10:00:00Z'));
    // A rule saved weeks ago, arriving with a copy of a plan.
    const source = await w.make('A', { title: 'Old rule', repeat: rule({ from: '2026-10-01' }) });
    await plan().room.alarm();
    // Today's copy at most, nothing for the weeks before.
    expect(copiesOf(await w.items('A'), source).map((c) => c.id)).toEqual([
      repeatCopyId(source.id, '2026-11-20'),
    ]);
  });
});

describe('a plan without repeating cards', () => {
  it('asks for no wake and holds no schedule, however many writes', async () => {
    const card = await w.make('A', { title: 'Plain' });
    const ms = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 50; i += 1)
        await w.send('POST', `/api/projects/A/items/${card.id}`, { set: { title: `Plain ${i}` } });
    });
    expect(rows()).toEqual([]);
    expect(schedule().at).toBeNull();
    expect(ms).toBeLessThan(cpuBudgetMs(4000));
  });
});
