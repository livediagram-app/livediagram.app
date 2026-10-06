import { describe, expect, it } from 'vitest';
import { compareRank, isValidRank, rankAfter, rankBefore, rankBetween } from './rank';

describe('rankBetween', () => {
  it('starts at the middle and opens either end', () => {
    expect(rankBetween(null, null)).toBe('i');
    expect(compareRank(rankAfter('i'), 'i')).toBe(1);
    expect(compareRank(rankBefore('i'), 'i')).toBe(-1);
  });

  it('extends a digit between adjacent keys', () => {
    const r = rankBetween('i', 'j');
    expect(r > 'i' && r < 'j').toBe(true);
  });

  it('refuses an inverted pair', () => {
    expect(() => rankBetween('j', 'i')).toThrow(RangeError);
    expect(() => rankBetween('i', 'i')).toThrow(RangeError);
  });

  it('always finds a valid key strictly between, over many random inserts', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const keys: string[] = [rankBetween(null, null)];
    for (let i = 0; i < 1000; i++) {
      const at = Math.floor(rand() * (keys.length + 1));
      const k = rankBetween(keys[at - 1] ?? null, keys[at] ?? null);
      expect(isValidRank(k)).toBe(true);
      if (at > 0) expect(k > keys[at - 1]!).toBe(true);
      if (at < keys.length) expect(k < keys[at]!).toBe(true);
      keys.splice(at, 0, k);
    }
    expect([...keys].sort()).toEqual(keys);
  });

  it('keeps inserting at the front and the back', () => {
    let lo = 'i';
    let hi = 'i';
    for (let i = 0; i < 200; i++) {
      const a = rankBefore(lo);
      expect(a < lo).toBe(true);
      lo = a;
      const b = rankAfter(hi);
      expect(b > hi).toBe(true);
      hi = b;
    }
  });

  it('validates ranks', () => {
    expect(isValidRank('i')).toBe(true);
    expect(isValidRank('i0')).toBe(false);
    expect(isValidRank('I')).toBe(false);
    expect(isValidRank(3)).toBe(false);
  });
});
