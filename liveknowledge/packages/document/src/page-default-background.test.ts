import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { getBuiltInTheme, THEMES } from './themes';
import { pagesOf } from './page';
import { PEN_INK } from './pen-colours';
import {
  defaultPageBackground,
  STEEL_GRADIENT,
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

  it('starts a slide on Steel, light enough that dark ink reads at 7:1', () => {
    const fill = defaultPageBackground(getBuiltInTheme(undefined), 'slide').fill!;
    expect(fill).toMatchObject({ kind: 'gradient', ...STEEL_GRADIENT });
    for (const tone of [STEEL_GRADIENT.from, STEEL_GRADIENT.to])
      expect(contrastRatio(PEN_INK.light, tone)).toBeGreaterThanOrEqual(7);
  });

  it('gives a slide its default only as a new slide document’s one page', () => {
    const theme = getBuiltInTheme(undefined);
    const slide = {
      id: 's1',
      orientation: 'landscape' as const,
      kind: 'slide' as const,
      size: 'slide' as const,
    };
    const alone = pagesOf(withDefaultPageBackgrounds({ pages: [slide] }, theme, new Set(['s1'])));
    expect(alone[0]!.background).toEqual(defaultPageBackground(theme, 'slide'));
    const deck = pagesOf(
      withDefaultPageBackgrounds(
        { pages: [slide, { ...slide, id: 's2' }] },
        theme,
        new Set(['s2']),
      ),
    );
    expect(deck[1]!.background).toBeUndefined();
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
          orientation: 'landscape' as const,
          kind: 'slide' as const,
          size: 'slide' as const,
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
