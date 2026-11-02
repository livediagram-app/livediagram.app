import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import type { Item, ItemFieldValue } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { applyItemWrite, inverseItemWrites, type ItemStoreState, type ItemWrite } from './store';
import { ALI, SAM, item } from './test-items';
import {
  applyTimeOp,
  carriedTimeValue,
  elapsedClock,
  inverseTimeOp,
  MINUTE_MS,
  readTimeOp,
  readTimeValue,
  runningTimerOf,
  timeOpOwner,
  timePerson,
  timeTotal,
  timerMinutes,
  TIME_ENTRIES_MAX,
  type TimeOp,
} from './time-tracking';
import {
  readItemCreate,
  readItemWrite,
  timeSpentWritten,
  timeWriteRefusal,
  writtenItemsRefusal,
} from './write-checks';

// Time Spent (docs/specs/026-plan/item-types.md "Time Spent").

const FIELD = 'f-spent';
const work: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'work',
  label: 'Work',
  fields: ['title', 'status', FIELD, 'f-est'],
  custom: [
    { id: FIELD, label: 'Time Spent', kind: 'duration', timeSpent: true },
    { id: 'f-est', label: 'Estimate', kind: 'duration' },
  ],
};
const types = [work];
const T0 = 1_000_000;
const at = (ms: number, by = SAM) => ({ now: T0 + ms, by });
const asValue = (v: unknown) => v as ItemFieldValue;

function step(card: Item, op: TimeOp, ctx = at(0)): Item {
  const r = applyTimeOp(card, FIELD, op, ctx);
  if (!r.ok) throw new Error(r.error);
  return r.item;
}
const valueOf = (card: Item) => readTimeValue(card.fields[FIELD]);

describe('timers and entries', () => {
  it('starts a timer, stops it into an entry of whole minutes, and leaves no key when empty', () => {
    const card = item({ title: 'A' }, { type: 'work' });
    const started = step(card, { op: 'start', timer: 'timer001' });
    expect(started.rev).toBe(card.rev + 1);
    expect(started.updatedAt).toBe(card.updatedAt);
    expect(valueOf(started)).toEqual({
      people: { [SAM.id]: { name: SAM.name, color: SAM.color } },
      entries: [],
      running: [{ id: 'timer001', by: SAM.id, start: T0 }],
    });
    // A second start while the timer runs changes nothing.
    expect(step(started, { op: 'start', timer: 'timer002' })).toBe(started);
    const stopped = step(
      started,
      { op: 'stop', timer: 'timer001', entry: 'entry001' },
      at(90 * MINUTE_MS + 31_000, ALI),
    );
    expect(valueOf(stopped)).toEqual({
      people: { [SAM.id]: { name: SAM.name, color: SAM.color } },
      entries: [{ id: 'entry001', by: SAM.id, minutes: 91, at: T0 + 90 * MINUTE_MS + 31_000 }],
      running: [],
    });
    // Stopped on another device first: nothing to do.
    expect(step(stopped, { op: 'stop', timer: 'timer001', entry: 'entry002' })).toBe(stopped);
    const removed = step(stopped, { op: 'remove', entry: 'entry001' });
    expect(removed.fields[FIELD]).toBeUndefined();
    expect(step(removed, { op: 'remove', entry: 'entry001' })).toBe(removed);
  });

  it('records nothing for a timer stopped under half a minute', () => {
    const started = step(item({}, { type: 'work' }), { op: 'start', timer: 'timer001' });
    const stopped = step(started, { op: 'stop', timer: 'timer001', entry: 'entry001' }, at(29_000));
    expect(stopped.fields[FIELD]).toBeUndefined();
    expect(timerMinutes(T0, T0 + 29_999)).toBe(0);
    expect(timerMinutes(T0, T0 + 30_000)).toBe(1);
    expect(timerMinutes(T0 + 5, T0)).toBe(0);
  });

  it('counts two people’s concurrent timers both, each their own', () => {
    let card = item({}, { type: 'work' });
    card = step(card, { op: 'start', timer: 'timer001' }, at(0, SAM));
    card = step(card, { op: 'start', timer: 'timer002' }, at(60_000, ALI));
    expect(valueOf(card).running.map((r) => r.by)).toEqual([SAM.id, ALI.id]);
    expect(runningTimerOf(valueOf(card), ALI.id)?.id).toBe('timer002');
    card = step(card, { op: 'stop', timer: 'timer001', entry: 'entry001' }, at(30 * MINUTE_MS));
    card = step(
      card,
      { op: 'stop', timer: 'timer002', entry: 'entry002' },
      at(40 * MINUTE_MS, ALI),
    );
    const value = valueOf(card);
    expect(value.entries.map((e) => [e.by, e.minutes])).toEqual([
      [SAM.id, 30],
      [ALI.id, 39],
    ]);
    expect(timeTotal(value)).toBe(69);
    expect(timePerson(value, ALI.id)).toEqual(ALI);
    expect(timePerson(value, 'p-gone')).toEqual({
      id: 'p-gone',
      name: 'Someone',
      color: '#94a3b8',
    });
  });

  it('puts an entry back in time order, once, naming its person', () => {
    let card = step(
      item({}, { type: 'work' }),
      { op: 'add', entry: 'entry002', minutes: 5 },
      at(50),
    );
    const put: TimeOp = {
      op: 'put',
      entry: { id: 'entry001', by: ALI.id, minutes: 7, at: T0 },
      person: ALI,
    };
    card = step(card, put, at(90));
    expect(valueOf(card).entries.map((e) => e.id)).toEqual(['entry001', 'entry002']);
    expect(valueOf(card).people[ALI.id]).toEqual({ name: ALI.name, color: ALI.color });
    expect(step(card, put)).toBe(card);
    expect(readTimeValue(asValue({ people: [], entries: 'x', running: {} }))).toEqual({
      people: {},
      entries: [],
      running: [],
    });
  });

  it('adds manual entries, a running timer discarded leaving nothing', () => {
    let card = step(item({}, { type: 'work' }), { op: 'add', entry: 'entry001', minutes: 75 });
    expect(step(card, { op: 'add', entry: 'entry001', minutes: 5 })).toBe(card);
    card = step(card, { op: 'start', timer: 'timer001' });
    card = step(card, { op: 'remove', entry: 'timer001' });
    expect(valueOf(card)).toMatchObject({ entries: [{ minutes: 75 }], running: [] });
  });

  it('holds at most TIME_ENTRIES_MAX entries and timers together', () => {
    const entries = Array.from({ length: TIME_ENTRIES_MAX - 1 }, (_, i) => ({
      id: `entry${String(i).padStart(3, '0')}`,
      by: SAM.id,
      minutes: 1,
      at: i,
    }));
    const card = item({ [FIELD]: asValue({ people: {}, entries, running: [] }) }, { type: 'work' });
    const full = step(card, { op: 'start', timer: 'timer001' });
    for (const op of [
      { op: 'start', timer: 'timer002' },
      { op: 'add', entry: 'entry999', minutes: 5 },
      { op: 'put', entry: { id: 'entry998', by: ALI.id, minutes: 5, at: 1 }, person: ALI },
    ] as TimeOp[])
      expect(applyTimeOp(full, FIELD, op, at(0, ALI))).toEqual({ ok: false, error: 'time_full' });
    // 100 entries stay well within a card's 16 KB of fields.
    expect(JSON.stringify(full.fields).length).toBeLessThan(8_000);
  });
});

describe('reading', () => {
  it('reads what reads, dropping malformed rows and repeats', () => {
    expect(readTimeValue(undefined)).toEqual({ people: {}, entries: [], running: [] });
    expect(readTimeValue(90)).toEqual({ people: {}, entries: [], running: [] });
    expect(
      readTimeValue(
        asValue({
          people: { [SAM.id]: { name: 5, color: 'red' }, '': { name: 'x' }, [ALI.id]: 'no' },
          entries: [
            { id: 'entry001', by: SAM.id, minutes: 5, at: 1 },
            { id: 'entry001', by: SAM.id, minutes: 9, at: 1 },
            { id: 'bad', by: SAM.id, minutes: 5, at: 1 },
            { id: 'entry002', by: SAM.id, minutes: 0, at: 1 },
            'x',
          ],
          running: [{ id: 'timer001', by: SAM.id, start: -1 }, null],
        }),
      ),
    ).toEqual({
      people: { [SAM.id]: { name: 'Someone', color: '#94a3b8' } },
      entries: [{ id: 'entry001', by: SAM.id, minutes: 5, at: 1 }],
      running: [],
    });
  });

  it('carries a value across a create only when all of it reads', () => {
    const good = {
      people: {},
      entries: [{ id: 'entry001', by: SAM.id, minutes: 5, at: 1 }],
      running: [],
    };
    expect(carriedTimeValue(good)).toEqual(good);
    expect(carriedTimeValue({ ...good, extra: 1 })).toBeNull();
    expect(carriedTimeValue({ ...good, entries: [{ id: 'x' }] })).toBeNull();
    expect(carriedTimeValue({ entries: [] })).toBeNull();
    expect(carriedTimeValue('x')).toBeNull();
    const many = Array.from({ length: TIME_ENTRIES_MAX + 1 }, (_, i) => ({
      id: `entry${String(i).padStart(3, '0')}`,
      by: SAM.id,
      minutes: 1,
      at: i,
    }));
    expect(carriedTimeValue({ people: {}, entries: many, running: [] })).toBeNull();
  });

  it('reads a time write as sent, or refuses it', () => {
    expect(readTimeOp({ op: 'start', timer: 'timer001' })).toEqual({
      op: 'start',
      timer: 'timer001',
    });
    expect(readTimeOp({ op: 'stop', timer: 'timer001', entry: 'entry001', x: 1 })).toEqual({
      op: 'stop',
      timer: 'timer001',
      entry: 'entry001',
    });
    expect(readTimeOp({ op: 'add', entry: 'entry001', minutes: 30 })).toEqual({
      op: 'add',
      entry: 'entry001',
      minutes: 30,
    });
    expect(readTimeOp({ op: 'remove', entry: 'entry001' })).toEqual({
      op: 'remove',
      entry: 'entry001',
    });
    expect(
      readTimeOp({
        op: 'put',
        entry: { id: 'entry001', by: ALI.id, minutes: 3, at: 4 },
        person: { id: ALI.id, name: ALI.name, color: ALI.color },
      }),
    ).toEqual({ op: 'put', entry: { id: 'entry001', by: ALI.id, minutes: 3, at: 4 }, person: ALI });
    for (const bad of [
      null,
      { op: 'start' },
      { op: 'stop', timer: 'timer001' },
      { op: 'add', entry: 'entry001', minutes: 0 },
      { op: 'add', entry: 'entry001', minutes: 1.5 },
      { op: 'remove', entry: '<script>' },
      { op: 'put', entry: { id: 'entry001', by: ALI.id, minutes: 3, at: 4 }, person: SAM },
      { op: 'put', entry: { id: 'entry001' }, person: ALI },
      { op: 'reset' },
    ])
      expect(readTimeOp(bad), JSON.stringify(bad)).toBe('time_invalid');
  });

  it('shows a timer’s elapsed time as a clock', () => {
    expect(elapsedClock(5_000)).toBe('0:05');
    expect(elapsedClock(12 * 60_000 + 5_000)).toBe('12:05');
    expect(elapsedClock(3_725_000)).toBe('1:02:05');
    expect(elapsedClock(-3_000)).toBe('0:00');
  });

  it('names whose timer or entry a write touches', () => {
    const value = readTimeValue(
      asValue({
        people: {},
        entries: [{ id: 'entry001', by: ALI.id, minutes: 5, at: 1 }],
        running: [{ id: 'timer001', by: ALI.id, start: 1 }],
      }),
    );
    expect(timeOpOwner(value, { op: 'start', timer: 'timer009' }, SAM.id)).toBe(SAM.id);
    expect(timeOpOwner(value, { op: 'add', entry: 'entry009', minutes: 1 }, SAM.id)).toBe(SAM.id);
    expect(timeOpOwner(value, { op: 'stop', timer: 'timer001', entry: 'e' }, SAM.id)).toBe(ALI.id);
    expect(timeOpOwner(value, { op: 'stop', timer: 'gone', entry: 'e' }, SAM.id)).toBeNull();
    expect(timeOpOwner(value, { op: 'remove', entry: 'entry001' }, SAM.id)).toBe(ALI.id);
    expect(timeOpOwner(value, { op: 'remove', entry: 'timer001' }, SAM.id)).toBe(ALI.id);
    expect(timeOpOwner(value, { op: 'remove', entry: 'gone' }, SAM.id)).toBeNull();
    const put = {
      op: 'put',
      entry: { id: 'e', by: ALI.id, minutes: 1, at: 1 },
      person: ALI,
    } as const;
    expect(timeOpOwner(value, put, SAM.id)).toBe(ALI.id);
  });
});

describe('the store', () => {
  const card = item({ title: 'A' }, { type: 'work', id: 'card0001' });
  const state: ItemStoreState = { items: [card], rev: 3, nextKey: 2 };
  const write = (op: TimeOp): ItemWrite => ({ kind: 'time', id: card.id, field: FIELD, op });

  it('applies a time write as one change, and undoes only an add and an entry’s remove', () => {
    const r = applyItemWrite(state, write({ op: 'add', entry: 'entry001', minutes: 45 }), at(0));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.rev).toBe(4);
    expect(r.upserts[0]!.fields[FIELD]).toMatchObject({ entries: [{ minutes: 45 }] });
    const undo = inverseItemWrites(state, write({ op: 'add', entry: 'entry001', minutes: 45 }));
    expect(undo).toEqual([write({ op: 'remove', entry: 'entry001' })]);
    const back = inverseItemWrites(r.state, write({ op: 'remove', entry: 'entry001' }));
    expect(back).toEqual([
      write({
        op: 'put',
        entry: { id: 'entry001', by: SAM.id, minutes: 45, at: T0 },
        person: SAM,
      }),
    ]);
    const put = applyItemWrite(state, back![0]!, at(0, ALI));
    if (!put.ok) throw new Error(put.error);
    expect(readTimeValue(put.upserts[0]!.fields[FIELD]).entries[0]!.by).toBe(SAM.id);
    expect(inverseItemWrites(r.state, write({ op: 'remove', entry: 'gone' }))).toBeNull();
    expect(inverseItemWrites(state, write({ op: 'start', timer: 'timer001' }))).toBeNull();
    expect(
      inverseItemWrites(state, write({ op: 'stop', timer: 'timer001', entry: 'e1' })),
    ).toBeNull();
    expect(
      inverseTimeOp(card, FIELD, {
        op: 'put',
        entry: { id: 'e1', by: 'x', minutes: 1, at: 1 },
        person: ALI,
      }),
    ).toEqual({
      op: 'remove',
      entry: 'e1',
    });
  });

  it('refuses a time write a full field can’t hold, and one to a card that is gone', () => {
    const entries = Array.from({ length: TIME_ENTRIES_MAX }, (_, i) => ({
      id: `entry${String(i).padStart(3, '0')}`,
      by: SAM.id,
      minutes: 1,
      at: i,
    }));
    const full = {
      ...state,
      items: [{ ...card, fields: { [FIELD]: asValue({ people: {}, entries, running: [] }) } }],
    };
    expect(applyItemWrite(full, write({ op: 'start', timer: 'timer001' }), at(0))).toEqual({
      ok: false,
      error: 'time_full',
    });
    expect(
      applyItemWrite(
        state,
        { kind: 'time', id: 'gone', field: FIELD, op: { op: 'start', timer: 'timer001' } },
        at(0),
      ),
    ).toMatchObject({ ok: false, error: 'item_not_found' });
  });
});

describe('write checks', () => {
  it('reads a time write, refusing a bad op or field id', () => {
    expect(
      readItemWrite({
        kind: 'time',
        id: 'c',
        field: FIELD,
        op: { op: 'start', timer: 'timer001' },
      }),
    ).toEqual({
      kind: 'time',
      id: 'c',
      field: FIELD,
      op: { op: 'start', timer: 'timer001' },
    });
    expect(
      readItemWrite({ kind: 'time', id: 'c', field: FIELD, op: { op: 'x' } as never }),
    ).toEqual({
      error: 'time_invalid',
      id: 'c',
    });
    expect(
      readItemWrite({
        kind: 'time',
        id: 'c',
        field: 'bad field!',
        op: { op: 'start', timer: 'timer001' },
      }),
    ).toEqual({ error: 'time_invalid', id: 'c' });
  });

  it('takes a time write only on a Time Spent field the type offers', () => {
    const card = { type: 'work' };
    expect(timeWriteRefusal(types, card, FIELD)).toBeNull();
    expect(timeWriteRefusal(types, card, 'f-est')).toBe('time_invalid');
    expect(timeWriteRefusal(types, { type: 'other' }, FIELD)).toBe('time_invalid');
    expect(timeWriteRefusal([{ ...work, fields: ['title'] }], card, FIELD)).toBe('time_invalid');
  });

  it('refuses any other write that changes tracked time', () => {
    const before = item({ title: 'A' }, { type: 'work', id: 'card0001' });
    const timed = {
      ...before,
      fields: { ...before.fields, [FIELD]: asValue({ people: {}, entries: [], running: [] }) },
    };
    expect(timeSpentWritten(types, before, before)).toBeNull();
    expect(timeSpentWritten(types, timed, before)).toBe(FIELD);
    expect(timeSpentWritten(types, { type: 'work', fields: { [FIELD]: asValue({}) } })).toBe(FIELD);
    const patch: ItemWrite = { kind: 'patch', id: before.id, patch: { set: {} } };
    expect(writtenItemsRefusal(patch, [before], [timed], types)).toEqual({
      error: 'field_time_tracked',
      id: before.id,
      field: FIELD,
    });
    // A new card can't carry time; a card put back (a restore carries its number) can.
    const value = {
      people: {},
      entries: [{ id: 'entry001', by: SAM.id, minutes: 5, at: 1 }],
      running: [],
    };
    const create = (extra: object): ItemWrite => ({
      kind: 'create',
      creates: [
        { id: 'card0002', type: 'work', fields: { title: 'B', [FIELD]: asValue(value) }, ...extra },
      ],
    });
    expect(writtenItemsRefusal(create({}), [], [], types)).toMatchObject({
      error: 'field_time_tracked',
      field: FIELD,
    });
    expect(writtenItemsRefusal(create({ key: 4 }), [], [], types)).toBeNull();
    const read = readItemCreate({ type: 'work', key: 4, fields: { title: 'B', [FIELD]: value } });
    expect(typeof read === 'string' ? read : read.fields[FIELD]).toEqual(value);
  });

  it('refuses a time write whose card grew past its fields’ size', () => {
    const big = item({ title: 'x'.repeat(17_000) }, { type: 'work', id: 'card0001' });
    const write: ItemWrite = {
      kind: 'time',
      id: big.id,
      field: FIELD,
      op: { op: 'start', timer: 'timer001' },
    };
    expect(writtenItemsRefusal(write, [big], [big], types)).toMatchObject({ id: big.id });
    expect(writtenItemsRefusal(write, [big], [], types)).toBeNull();
    const other: ItemWrite = { ...write, field: 'f-est' };
    expect(writtenItemsRefusal(other, [big], [big], types)).toMatchObject({
      error: 'time_invalid',
    });
  });
});

describe('cost', () => {
  // A field at its most, written a hundred times over: each write reads and re-sorts the whole value.
  it('stays cheap at the most entries a field holds', () => {
    let card = item({}, { type: 'work' });
    const ms = cpuMsOf(() => {
      for (let i = 0; i < TIME_ENTRIES_MAX; i += 1)
        card = step(card, { op: 'add', entry: `entry${String(i).padStart(3, '0')}`, minutes: 5 });
      for (let i = 0; i < TIME_ENTRIES_MAX; i += 1) readTimeValue(card.fields[FIELD]);
    });
    expect(timeTotal(valueOf(card))).toBe(500);
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
