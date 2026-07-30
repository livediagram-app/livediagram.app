import { describe, expect, it } from 'vitest';
import { randomIndex, randomPick, randomUnit } from './random';

describe('randomUnit', () => {
  it('stays inside the Math.random contract, [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const value = randomUnit();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('actually varies (a constant would silently break every caller)', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomUnit()));
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('randomIndex', () => {
  it('only ever returns an index that exists', () => {
    for (let i = 0; i < 200; i++) {
      const index = randomIndex(3);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it('reaches every slot, so a catalogue entry is never unreachable', () => {
    const seen = new Set(Array.from({ length: 300 }, () => randomIndex(4)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('reports "no choice" for an empty or nonsense length', () => {
    expect(randomIndex(0)).toBe(-1);
    expect(randomIndex(-2)).toBe(-1);
    expect(randomIndex(Number.NaN)).toBe(-1);
  });
});

describe('randomPick', () => {
  it('returns one of the options', () => {
    const options = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) expect(options).toContain(randomPick(options));
  });

  it('returns undefined for an empty list rather than throwing', () => {
    expect(randomPick([])).toBeUndefined();
  });
});
