import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { getBuiltInTheme, THEMES } from './themes';
import { pagesOf } from './page';
import { PEN_INK } from './pen-colours';
import {
  defaultPageBackground,
  themeAccent,
  withDefaultPageBackgrounds,
} from './page-default-background';

// docs/specs/007-editor/pages-mode.md "A new page's background".
describe("a new infographic page's background", () => {
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

  it('lands on the named pages with no background, and only on infographic pages', () => {
    const theme = getBuiltInTheme(undefined);
    const tab = {
      pages: [
        { id: 'p1', orientation: 'portrait' as const },
        {
          id: 'p2',
          orientation: 'portrait' as const,
          background: { fill: { kind: 'solid' as const, color: '#000000' } },
        },
        {
          id: 'p3',
          orientation: 'portrait' as const,
          kind: 'logo' as const,
          size: 'logo' as const,
        },
      ],
    };
    const out = withDefaultPageBackgrounds(tab, theme, new Set(['p1', 'p2', 'p3']));
    const pages = pagesOf(out);
    expect(pages[0]!.background).toEqual(defaultPageBackground(theme));
    expect(pages[1]!.background).toEqual(tab.pages[1]!.background);
    expect(pages[2]!.background).toBeUndefined();
  });

  it('leaves an unchosen first page for its choice, and changes nothing twice', () => {
    const theme = getBuiltInTheme(undefined);
    const tab = { pages: [{ id: 'p1', orientation: 'portrait' as const }] };
    expect(withDefaultPageBackgrounds(tab, theme)).toBe(tab);
    const chosen = {
      pages: [{ id: 'p1', orientation: 'portrait' as const, kind: 'infographic' as const }],
    };
    const once = withDefaultPageBackgrounds(chosen, theme);
    expect(once).not.toBe(chosen);
    expect(withDefaultPageBackgrounds(once, theme)).toBe(once);
  });
});
