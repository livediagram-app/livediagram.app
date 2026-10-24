import { describe, expect, it } from 'vitest';
import { plural, pluralGrouped, pluralWord } from './plural';

describe('plural', () => {
  it('uses the singular for exactly one', () => {
    expect(plural(1, 'tab')).toBe('1 tab');
    expect(plural(0, 'tab')).toBe('0 tabs');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });

  it('picks only the word with pluralWord', () => {
    expect(pluralWord(1, 'like', 'likes')).toBe('like');
    expect(pluralWord(3, 'like')).toBe('likes');
  });

  it('groups the digits with pluralGrouped', () => {
    expect(pluralGrouped(1250, 'shape')).toBe('1,250 shapes');
    expect(pluralGrouped(1, 'page', 'pages')).toBe('1 page');
  });
});
