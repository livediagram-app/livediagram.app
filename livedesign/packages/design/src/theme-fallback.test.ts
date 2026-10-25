import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEME_ID, getBuiltInTheme } from './themes';
import { isValidTab } from './validate';

// Only built-in themes exist (docs/specs/011-theme/README.md). A tab may still store an id that names none of them
// (a saved-theme id from before, a retired theme): it stays a valid tab and paints in the default theme.
describe('a stored theme id that names no built-in theme', () => {
  const tab = { id: 't', name: 'T', theme: 'custom:0b7c5f9e-1111', elements: [] };

  it('leaves the tab valid', () => {
    expect(isValidTab(tab)).toBe(true);
  });

  it('resolves to the default theme in either appearance', () => {
    for (const appearance of ['light', 'dark'] as const) {
      expect(getBuiltInTheme(tab.theme, appearance)).toEqual(
        getBuiltInTheme(DEFAULT_SCHEME_ID, appearance),
      );
    }
  });
});
