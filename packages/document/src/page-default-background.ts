// The background a new page starts on (docs/specs/007-editor/pages-mode.md "A new page's
// background"): an infographic page the tab theme's Dusk gradient (its accent deepened into its
// second colour), a new slide document's slide the Steel gradient (a cool light grey), so a fresh
// page looks designed rather than bare. Pure:
// every path that makes a page (adding one, choosing the first page's kind, a template, an AI
// tool) lands the same background.
import { shade } from './colors';
import { pagesOf, pageKindOf, type PageBackground } from './page';
import { PAGE_GRADIENT_ANGLE } from './page-paint';
import type { Tab, ThemeDefinition } from './index';

// The accent a theme without its own stroke paints in (the brand blue).
export const FALLBACK_THEME_ACCENT = '#0ea5e9';
// Mist: the accent tinted this far toward white at the top, and this far at the bottom. Light
// enough that the default dark ink stays well past AA; the Gradient category's Theme Mist.
export const MIST_TOP_TINT = 0.95;
export const MIST_BOTTOM_TINT = 0.72;
// Dusk: the accent shaded this far toward black at the top, the second colour this far at the
// bottom; the Gradient category's Theme Dusk, and a new infographic page's own.
export const DUSK_TOP_SHADE = 0.65;
export const DUSK_BOTTOM_SHADE = 0.4;
// Steel: the Gradient category's Steel, a cool light grey; a new slide document's slide.
export const STEEL_GRADIENT = { from: '#f1f5f9', to: '#cbd5e1' } as const;

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The tab theme's accent: its element stroke, else its first palette colour, else the brand blue.
 *  What theme backgrounds and a document's accent are drawn from. */
export function themeAccent(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): string {
  return isHex(theme.elementStroke)
    ? theme.elementStroke
    : isHex(theme.palette?.[0]?.stroke)
      ? theme.palette[0].stroke
      : FALLBACK_THEME_ACCENT;
}

/** The theme's second and third colours (a multi-colour theme's next branches, else the accent
 *  deepened), for the theme gradients. */
export function themeSecondaries(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): [string, string] {
  const a = themeAccent(theme);
  const b = isHex(theme.palette?.[1]?.stroke) ? theme.palette[1].stroke : shade(a, 0.25);
  const c = isHex(theme.palette?.[2]?.stroke) ? theme.palette[2].stroke : shade(a, 0.45);
  return [b, c];
}

/** The page kinds that start on a theme background, and which. */
type ThemedPageKind = 'infographic' | 'slide';

/** A new page's background: an infographic page's the theme's Dusk gradient, a slide's Steel. */
export function defaultPageBackground(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
  kind: ThemedPageKind = 'infographic',
): PageBackground {
  const a = themeAccent(theme);
  const [b] = themeSecondaries(theme);
  const [from, to] =
    kind === 'slide'
      ? [STEEL_GRADIENT.from, STEEL_GRADIENT.to]
      : [shade(a, DUSK_TOP_SHADE), shade(b, DUSK_BOTTOM_SHADE)];
  return { fill: { kind: 'gradient', from, to, angle: PAGE_GRADIENT_ANGLE } };
}

/** The tab with every new page that has no background of its own given the theme's default, when
 *  `ids` names it (the pages just made): an infographic page always, a slide only as a new slide
 *  document's (the tab's one page), so a deck on paper keeps its paper. The same tab when none
 *  changes. */
export function withDefaultPageBackgrounds<T extends Partial<Pick<Tab, 'pages'>>>(
  tab: T,
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
  ids?: ReadonlySet<string>,
): T {
  const pages = pagesOf(tab);
  let changed = false;
  const next = pages.map((p) => {
    const kind = pageKindOf(p);
    const themed = kind === 'infographic' || (kind === 'slide' && pages.length === 1);
    if (p.background || p.flow || !themed) return p;
    if (ids && !ids.has(p.id)) return p;
    // An unchosen first page (no kind yet) waits for its choice.
    if (p.kind === undefined && !ids) return p;
    changed = true;
    return {
      ...p,
      background: defaultPageBackground(theme, kind === 'slide' ? 'slide' : 'infographic'),
    };
  });
  return changed ? { ...tab, pages: next } : tab;
}
