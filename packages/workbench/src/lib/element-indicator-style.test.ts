import { describe, expect, it } from 'vitest';
import { readElementIndicatorStyle, withElementIndicatorStyle } from './element-indicator-style';

describe('element indicator style', () => {
  it('is Top unless Footer or Off was chosen', () => {
    expect(readElementIndicatorStyle({})).toBe('top');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'top' })).toBe('top');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'footer' })).toBe('footer');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'off' })).toBe('off');
    expect(readElementIndicatorStyle({ elementIndicatorStyle: 'sideways' })).toBe('top');
  });

  it('writes the choice without touching other preferences', () => {
    const prefs: { mapSize: string; elementIndicatorStyle?: string } = { mapSize: 'tall' };
    expect(withElementIndicatorStyle(prefs, 'footer')).toEqual({
      mapSize: 'tall',
      elementIndicatorStyle: 'footer',
    });
  });
});
