// The tab theme's own page backgrounds (docs/specs/007-editor/pages-mode.md "Backgrounds"): Dusk,
// its accent deepened into its second colour, and the accent and secondaries they are drawn from.
// Pure.
import { shade } from './colors';
import type { PageBackground } from './page';
import { PAGE_GRADIENT_ANGLE } from './page-paint';
import type { ThemeDefinition } from './index';

// The accent a theme without its own stroke paints in (the brand blue).
export const FALLBACK_THEME_ACCENT = '#0ea5e9';
// Mist: the accent tinted this far toward white at the top, and this far at the bottom. Light
// enough that the default dark ink stays well past AA; the Gradient category's Theme Mist.
export const MIST_TOP_TINT = 0.95;
export const MIST_BOTTOM_TINT = 0.72;
// Dusk: the accent shaded this far toward black at the top, the second colour this far at the
// bottom; the Gradient category's Theme Dusk.
export const DUSK_TOP_SHADE = 0.65;
export const DUSK_BOTTOM_SHADE = 0.4;
// Steel: the Gradient category's Steel, a cool light grey.
export const STEEL_GRADIENT = { from: '#f1f5f9', to: '#cbd5e1' } as const;

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The tab theme's accent: its element stroke, else its first palette colour, else the brand blue.
 *  What theme backgrounds and a design's accent are drawn from. */
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

/** The theme's Dusk gradient as a page background: the Gradient category's Theme Dusk, which a
 *  page painted with it keeps as the theme changes (page-theme-follow). */
export function defaultPageBackground(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): PageBackground {
  const a = themeAccent(theme);
  const [b] = themeSecondaries(theme);
  const from = shade(a, DUSK_TOP_SHADE);
  const to = shade(b, DUSK_BOTTOM_SHADE);
  return { fill: { kind: 'gradient', from, to, angle: PAGE_GRADIENT_ANGLE } };
}
