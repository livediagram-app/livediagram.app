import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST } from './colour-math';
import { hexOklch } from './pen-colours';
import { BOARD_THEMES, THEMES } from './themes-data';
import { themeHalf } from './theme-halves';

// docs/specs/011-theme/multicolour-themes.md: every palette entry and rootColor of a
// built-in theme keeps its text readable on its fill (WCAG 2.2 AA, normal text).
describe('built-in multi-colour themes', () => {
  const paletteThemes = [...THEMES, ...BOARD_THEMES].filter((t) => t.palette);

  it('are all found (guard against the check going blind)', () => {
    expect(paletteThemes.map((t) => t.id)).toEqual([
      'rainbow',
      'pastel',
      'tropical',
      'spring',
      'pumpkin',
      'yuletide',
      'office',
      'earth',
      'gemstone',
      'harbour',
      'sorbet',
      'nightfall',
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

// The board themes (liveplanner docs/specs/011-theme/multicolour-themes.md "Board themes"): kept out of the shared
// catalogue, every one a multi-colour theme with a neutral trunk, and resolved by the engine like any built-in.
describe('board themes', () => {
  it('are multi-colour, never in THEMES, and each id is unique', () => {
    const ids = BOARD_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of BOARD_THEMES) {
      expect(t.palette!.length, t.id).toBeGreaterThanOrEqual(5);
      expect(t.rootColor, t.id).toBeTruthy();
      expect(THEMES.some((s) => s.id === t.id), t.id).toBe(false);
    }
  });

  // A dark half moves every outline to one lightness (docs/specs/011-theme/light-and-dark.md), so neighbouring columns
  // must differ by hue, not by how deep they are: any two colours chromatic enough to name sit 25 degrees apart.
  it('give neighbouring columns hues apart, in both halves', () => {
    const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    for (const t of BOARD_THEMES)
      for (const appearance of ['light', 'dark'] as const) {
        const strokes = themeHalf(t, appearance).palette!.map((p) => hexOklch(p.stroke)!);
        strokes.forEach((a, i) =>
          strokes.slice(i + 1).forEach((b, j) => {
            if (a.c < 0.06 || b.c < 0.06) return;
            expect(gap(a.h, b.h), `${t.id} ${appearance} ${i}|${i + j + 1}`).toBeGreaterThanOrEqual(25);
          }),
        );
      }
  });
});
