// The page backgrounds that are the theme's own (docs/specs/007-editor/pages-mode.md
// "Backgrounds", "It follows the theme"): the Gradient category's Theme row, the animated
// backgrounds' theme colourings, and how a page on one of them follows a theme change. A fill is the
// theme's own when it is exactly one of these for that theme; nothing else marks it. Here rather
// than in the editor so every path that makes a tab (a template on the api or the MCP worker too)
// lands the same backgrounds. Pure.
import { shade, tint } from './colors';
import { pagesOf, withPages, type PageFill, type PageMotion } from './page';
import {
  DUSK_BOTTOM_SHADE,
  DUSK_TOP_SHADE,
  MIST_BOTTOM_TINT,
  MIST_TOP_TINT,
  themeAccent,
  themeSecondaries,
} from './page-default-background';
import { pagesInkFor } from './page-ink';
import { PAGE_GRADIENT_ANGLE, sameFill } from './page-paint';
import { themePresetColors } from './theme-presets';
import type { Tab, ThemeDefinition } from './index';

type ThemeColours = Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>;

export type ThemeBackgroundPreset = { id: string; label: string; fill: PageFill };

// The Theme row's gradients, by name (each preset's id is `theme-<name>`).
export type ThemeGradientName =
  | 'dawn'
  | 'mist'
  | 'glow'
  | 'haze'
  | 'sorbet'
  | 'pastel'
  | 'bloom'
  | 'bright'
  | 'vivid'
  | 'aurora'
  | 'ember'
  | 'dusk'
  | 'twilight'
  | 'ink';

const gradient = (from: string, to: string): PageFill => ({
  kind: 'gradient',
  from,
  to,
  angle: PAGE_GRADIENT_ANGLE,
});

/**
 * Gradients drawn from the tab's theme, the Gradient category's Theme row: fourteen, seven light
 * then seven bold and deep, from its accent, its second colour and its third (a multi-colour
 * theme's next branches, else the accent deepened). Its solid colours are the Solid category's
 * Theme Palette (themePresetColors).
 */
export function themeBackgroundPresets(theme: ThemeColours): ThemeBackgroundPreset[] {
  const a = themeAccent(theme);
  const [b, c] = themeSecondaries(theme);
  const g = (id: ThemeGradientName, from: string, to: string): ThemeBackgroundPreset => ({
    id: `theme-${id}`,
    label: `Theme ${id}`,
    fill: gradient(from, to),
  });
  return [
    g('dawn', '#ffffff', tint(a, 0.8)),
    g('mist', tint(a, MIST_TOP_TINT), tint(a, MIST_BOTTOM_TINT)),
    g('glow', tint(a, 0.85), tint(b, 0.7)),
    g('haze', tint(b, 0.92), tint(a, 0.8)),
    g('sorbet', tint(b, 0.85), tint(c, 0.75)),
    g('pastel', tint(c, 0.9), tint(a, 0.78)),
    g('bloom', tint(a, 0.7), tint(b, 0.5)),
    g('bright', a, b),
    g('vivid', tint(a, 0.15), shade(a, 0.35)),
    g('aurora', shade(a, 0.3), shade(b, 0.1)),
    g('ember', b, shade(c, 0.5)),
    // A new infographic page's own background (defaultPageBackground).
    g('dusk', shade(a, DUSK_TOP_SHADE), shade(b, DUSK_BOTTOM_SHADE)),
    g('twilight', shade(b, 0.6), shade(a, 0.8)),
    g('ink', shade(a, 0.75), '#0f172a'),
  ];
}

/** One of the theme's gradients by name: what a template paints a page with. */
export function themeGradientFill(theme: ThemeColours, name: ThemeGradientName): PageFill {
  return themeBackgroundPresets(theme).find((p) => p.id === `theme-${name}`)!.fill;
}

// An animated background's colourings (pages-mode.md "Animated backgrounds"): each a pair of stops
// drawn from the theme's accent and its second colour.
export type PageMotionColouringId = 'deep' | 'night' | 'bright' | 'vivid' | 'soft' | 'mist';

export const PAGE_MOTION_COLOURINGS: readonly { id: PageMotionColouringId; label: string }[] = [
  { id: 'deep', label: 'Theme Deep' },
  { id: 'night', label: 'Theme Night' },
  { id: 'vivid', label: 'Theme Vivid' },
  { id: 'bright', label: 'Theme Bright' },
  { id: 'soft', label: 'Theme Soft' },
  { id: 'mist', label: 'Theme Mist' },
];

/** A colouring's two gradient stops, drawn from the theme's accent and its second colour. */
export function motionColouring(
  theme: ThemeColours,
  id: PageMotionColouringId,
): { from: string; to: string } {
  const a = themeAccent(theme);
  const [b] = themeSecondaries(theme);
  switch (id) {
    case 'deep':
      return { from: shade(a, 0.62), to: shade(b, 0.38) };
    case 'night':
      return { from: '#0b1020', to: shade(a, 0.72) };
    case 'vivid':
      return { from: a, to: shade(b, 0.25) };
    case 'bright':
      return { from: tint(a, 0.15), to: b };
    case 'soft':
      return { from: tint(a, 0.88), to: tint(b, 0.7) };
    case 'mist':
      return { from: tint(a, 0.95), to: tint(a, 0.72) };
  }
}

/** The fill a motion makes in a colouring: a gradient (what exports and re-inking see) with its
 *  motion, at `speed` when given (1, its own pace, is left off). */
export function motionFill(
  theme: ThemeColours,
  motion: PageMotion,
  colouring: PageMotionColouringId,
  speed?: number,
): PageFill {
  return {
    kind: 'gradient',
    ...motionColouring(theme, colouring),
    angle: PAGE_GRADIENT_ANGLE,
    motion,
    ...(speed !== undefined && speed !== 1 ? { speed } : {}),
  };
}

/** The colouring a fill's stops match for this theme, if any (its swatch shows as chosen). */
export function colouringOf(
  theme: ThemeColours,
  fill: PageFill | undefined,
): PageMotionColouringId | undefined {
  if (fill?.kind !== 'gradient') return undefined;
  return PAGE_MOTION_COLOURINGS.find(({ id }) => {
    const c = motionColouring(theme, id);
    return c.from === fill.from && c.to === fill.to;
  })?.id;
}

const isWhite = (c: string) => /^#?f{3}(?:f{3})?$/i.test(c);

/** The new theme's fill for a fill of the old theme's own, or undefined when the fill is not the
 *  old theme's (someone's own pick, a picture). An animated background keeps its motion and speed. */
export function followedFill(
  fill: PageFill,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): PageFill | undefined {
  if (fill.kind === 'gradient' && fill.motion) {
    const colouring = colouringOf(prev, fill);
    return colouring ? motionFill(next, fill.motion, colouring, fill.speed) : undefined;
  }
  if (fill.kind === 'gradient') {
    // Both themes make the same fourteen, in the same order.
    const i = themeBackgroundPresets(prev).findIndex((p) => sameFill(p.fill, fill));
    return i >= 0 ? themeBackgroundPresets(next)[i]!.fill : undefined;
  }
  if (fill.kind === 'solid') {
    const before = themePresetColors(prev).filter((c) => !isWhite(c));
    const i = before.findIndex((c) => c.toLowerCase() === fill.color.toLowerCase());
    const after = themePresetColors(next).filter((c) => !isWhite(c));
    return i >= 0 && after[i] ? { kind: 'solid', color: after[i] } : undefined;
  }
  return undefined;
}

/** Whether a fill is the theme's own (followedFill would carry it to another theme). */
export function isThemeOwnFill(fill: PageFill, theme: ThemeDefinition): boolean {
  return followedFill(fill, theme, theme) !== undefined;
}

/** The tab with every page on a fill of the old theme's own moved to the new theme's, its content
 *  re-inked; the same tab when no page changes. */
export function withPageBackgroundsFollowingTheme<T extends Pick<Tab, 'elements'>>(
  tab: T,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): T {
  const pages = pagesOf(tab as unknown as Tab);
  if (!pages.some((p) => p.background?.fill)) return tab;
  const moved: string[] = [];
  const nextPages = pages.map((p) => {
    const fill = p.background?.fill;
    const to = fill ? followedFill(fill, prev, next) : undefined;
    if (!to || sameFill(to, fill)) return p;
    moved.push(p.id);
    return { ...p, background: { ...p.background, fill: to } };
  });
  if (moved.length === 0) return tab;
  // Every moved page inked in one walk: a theme change on a full deck moves them all.
  const inks = moved.map((id) => ({
    pageId: id,
    background: nextPages.find((p) => p.id === id)!.background,
  }));
  return pagesInkFor(withPages(tab, nextPages) as unknown as Tab, inks).tab as unknown as T;
}
