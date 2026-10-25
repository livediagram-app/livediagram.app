import { describe, expect, it } from 'vitest';
import { sameValue } from './equality';

describe('sameValue', () => {
  it('ignores key order, at any depth', () => {
    expect(sameValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(sameValue([{ x: 1, y: 2 }], [{ y: 2, x: 1 }])).toBe(true);
  });

  it('tells different values apart, array order included', () => {
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue(null, {})).toBe(false);
    expect(sameValue('a', 'a')).toBe(true);
  });
});
