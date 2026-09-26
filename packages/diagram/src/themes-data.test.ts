import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST } from './colors';
import { THEMES } from './themes-data';

// docs/specs/011-theme/multicolour-themes.md: every palette entry and rootColor of a
// built-in theme keeps its text readable on its fill (WCAG 2.2 AA, normal text).
describe('built-in multi-colour themes', () => {
  const paletteThemes = THEMES.filter((t) => t.palette);

  it('are all found (guard against the check going blind)', () => {
    expect(paletteThemes.map((t) => t.id)).toEqual([
      'rainbow',
      'pastel',
      'tropical',
      'autumn',
      'jewel',
    ]);
  });

  for (const theme of paletteThemes) {
    const entries = [...theme.palette!, ...(theme.rootColor ? [theme.rootColor] : [])];
    it(`${theme.id} keeps every text at ${MIN_TEXT_CONTRAST}:1 or better on its fill`, () => {
      const failing = entries.filter((e) => !(contrastRatio(e.text, e.fill) >= MIN_TEXT_CONTRAST));
      expect(failing).toEqual([]);
    });
  }
});
