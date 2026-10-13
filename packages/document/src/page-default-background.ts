// The background a new infographic page starts on (docs/specs/007-editor/illustrate-pages.md
// "A new page's background"): the tab theme's Mist gradient, a light wash of its accent, so a fresh
// page looks designed rather than bare while dark text and the theme's ink still read on it. Pure:
// every path that makes a page (adding one, choosing the first page's kind, a template, an AI
// tool) lands the same background.
import { shade, tint } from './colors';
import { illustratePagesOf, pageKindOf, type PageBackground } from './illustrate-page';
import { PAGE_GRADIENT_ANGLE } from './illustrate-page-paint';
import type { Tab, ThemeDefinition } from './index';

// The accent a theme without its own stroke paints in (the brand blue).
export const FALLBACK_THEME_ACCENT = '#0ea5e9';
// Mist: the accent tinted this far toward white at the top, and this far at the bottom. Light
// enough that the default dark ink stays well past AA; the Gradient category's Theme Mist.
export const MIST_TOP_TINT = 0.95;
export const MIST_BOTTOM_TINT = 0.72;

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The tab theme's accent: its element stroke, else its first palette colour, else the brand blue.
 *  What theme backgrounds and a document's accent are drawn from. */
export function themeAccent(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): string {
  return isHex(theme.elementStroke)
    ? theme.elementStroke
    : isHex(theme.palette?.[0]?.stroke)
      ? theme.palette![0]!.stroke
      : FALLBACK_THEME_ACCENT;
}

/** The theme's second and third colours (a multi-colour theme's next branches, else the accent
 *  deepened), for the theme gradients. */
export function themeSecondaries(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): [string, string] {
  const a = themeAccent(theme);
  const b = isHex(theme.palette?.[1]?.stroke) ? theme.palette![1]!.stroke : shade(a, 0.25);
  const c = isHex(theme.palette?.[2]?.stroke) ? theme.palette![2]!.stroke : shade(a, 0.45);
  return [b, c];
}

/** A new infographic page's background: the theme's Mist gradient. */
export function defaultPageBackground(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): PageBackground {
  const a = themeAccent(theme);
  return {
    fill: {
      kind: 'gradient',
      from: tint(a, MIST_TOP_TINT),
      to: tint(a, MIST_BOTTOM_TINT),
      angle: PAGE_GRADIENT_ANGLE,
    },
  };
}

/** The tab with every infographic page that has no background of its own given the theme's
 *  default, when `ids` names it (the pages just made); the same tab when none changes. */
export function withDefaultPageBackgrounds<T extends Partial<Pick<Tab, 'pages'>>>(
  tab: T,
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
  ids?: ReadonlySet<string>,
): T {
  const pages = illustratePagesOf(tab as Pick<Tab, 'pages'>);
  let changed = false;
  const next = pages.map((p) => {
    if (p.background || p.flow || pageKindOf(p) !== 'infographic') return p;
    if (ids && !ids.has(p.id)) return p;
    // An unchosen first page (no kind yet) waits for its choice.
    if (p.kind === undefined && !ids) return p;
    changed = true;
    return { ...p, background: defaultPageBackground(theme) };
  });
  return changed ? { ...tab, pages: next } : tab;
}
