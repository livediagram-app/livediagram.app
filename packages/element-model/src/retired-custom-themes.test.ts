import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import { dropCustomTheme, isRetiredCustomThemeId } from './retired-custom-themes';
import { DEFAULT_SCHEME_ID } from './themes';

// Custom themes are retired: a tab still on one moves onto Default.
describe('isRetiredCustomThemeId', () => {
  it('names a custom theme id, and nothing else', () => {
    expect(isRetiredCustomThemeId('custom:1234')).toBe(true);
    expect(isRetiredCustomThemeId('brand')).toBe(false);
    expect(isRetiredCustomThemeId(undefined)).toBe(false);
    expect(isRetiredCustomThemeId(7)).toBe(false);
  });
});

describe('dropCustomTheme', () => {
  it('moves a tab off a custom theme onto Default, dropping its backdrop opacity', () => {
    const tab = {
      id: 't',
      theme: 'custom:abc',
      backgroundColor: '#123456',
      patternColor: '#654321',
      backgroundOpacity: 0.4,
    };
    expect(dropCustomTheme(tab)).toEqual({
      id: 't',
      theme: DEFAULT_SCHEME_ID,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      patternColor: DEFAULT_PATTERN_COLOR,
      backgroundPattern: 'grid',
    });
  });

  it('hands back the same tab when it is not on a custom theme', () => {
    const tab = { theme: 'brand', backgroundColor: '#fff' };
    expect(dropCustomTheme(tab)).toBe(tab);
  });
});
