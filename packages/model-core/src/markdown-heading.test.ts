import { describe, expect, it } from 'vitest';
import { atxHeadingText } from './markdown-heading';

describe('atxHeadingText', () => {
  it('drops a closing # sequence after a space, and the spaces around it', () => {
    expect(atxHeadingText('Section ##')).toBe('Section');
    expect(atxHeadingText('Section\t#  ')).toBe('Section');
    expect(atxHeadingText('  Section  ')).toBe('Section');
    expect(atxHeadingText('#')).toBe('');
    expect(atxHeadingText('### ')).toBe('');
    expect(atxHeadingText('')).toBe('');
  });

  it('keeps a # that ends a word and a run that is not at the end', () => {
    expect(atxHeadingText('C#')).toBe('C#');
    expect(atxHeadingText('Issue #12')).toBe('Issue #12');
    expect(atxHeadingText('a ## b')).toBe('a ## b');
    expect(atxHeadingText('C# ##')).toBe('C#');
  });

  it('stays linear on a long run of spaces', () => {
    const start = performance.now();
    expect(atxHeadingText(`a${' '.repeat(200_000)}b`)).toBe(`a${' '.repeat(200_000)}b`);
    expect(atxHeadingText(`a${' #'.repeat(100_000)}`)).toBe(`a${' #'.repeat(99_999)}`);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
