import { describe, expect, it } from 'vitest';
import { themeDescription } from './themes-taxonomy';

describe('themeDescription', () => {
  it('gives a built-in theme its blurb, and nothing for a retired, unknown or custom id', () => {
    expect(themeDescription('brand')).toBe('Light or dark, following your appearance.');
    expect(themeDescription('uml')).toBeUndefined();
    expect(themeDescription('custom:1')).toBeUndefined();
  });
});
