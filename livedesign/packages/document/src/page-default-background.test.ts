import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { getBuiltInTheme, THEMES } from './themes';
import { PEN_INK } from './pen-colours';
import { defaultPageBackground, themeAccent } from './page-default-background';

// docs/specs/007-editor/pages-mode.md "A new page's background".
describe("the theme's Dusk page background", () => {
  it("is the theme's Dusk gradient, dark enough that light ink reads on every built-in theme", () => {
    for (const t of THEMES) {
      const theme = getBuiltInTheme(t.id);
      const fill = defaultPageBackground(theme).fill!;
      expect(fill.kind).toBe('gradient');
      if (fill.kind !== 'gradient') continue;
      for (const tone of [fill.from, fill.to]) {
        expect(contrastRatio(PEN_INK.dark, tone), `${t.id} ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('follows the theme accent', () => {
    const a = defaultPageBackground({ elementStroke: '#dc2626' });
    const b = defaultPageBackground({ elementStroke: '#2563eb' });
    expect(a).not.toEqual(b);
    expect(themeAccent({ palette: [{ fill: '#fff', stroke: '#16a34a', text: '#000' }] })).toBe(
      '#16a34a',
    );
    expect(themeAccent({})).toBe('#0ea5e9');
  });
});
