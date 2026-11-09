import { describe, expect, it } from 'vitest';
import { cutSlug, slugText, uniqueSlug } from './slug';

describe('slug ids', () => {
  it('folds a name to lowercase letters and digits joined by single hyphens', () => {
    expect(slugText('  Café  Visit! ')).toBe('cafe-visit');
    expect(slugText('Résumé')).toBe('resume');
    expect(slugText('!!!')).toBe('');
  });

  it('cuts without leaving a hyphen at the cut', () => {
    expect(cutSlug('ab-cd', 3)).toBe('ab');
    expect(cutSlug('abcd', 10)).toBe('abcd');
  });

  it('suffixes a clash with the first free number, within the length', () => {
    expect(uniqueSlug('task', new Set(), 32)).toBe('task');
    expect(uniqueSlug('task', new Set(['task', 'task-2']), 32)).toBe('task-3');
    expect(uniqueSlug('abc-defg', new Set(['abc-defg']), 6)).toBe('abc-2');
  });
});
