import { describe, expect, it } from 'vitest';
import { REF_MIN_PREFIX, shortestUniquePrefixes } from './refs';

describe('shortestUniquePrefixes', () => {
  it('gives each id the shortest prefix no neighbour shares, at least four characters', () => {
    const refs = shortestUniquePrefixes(['abcdef12', 'abcdzz', 'ffff0000', 'abcdef99']);
    expect(refs.get('abcdef12')).toBe('abcdef1');
    expect(refs.get('abcdef99')).toBe('abcdef9');
    expect(refs.get('abcdzz')).toBe('abcdz');
    expect(refs.get('ffff0000')).toHaveLength(REF_MIN_PREFIX);
  });

  it('handles one id and none', () => {
    expect(shortestUniquePrefixes(['x1234567']).get('x1234567')).toBe('x123');
    expect(shortestUniquePrefixes([]).size).toBe(0);
  });
});
