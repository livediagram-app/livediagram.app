import { describe, expect, it } from 'vitest';
import { isRecord } from './is-record';

describe('isRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('refuses arrays, null and primitives', () => {
    for (const v of [[], null, undefined, 0, '', 'x', true, 1n]) expect(isRecord(v)).toBe(false);
  });
});
