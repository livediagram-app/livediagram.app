import { describe, expect, it } from 'vitest';
import { fnv1a32 } from './fnv1a';

describe('fnv1a32', () => {
  it('matches the published FNV-1a 32-bit vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });
});
