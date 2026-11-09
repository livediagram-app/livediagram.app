import { describe, expect, it } from 'vitest';
import { cutText } from './text-cut';

describe('cutText', () => {
  it('cuts at the cap, one short where the cap falls inside an emoji', () => {
    expect(cutText('abcdef', 4)).toBe('abcd');
    expect(cutText('abc', 4)).toBe('abc');
    // '😀' is two UTF-16 units: a cap of 4 lands between them.
    expect(cutText('abc😀', 4)).toBe('abc');
    expect(cutText('abc😀', 5)).toBe('abc😀');
    expect(cutText('😀😀', 1)).toBe('');
    expect(cutText('abc', 0)).toBe('');
  });
});
