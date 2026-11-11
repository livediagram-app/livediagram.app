import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  applyIdListSteps,
  diffIdList,
  longestIncreasing,
  parseIdListSteps,
  type IdListStep,
} from './id-list-steps';
import { sameJsonValue } from './same-json-value';

type P = { id: string; v?: number };
const p = (id: string, v?: number): P => (v === undefined ? { id } : { id, v });
const ids = (list: readonly P[]) => list.map((x) => x.id);
const base = ['1', '2', '3', '4', '5'].map((id) => p(id));

// One sender's change as a receiver (or the api) sees it: its steps and its whole list.
const change = (before: P[], after: P[], gone: string[] = []) => ({
  steps: diffIdList(before, after, sameJsonValue, gone),
  list: after,
});
const apply = (local: P[], c: { steps: IdListStep[]; list: P[] }) =>
  applyIdListSteps(local, c.steps, c.list);

describe('longestIncreasing', () => {
  it('picks one longest increasing run, and nothing from nothing', () => {
    expect([...longestIncreasing([0, 3, 1, 2])].sort()).toEqual([0, 2, 3]);
    expect(longestIncreasing([]).size).toBe(0);
  });
});

describe('diffIdList', () => {
  it('names removals first, then new, moved and changed items in their new order', () => {
    const before = [p('a'), p('b', 1), p('c'), p('d')];
    const after = [p('c'), p('a'), p('b', 2), p('n')];
    expect(diffIdList(before, after, sameJsonValue)).toEqual([
      { kind: 'remove', id: 'd' },
      { kind: 'put', id: 'c', after: null, before: 'a' },
      { kind: 'put', id: 'b' },
      { kind: 'put', id: 'n', after: 'b', before: null },
    ]);
  });

  it('sends nothing for the same list, and removes what `gone` held that both lists lack', () => {
    expect(diffIdList(base, [...base], sameJsonValue)).toEqual([]);
    expect(diffIdList(base, base, sameJsonValue, ['x', '1', 'x'])).toEqual([
      { kind: 'remove', id: 'x' },
    ]);
  });
});

describe('applyIdListSteps', () => {
  it('keeps a page added here when a peer adds one at the same moment, both sides in one order (#669)', () => {
    const mine = [...base, p('A')];
    const theirs = [...base, p('B')];
    const atMine = apply(mine, change(base, theirs));
    const atTheirs = apply(theirs, change(base, mine));
    expect(ids(atMine)).toEqual(['1', '2', '3', '4', '5', 'A', 'B']);
    expect(ids(atTheirs)).toEqual(ids(atMine));
    // The other id order converges the same way.
    const x = [...base, p('Z')];
    expect(ids(apply(x, change(base, theirs)))).toEqual(ids(apply(theirs, change(base, x))));
  });

  it('keeps the local copy of an item the sender did not change, and takes the one it did', () => {
    const local = [p('a', 9), p('b', 1)];
    const sent = change([p('a', 1), p('b', 1)], [p('a', 1), p('b', 2)]);
    expect(apply(local, sent)).toEqual([p('a', 9), p('b', 2)]);
  });

  it('drops what the sender removed, and an item removed here stays removed unless the sender changed it', () => {
    const local = [p('1'), p('2'), p('4'), p('5')];
    expect(ids(apply(local, change(base, [p('1'), p('2'), p('3'), p('4')])))).toEqual([
      '1',
      '2',
      '4',
    ]);
    // `3` was removed here while the sender changed it: it comes back beside its neighbours.
    const edited = base.map((x) => (x.id === '3' ? p('3', 1) : x));
    expect(ids(apply(local, change(base, edited)))).toEqual(['1', '2', '3', '4', '5']);
  });

  it('places by `before` when `after` is gone, at the end when both are, and skips a put it has no item for', () => {
    expect(
      ids(
        applyIdListSteps(
          [p('a'), p('b')],
          [{ kind: 'put', id: 'n', after: 'x', before: 'b' }],
          [p('n')],
        ),
      ),
    ).toEqual(['a', 'n', 'b']);
    expect(
      ids(
        applyIdListSteps(
          [p('a')],
          [
            { kind: 'put', id: 'n', after: 'x', before: 'y' },
            { kind: 'put', id: 'm', after: 'x', before: null },
            { kind: 'put', id: 'q' },
            { kind: 'remove', id: 'nothing' },
          ],
          [p('n'), p('m')],
        ),
      ),
    ).toEqual(['a', 'n', 'm']);
  });

  it('moves an item it has, and brings a missing in-place item back first when it led the list', () => {
    const moved = change(base, [p('5'), p('1'), p('2'), p('3'), p('4')]);
    expect(ids(apply(base, moved))).toEqual(['5', '1', '2', '3', '4']);
    expect(
      ids(applyIdListSteps([p('b')], [{ kind: 'put', id: 'a' }], [p('a', 1), p('b')])),
    ).toEqual(['a', 'b']);
    expect(
      ids(applyIdListSteps([p('a')], [{ kind: 'put', id: 'z' }], [p('a'), p('z', 1)])),
    ).toEqual(['a', 'z']);
  });

  it('stays linear enough for every page a tab holds, many times over', () => {
    const many = Array.from({ length: 2_000 }, (_, i) => p(`p${String(i).padStart(4, '0')}`));
    const after = [...many].reverse();
    const ms = cpuMsOf(() => apply(many, change(many, after)));
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});

describe('parseIdListSteps', () => {
  it('keeps well-formed steps and drops the rest', () => {
    expect(
      parseIdListSteps(
        [
          { kind: 'put', id: 'a', after: null, before: 'b' },
          { kind: 'put', id: 'b' },
          { kind: 'remove', id: 'c' },
          { kind: 'put', id: 'd', after: 5 },
          { kind: 'move', id: 'e' },
          { kind: 'remove', id: 'x'.repeat(201) },
          null,
          'put',
        ],
        10,
      ),
    ).toEqual([
      { kind: 'put', id: 'a', after: null, before: 'b' },
      { kind: 'put', id: 'b' },
      { kind: 'remove', id: 'c' },
    ]);
  });

  it('is null for anything but a list within its bound', () => {
    expect(parseIdListSteps({}, 10)).toBeNull();
    expect(parseIdListSteps([{ kind: 'remove', id: 'a' }], 0)).toBeNull();
  });
});

describe('sameJsonValue', () => {
  it('compares plain values deeply, whatever the key order, an undefined key as absent', () => {
    expect(sameJsonValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameJsonValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJsonValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameJsonValue([1], { 0: 1 })).toBe(false);
    expect(sameJsonValue([1, 2], [1])).toBe(false);
    expect(sameJsonValue(null, {})).toBe(false);
  });
});
