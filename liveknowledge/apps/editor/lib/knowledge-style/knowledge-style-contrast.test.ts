import { describe, expect, it } from 'vitest';
import { contrastRatio, mixHex } from '@liveknowledge/document';
import { editorAccentCss } from '@liveworkspace/workbench/hooks/ui/editor-accent';
import { articleStyleVars } from '@/lib/article/article-style-vars';
import { pageLinkColour } from '@/lib/knowledge/page-link-colour';
import { THEMES } from '@/lib/themes';
import { PAGE_GROUND } from '@/lib/view-backdrop';
import { KNOWLEDGE_LOOKS, knowledgeSeasonalLooksFor } from './knowledge-looks';
import {
  LIME_ACCENT,
  knowledgeChromeAccent,
  knowledgeDarkGround,
  knowledgeThemeAccent,
} from './knowledge-accent';
import { previewInks } from './look-page-preview';

// docs/specs/030-knowledgebase/page-surface.md "The chrome follows the theme": the accent the sidebar, tabs,
// buttons and links use is the knowledgebase's theme accent, and text reads at 4.5:1 on every theme, in light and
// dark. The chrome's colours are Tailwind utilities over two ramps the theme retargets (@liveworkspace/workbench
// hooks/ui/editor-accent.ts): `brand-*`, spun from the accent, and in dark the `slate-600..950` surfaces. Each pair
// below is one the knowledgebase's chrome draws, named with the component that draws it.
const AA = 4.5;
// The neutral stops no theme retargets (Tailwind's slate): the chrome's light surfaces and its dark-mode text.
const SLATE = { 100: '#f1f5f9', 400: '#90a1b9', 600: '#45556c', 900: '#0f172b' } as const;
const WHITE = '#ffffff';

type Ramp = Record<string, string>;
function rampsOf(themeId: string): { brand: Ramp; dark: Ramp } {
  const accent = knowledgeChromeAccent(themeId);
  if (!accent) throw new Error(`${themeId} has no chrome accent`);
  const css = editorAccentCss(accent);
  const read = (prefix: string): Ramp =>
    Object.fromEntries(
      [...css.matchAll(new RegExp(`--color-${prefix}-(\\d+):(#[0-9a-f]{6});`, 'g'))].map((m) => [
        m[1]!,
        m[2]!,
      ]),
    );
  return { brand: read('brand'), dark: read('slate') };
}
/** `colour` at `alpha` over `ground`, as a translucent Tailwind fill draws. */
const over = (colour: string, alpha: number, ground: string) => mixHex(colour, ground, alpha);

// Every theme a knowledgebase can wear but the product's own, which keeps the hand-tuned lime ramp
// (packages/tailwind-config/theme.css, held by theme-budget.test.ts and dark-palette.test.ts).
const THEMED = THEMES.filter((t) => t.id !== 'brand').map((t) => t.id);

describe('every theme is offered through a look or the Colours panel', () => {
  it('covers the year-round and the seasonal themes', () => {
    const worn = new Set([
      ...KNOWLEDGE_LOOKS.map((l) => l.theme),
      ...knowledgeSeasonalLooksFor(new Date(2026, 10, 20)).map((l) => l.theme),
    ]);
    for (const theme of worn) expect(['brand', ...THEMED]).toContain(theme);
    expect(THEMED.length).toBeGreaterThan(25);
  });
});

describe.each(THEMED)('the knowledgebase chrome under %s', (themeId) => {
  const { brand, dark } = rampsOf(themeId);
  // The dark appearance's grounds under this theme: the page and the top row, the sidebar, the footer's bar.
  const ground = dark['900']!;

  it('dark: the page stands on the theme’s own dark surface', () => {
    expect(knowledgeDarkGround(themeId)).toBe(ground);
  });

  it('light: the tree’s selected row and the Verified pill (brand-900 on brand-100)', () => {
    expect(contrastRatio(brand['900']!, brand['100']!)).toBeGreaterThanOrEqual(AA);
  });

  it('light: the formatting bar’s active state and a selected menu row (brand-700 on brand-50)', () => {
    expect(contrastRatio(brand['700']!, brand['50']!)).toBeGreaterThanOrEqual(AA);
  });

  it('light and dark: a solid fill under white text (brand-700, brand-600)', () => {
    expect(contrastRatio(WHITE, brand['700']!)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(WHITE, brand['600']!)).toBeGreaterThanOrEqual(AA);
  });

  it('dark: the tree’s selected row and the Verified pill (brand-100 on brand-500 at 20%)', () => {
    for (const surface of [dark['900']!, dark['800']!])
      expect(
        contrastRatio(brand['100']!, over(brand['500']!, 0.2, surface)),
      ).toBeGreaterThanOrEqual(AA);
  });

  it('dark: the formatting bar’s active state (brand-300 on brand-500 at 15%)', () => {
    expect(contrastRatio(brand['300']!, over(brand['500']!, 0.15, ground))).toBeGreaterThanOrEqual(
      AA,
    );
  });

  it('dark: the footer’s tabs (white on the open tab’s card, slate-400 on the bar)', () => {
    // tab-shape.ts: the card is slate-800 mixed 70% with slate-600; the bar is slate-950.
    const card = mixHex(dark['800']!, dark['600']!, 0.7);
    expect(contrastRatio(WHITE, card)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(SLATE[400], dark['950']!)).toBeGreaterThanOrEqual(AA);
  });

  it('light: the footer’s tabs keep the neutral ink no theme retargets', () => {
    expect(contrastRatio(SLATE[900], WHITE)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(SLATE[600], SLATE[100])).toBeGreaterThanOrEqual(AA);
  });

  it.each(['light', 'dark'] as const)(
    '%s: the writing’s accent and its page links',
    (appearance) => {
      const tone = PAGE_GROUND[appearance];
      const vars = articleStyleVars(undefined, knowledgeThemeAccent(themeId), {
        tone,
        dark: appearance === 'dark',
      }).vars as Record<string, string>;
      // Drawn on the white page, and in dark on the theme's own tinted ground.
      const drawnOn = appearance === 'dark' ? ground : WHITE;
      for (const key of ['--article-accent', '--article-page-link', '--article-heading-color'])
        expect(contrastRatio(vars[key]!, drawnOn), key).toBeGreaterThanOrEqual(AA);
      // A theme whose accent is the product's own lime (Olive) keeps the lime page links.
      const accent = knowledgeThemeAccent(themeId);
      expect(vars['--article-page-link']).toBe(
        pageLinkColour(
          { tone, dark: appearance === 'dark' },
          accent === LIME_ACCENT ? null : accent,
        ),
      );
    },
  );
});

describe('the product’s own theme', () => {
  it('hands the chrome no accent, so the built-in lime ramp stands', () => {
    expect(knowledgeChromeAccent('brand')).toBeNull();
    expect(knowledgeChromeAccent(undefined)).toBeNull();
    expect(knowledgeThemeAccent('brand')).toBe(LIME_ACCENT);
  });

  it.each(['light', 'dark'] as const)('%s: its writing reads in lime at 4.5:1', (appearance) => {
    const c = previewInks({ theme: 'brand' }, appearance);
    expect(contrastRatio(c.accent, c.paper)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.ink, c.paper)).toBeGreaterThanOrEqual(AA);
    // And on the page itself, whose dark ground is the shared dark surface.
    const tone = PAGE_GROUND[appearance];
    const vars = articleStyleVars(undefined, LIME_ACCENT, { tone, dark: appearance === 'dark' })
      .vars as Record<string, string>;
    const drawnOn = appearance === 'dark' ? knowledgeDarkGround('brand') : WHITE;
    for (const key of ['--article-accent', '--article-page-link', '--article-heading-color'])
      expect(contrastRatio(vars[key]!, drawnOn), key).toBeGreaterThanOrEqual(AA);
  });
});

describe('Review Due and errors keep their own colours in every theme', () => {
  it('the ramps a theme retargets are brand and the dark surfaces, never amber or red', () => {
    for (const themeId of THEMED) {
      const css = editorAccentCss(knowledgeChromeAccent(themeId)!);
      expect(css).not.toMatch(/--color-(amber|red|rose|orange|yellow)-/);
      expect(css).not.toMatch(/--color-slate-(50|[1-5]00):/);
    }
  });

  it.each(THEMED)('dark %s: the Review Due pill reads on the tinted ground', (themeId) => {
    const { dark } = rampsOf(themeId);
    // TrustBadge.tsx REVIEW_DUE_PILL: amber-200 on amber-500 at 20%.
    for (const surface of [dark['900']!, dark['800']!])
      expect(contrastRatio('#fee685', over('#fe9a00', 0.2, surface))).toBeGreaterThanOrEqual(AA);
  });
});
