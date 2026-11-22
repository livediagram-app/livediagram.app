import { describe, expect, it } from 'vitest';
import { stableHash } from './hash';

describe('stableHash', () => {
  it('answers the same 16 hex characters for the same parts', () => {
    expect(stableHash('tab-1', 'Deploys', '0')).toBe(stableHash('tab-1', 'Deploys', '0'));
    expect(stableHash('tab-1', 'Deploys', '0')).toMatch(/^[0-9a-f]{16}$/);
    expect(stableHash()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('tells parts apart, and where one ends', () => {
    const seen = new Set([
      stableHash('ab', 'c'),
      stableHash('a', 'bc'),
      stableHash('abc'),
      stableHash('abc', ''),
      stableHash('', 'abc'),
      stableHash('abd'),
    ]);
    expect(seen.size).toBe(6);
  });
});
