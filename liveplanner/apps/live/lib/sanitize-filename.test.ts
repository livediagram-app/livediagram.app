import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './sanitize-filename';

describe('sanitizeFilename', () => {
  it('turns path and reserved characters into single dashes', () => {
    expect(sanitizeFilename('a/b:c')).toBe('a-b-c');
    expect(sanitizeFilename('  Plan // Q3  ')).toBe('Plan - Q3');
  });
});
