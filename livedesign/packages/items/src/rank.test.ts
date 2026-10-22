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

  // A column appended to (or prepended to) thousands of times keeps short keys: halving the open gap grew a
  // digit every five or six appends (2000 appends reached 334 digits, past isValidRank's 64).
  it('keeps keys short over many appends and prepends', () => {
    let hi = rankBetween(null, null);
    let lo = hi;
    for (let i = 0; i < 2000; i++) {
      const up = rankAfter(hi);
      const down = rankBefore(lo);
      expect(up > hi && isValidRank(up)).toBe(true);
      expect(down < lo && isValidRank(down)).toBe(true);
      hi = up;
      lo = down;
    }
    expect(hi.length).toBeLessThanOrEqual(8);
    expect(lo.length).toBeLessThanOrEqual(8);
  });

  it('steps an open end at the key’s own width, doubling it once the width is used up', () => {
    expect(rankAfter('i')).toBe('j');
    expect(rankAfter('z')).toBe('z1');
    expect(rankAfter('z1z')).toBe('z21');
    expect(rankAfter('zz')).toBe('zz01');
    expect(rankBefore('i')).toBe('h');
    expect(rankBefore('1')).toBe('0z');
    expect(rankBefore('h1')).toBe('gz');
    expect(rankBefore('01')).toBe('00zz');
  });

  it('still fits keys between the stepped ones', () => {
    const keys = ['z', rankAfter('z'), rankAfter(rankAfter('z'))];
    const mid = rankBetween(keys[1]!, keys[2]!);
    expect(mid > keys[1]! && mid < keys[2]!).toBe(true);
    expect(isValidRank(mid)).toBe(true);
  });

  it('validates ranks', () => {
    expect(isValidRank('i')).toBe(true);
    expect(isValidRank('i0')).toBe(false);
    expect(isValidRank('I')).toBe(false);
    expect(isValidRank(3)).toBe(false);
  });
});
