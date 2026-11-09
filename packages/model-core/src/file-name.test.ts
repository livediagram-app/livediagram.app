import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './file-name';

describe('sanitizeFilename', () => {
  it('drops brackets and turns unsafe characters into single dashes', () => {
    expect(sanitizeFilename('Board - Plan (v2)?', 'document')).toBe('Board - Plan v2');
    expect(sanitizeFilename('a/b:c', 'document')).toBe('a-b-c');
    expect(sanitizeFilename('Roadmap [Q3]: draft', 'document')).toBe('Roadmap Q3- draft');
    expect(sanitizeFilename('Poster (9:16)', 'page')).toBe('Poster 9-16');
    expect(sanitizeFilename('Logo (1080×1080)', 'page')).toBe('Logo 1080-1080');
    expect(sanitizeFilename('a---b', 'document')).toBe('a-b');
    expect(sanitizeFilename('a    b', 'document')).toBe('a b');
    expect(sanitizeFilename('a\tb\nc', 'document')).toBe('a-b-c');
    expect(sanitizeFilename('snake_case.v1', 'document')).toBe('snake_case.v1');
  });

  it('keeps letters and digits in any script, with their combining marks', () => {
    expect(sanitizeFilename('会議 - メモ', 'document')).toBe('会議 - メモ');
    expect(sanitizeFilename('План - Доска', 'document')).toBe('План - Доска');
    expect(sanitizeFilename('مخطط ١٢', 'document')).toBe('مخطط ١٢');
    expect(sanitizeFilename('Café', 'document')).toBe('Café');
    expect(sanitizeFilename('हिन्दी', 'document')).toBe('हिन्दी');
  });

  it('trims dashes and spaces at the ends and falls back when nothing safe is left', () => {
    expect(sanitizeFilename('? - Board', 'document')).toBe('Board');
    expect(sanitizeFilename(' -Board- ', 'document')).toBe('Board');
    expect(sanitizeFilename('?', 'design')).toBe('design');
    expect(sanitizeFilename('', 'page')).toBe('page');
    expect(sanitizeFilename('🎉 - ✨', 'document')).toBe('document');
  });

  it('stays linear on a long hostile name', () => {
    const ends = `${'(-? '.repeat(25_000)}x${' -?'.repeat(25_000)}`;
    const middle = `x${' -?'.repeat(25_000)}x`;
    const start = performance.now();
    expect(sanitizeFilename(ends, 'document')).toBe('x');
    expect(sanitizeFilename(middle, 'document')).toBe(`x${' -'.repeat(25_000)}x`);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
