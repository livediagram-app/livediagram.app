import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { keepUnchangedElements, sameElementValue } from './keep-unchanged-elements';

// docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board keeps the page answering".

describe('sameElementValue', () => {
  it('compares plain data by value, a key set to undefined as a key left out', () => {
    expect(sameElementValue({ a: 1, b: [1, { c: 'x' }] }, { a: 1, b: [1, { c: 'x' }] })).toBe(true);
    expect(sameElementValue({ a: 1 }, { a: 1, fill: undefined })).toBe(true);
    expect(sameElementValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameElementValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameElementValue({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    expect(sameElementValue([1, 2], [1, 2, 3])).toBe(false);
    expect(sameElementValue([1], { 0: 1 })).toBe(false);
    expect(sameElementValue({ 0: 1 }, [1])).toBe(false);
    expect(sameElementValue(null, {})).toBe(false);
    expect(sameElementValue('a', 'b')).toBe(false);
    expect(sameElementValue(Number.NaN, Number.NaN)).toBe(true);
    expect(sameElementValue(Object.create(null) as object, {})).toBe(true);
  });

  it('never calls two class instances the same unless they are one object', () => {
    const d = new Date(0);
    expect(sameElementValue(d, new Date(0))).toBe(false);
    expect(sameElementValue({ at: d }, { at: d })).toBe(true);
  });
});

describe('keepUnchangedElements', () => {
  const a = { id: 'a', fill: '#fff' };
  const b = { id: 'b', fill: '#000', label: { text: 'B' } };

  it('hands back an unchanged element as it was, and a changed one as restyled', () => {
    const next = [
      { id: 'a', fill: '#fff' },
      { id: 'b', fill: '#111', label: { text: 'B' } },
    ];
    const out = keepUnchangedElements([a, b], next);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(next[1]);
  });

  it('hands back the list itself when nothing changed', () => {
    const before = [a, b];
    expect(keepUnchangedElements(before, [{ ...a }, { ...b, label: { text: 'B' } }])).toBe(before);
  });

  it('hands back the restyled list itself when it kept no element', () => {
    const next = [{ id: 'a', fill: '#000' }, b];
    expect(keepUnchangedElements([a, b], next)).toBe(next);
    expect(keepUnchangedElements([], next)).toBe(next);
  });

  it('keeps a new element and the new order', () => {
    const c = { id: 'c', fill: '#f00' };
    const out = keepUnchangedElements([a, b], [{ ...b }, { ...a }]);
    expect(out[0]).toBe(b);
    expect(out[1]).toBe(a);
    const added = keepUnchangedElements([a], [{ ...a }, c]);
    expect(added).toEqual([a, c]);
    expect(added[0]).toBe(a);
    expect(keepUnchangedElements([a, b], [{ ...a }])).toEqual([a]);
  });

  it('stays linear on a full board', () => {
    const before = Array.from({ length: 2000 }, (_, i) => ({
      id: `e${i}`,
      fill: '#fff',
      label: { text: 'x'.repeat(200) },
      points: [1, 2, 3, 4],
    }));
    const after = before.map((el) => ({ ...el, label: { ...el.label } }));
    let out: typeof before = [];
    const ms = cpuMsOf(() => {
      out = keepUnchangedElements(before, after);
    });
    expect(out).toBe(before);
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
