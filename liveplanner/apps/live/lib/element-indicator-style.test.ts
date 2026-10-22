import { describe, expect, it } from 'vitest';
import type { UserPreferences } from './user-preferences';
import { readElementIndicatorStyle } from './element-indicator-style';

describe('element indicator style', () => {
  it('is Top unless Footer or Off was chosen', () => {
    expect(readElementIndicatorStyle({})).toBe('top');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'top' })).toBe('top');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'footer' })).toBe('footer');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'off' })).toBe('off');
    const junk = { elementIndicatorStyle: 'sideways' } as unknown as UserPreferences;
    expect(readElementIndicatorStyle(junk)).toBe('top');
  });
});
