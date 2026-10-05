import { describe, expect, it } from 'vitest';
import type { UserPreferences } from './user-preferences';
import { readElementIndicatorStyle, withElementIndicatorStyle } from './element-indicator-style';

describe('element indicator style', () => {
  it('is Corner unless Footer was chosen', () => {
    expect(readElementIndicatorStyle({})).toBe('corner');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'corner' })).toBe('corner');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'footer' })).toBe('footer');
    const junk = { elementIndicatorStyle: 'sideways' } as unknown as UserPreferences;
    expect(readElementIndicatorStyle(junk)).toBe('corner');
  });

  it('writes the choice without touching other preferences', () => {
    expect(withElementIndicatorStyle({ mapSize: 'tall' }, 'footer')).toEqual({
      mapSize: 'tall',
      elementIndicatorStyle: 'footer',
    });
  });
});
