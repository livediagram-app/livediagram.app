import { describe, expect, it } from 'vitest';
import {
  cardSpan,
  clashText,
  clashesOf,
  followingShifts,
  ganttClashDays,
} from './dependency-clash';
import { blockingIndexOf } from './blocked-by';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { itemStatus, type Item, type ItemFields } from './item';
import { dayKey, dayNumber } from './plan-view-dates';
import { item } from './test-items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

// docs/specs/026-plan/plan-views.md "Dependency clashes" and "Moving the cards that follow".

const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, 'f-blocked-by'],
  custom: [
    ...(BASE.custom ?? []),
    {
      id: 'f-blocked-by',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
  ],
};
const isDoneStatus = (s: string | undefined) => s === 'done';
const isDone = (i: Item) => isDoneStatus(itemStatus(i));
const D0 = dayNumber('2026-03-02')!;
const day = (n: number) => dayKey(D0 + n);
// A card from day `a` to day `b`, blocked by `by`.
const card = (title: string, a?: number, b?: number, by: Item[] = [], more: ItemFields = {}) =>
  item({
    title,
    status: 'todo',
    ...(a !== undefined ? { start: day(a) } : {}),
    ...(b !== undefined ? { due: day(b) } : {}),
    ...(by.length ? { 'f-blocked-by': by.map((x) => x.id) } : {}),
    ...more,
  });
const indexOf = (items: Item[]) => blockingIndexOf(items, [TASK], isDoneStatus);
const shifted = (items: Item[], seeds: Item[], opts = {}) =>
  followingShifts(
    indexOf(items),
    isDone,
    seeds.map((s) => s.id),
    opts,
  ).map((s) => [itemTitleOf(s.item), s.days, s.set['start'], s.set['due']]);
const itemTitleOf = (i: Item) => i.fields['title'];

describe('a card’s days', () => {
  it('runs from its start to its due, either alone as one day, the earlier first', () => {
    expect(cardSpan(card('x', 0, 4))).toEqual({ from: D0, to: D0 + 4 });
    expect(cardSpan(card('x', undefined, 4))).toEqual({ from: D0 + 4, to: D0 + 4 });
    expect(cardSpan(card('x', 2))).toEqual({ from: D0 + 2, to: D0 + 2 });
    expect(cardSpan(card('x', 5, 1))).toEqual({ from: D0 + 1, to: D0 + 5 });
    expect(cardSpan(card('x'))).toBeUndefined();
  });
});

describe('dependency clashes', () => {
  it('clashes when the blocked mark starts on or before the blocker ends, never when either is done', () => {
    const open = { from: 0, to: 9, isDone: false };
    expect(ganttClashDays(open, { from: 7, to: 12, isDone: false })).toBe(2);
    expect(ganttClashDays(open, { from: 9, to: 12, isDone: false })).toBe(0);
    expect(ganttClashDays(open, { from: 10, to: 12, isDone: false })).toBeNull();
    expect(ganttClashDays({ ...open, isDone: true }, { from: 7, isDone: false })).toBeNull();
    expect(ganttClashDays(open, { from: 7, isDone: true })).toBeNull();
    expect(ganttClashDays({ isDone: false }, { from: 7, isDone: false })).toBeNull();
    expect(ganttClashDays(open, { isDone: false })).toBeNull();
  });

  it('says how far before the blocker is due the card starts', () => {
    const design = card('Design', 0, 3);
    expect(clashText(3, design)).toBe(`Starts 3 days before #${design.key} Design is due`);
    expect(clashText(1, design)).toBe(`Starts 1 day before #${design.key} Design is due`);
    expect(clashText(0, design)).toBe(`Starts the day #${design.key} Design is due`);
    expect(clashText(2, card('  ', 0, 1))).toMatch(/#\d+ Untitled is due$/);
  });

  it('lists a card’s clashes with its open blockers, worst first', () => {
    const a = card('A', 0, 5);
    const b = card('B', 0, 8);
    const done = card('Done', 0, 20, [], { status: 'done' });
    const later = card('Later', 0, 1);
    const undated = card('Undated');
    const c = card('C', 3, 10, [a, b, done, later, undated]);
    const index = indexOf([a, b, done, later, undated, c]);
    expect(clashesOf(c, index, isDone).map((x) => [x.blocker.fields['title'], x.days])).toEqual([
      ['B', 5],
      ['A', 2],
    ]);
    expect(clashesOf(a, index, isDone)).toEqual([]);
    expect(clashesOf({ ...c, fields: { ...c.fields, status: 'done' } }, index, isDone)).toEqual([]);
    const noDates = card('No Dates', undefined, undefined, [a]);
    expect(clashesOf(noDates, indexOf([a, noDates]), isDone)).toEqual([]);
  });
});

describe('moving the cards that follow', () => {
  it('moves a clashing card just after its blocker, keeping its length', () => {
    const design = card('Design', 0, 9);
    const build = card('Build', 5, 7, [design]);
    expect(shifted([design, build], [design])).toEqual([['Build', 5, day(10), day(12)]]);
  });

  it('walks every chain, each card after its latest open blocker, never earlier', () => {
    const a = card('A', 0, 9);
    const b = card('B', 2, 4, [a]);
    const c = card('C', 6, 8, [b]);
    // D waits on A and C: it lands after C's new end.
    const d = card('D', 5, 5, [a, c]);
    // E is already well after: it stays.
    const e = card('E', 40, 41, [b]);
    expect(shifted([a, b, c, d, e], [a])).toEqual([
      ['B', 8, day(10), day(12)],
      ['C', 7, day(13), day(15)],
      ['D', 11, day(16), day(16)],
    ]);
  });

  it('leaves done cards, the moved card and cards this person may not change, which still count', () => {
    const a = card('A', 0, 9);
    const done = card('Done', 1, 2, [a], { status: 'done' });
    const locked = card('Locked', 3, 4, [a]);
    const after = card('After', 5, 6, [locked]);
    const items = [a, done, locked, after];
    // Locked stays at days 3-4, so After (5-6) does not clash with it.
    expect(shifted(items, [a], { mayMove: (i: Item) => i.id !== locked.id })).toEqual([]);
    // Moving it pushes After along too.
    expect(shifted(items, [a])).toEqual([
      ['Locked', 7, day(10), day(11)],
      ['After', 7, day(12), day(13)],
    ]);
    // Both seeds: neither moves.
    expect(shifted([a, locked], [a, locked])).toEqual([]);
  });

  it('moves a lone date, and a card with no dates or nothing reachable not at all', () => {
    const a = card('A', 0, 9);
    const milestone = card('Milestone', undefined, 3, [a]);
    const kickoff = card('Kickoff', 2, undefined, [a]);
    const empty = card('Empty', undefined, undefined, [a]);
    expect(shifted([a, milestone, kickoff, empty], [a])).toEqual([
      ['Milestone', 7, undefined, day(10)],
      ['Kickoff', 8, day(10), undefined],
    ]);
    expect(shifted([a], [a])).toEqual([]);
  });

  it('never takes a card in a loop (links stored before loops were refused)', () => {
    const a = card('A', 0, 9);
    // B and C wait on each other, and B on A: neither is ever free to settle.
    const b0 = card('B', 1, 2);
    const c = card('C', 1, 2, [b0]);
    const b = { ...b0, fields: { ...b0.fields, 'f-blocked-by': [a.id, c.id] } };
    const free = card('Free', 1, 2, [a]);
    expect(shifted([a, b, c, free], [a])).toEqual([['Free', 9, day(10), day(11)]]);
  });

  it('stays linear in cards and links on a long chain', () => {
    const chain: Item[] = [card('C0', 0, 9)];
    for (let i = 1; i < 2000; i++) chain.push(card(`C${i}`, 0, 0, [chain[i - 1]!]));
    const index = indexOf(chain);
    const ms = cpuMsOf(() => {
      expect(followingShifts(index, isDone, [chain[0]!.id])).toHaveLength(1999);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
