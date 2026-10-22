import { describe, expect, it } from 'vitest';
import { fnv1aString } from './string-hash';

describe('fnv1aString', () => {
  it('matches the published FNV-1a 32-bit vectors', () => {
    expect(fnv1aString('')).toBe(0x811c9dc5);
    expect(fnv1aString('a')).toBe(0xe40c292c);
    expect(fnv1aString('foobar')).toBe(0xbf9cf968);
  });
});
