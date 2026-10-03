import { describe, expect, it } from 'vitest';
import { utcDay, withinReach, type WithinReachUse } from './within-reach';

type Item = { id: string } & WithinReachUse;
const item = (id: string, uses: number, lastUsedAt: number): Item => ({ id, uses, lastUsedAt });
const useOf = (i: Item) => i;
const ids = (items: Item[]) => items.map((i) => i.id);

describe('withinReach', () => {
  it('takes the most used first, ties going to the most recently used', () => {
    const set = withinReach(
      [item('a', 2, 10), item('b', 5, 1), item('c', 2, 30), item('d', 1, 99)],
      3,
      useOf,
    );
    expect(ids(set.mostUsed)).toEqual(['b', 'c', 'a']);
  });

  it('fills recent newest first from the items not among the most used', () => {
    const set = withinReach(
      [item('a', 9, 50), item('b', 8, 40), item('c', 1, 30), item('d', 1, 60), item('e', 0, 70)],
      2,
      useOf,
    );
    expect(ids(set.mostUsed)).toEqual(['a', 'b']);
    expect(ids(set.recent)).toEqual(['e', 'd']);
  });

  it('shows an item that is both most used and recent once, under most used', () => {
    const set = withinReach([item('a', 9, 100), item('b', 1, 50), item('c', 1, 40)], 1, useOf);
    expect(ids(set.mostUsed)).toEqual(['a']);
    expect(ids(set.recent)).toEqual(['b']);
  });

  it('never counts an unused item as most used, but lets it be recent', () => {
    const set = withinReach([item('a', 0, 100), item('b', 0, 50)], 4, useOf);
    expect(set.mostUsed).toEqual([]);
    expect(ids(set.recent)).toEqual(['a', 'b']);
  });

  it('leaves short groups short', () => {
    const set = withinReach([item('a', 3, 1), item('b', 2, 2), item('c', 1, 3)], 2, useOf);
    expect(ids(set.mostUsed)).toEqual(['a', 'b']);
    expect(ids(set.recent)).toEqual(['c']);
    expect(withinReach([], 4, useOf)).toEqual({ mostUsed: [], recent: [] });
  });

  it('keeps the given order for items equal on every measure', () => {
    const set = withinReach([item('x', 2, 5), item('y', 2, 5), item('z', 0, 5)], 2, useOf);
    expect(ids(set.mostUsed)).toEqual(['x', 'y']);
    const recent = withinReach([item('p', 0, 5), item('q', 0, 5)], 2, useOf);
    expect(ids(recent.recent)).toEqual(['p', 'q']);
  });

  it('returns nothing for a count of zero or less', () => {
    expect(withinReach([item('a', 3, 3)], 0, useOf)).toEqual({ mostUsed: [], recent: [] });
    expect(withinReach([item('a', 3, 3)], -1, useOf)).toEqual({ mostUsed: [], recent: [] });
  });

  it('merges: the set of two lists is the set of their two sets', () => {
    // A deterministic spread of uses and times, two lists sorted by id as callers sort them.
    const make = (prefix: string, seed: number) =>
      Array.from({ length: 15 }, (_, i) =>
        item(`${prefix}${String(i).padStart(2, '0')}`, (i * seed) % 6, ((i * 7 + seed) % 11) * 10),
      );
    const byId = (a: Item, b: Item) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const flat = (s: { mostUsed: Item[]; recent: Item[] }) => [...s.mostUsed, ...s.recent];
    for (const n of [1, 2, 4]) {
      const a = make('a', 5);
      const b = make('b', 3);
      const whole = withinReach([...a, ...b].sort(byId), n, useOf);
      const parts = withinReach(
        [...flat(withinReach(a, n, useOf)), ...flat(withinReach(b, n, useOf))].sort(byId),
        n,
        useOf,
      );
      expect(parts).toEqual(whole);
    }
  });
});

describe('utcDay', () => {
  it('names the UTC calendar day of an instant', () => {
    expect(utcDay(Date.UTC(2026, 9, 2, 23, 59))).toBe('2026-10-02');
    expect(utcDay(Date.UTC(2026, 9, 3, 0, 0))).toBe('2026-10-03');
  });
});
