// The page fills a tab's theme offers (docs/specs/007-editor/pages-mode.md "Backgrounds", "Animated backgrounds"): the
// Gradient category's Theme row and the animated backgrounds' theme colourings. Here rather than in the editor so a
// theme change made anywhere (a pick in the editor, an agent's style_design) moves a page on one of them to the new
// theme's, as page-theme-follow does. Pure: theme in, fills out.
import { PAGE_GRADIENT_ANGLE } from './page-paint';
import {
  DUSK_BOTTOM_SHADE,
  DUSK_TOP_SHADE,
  MIST_BOTTOM_TINT,
  MIST_TOP_TINT,
  themeAccent,
  themeSecondaries,
} from './page-default-background';
import { shade, tint, type PageFill, type PageMotion, type ThemeDefinition } from './index';

export type ThemeBackgroundPreset = { id: string; label: string; fill: PageFill };

const gradient = (from: string, to: string): PageFill => ({
  kind: 'gradient',
  from,
  to,
  angle: PAGE_GRADIENT_ANGLE,
});

/**
 * Gradients drawn from the tab's theme (docs/specs/007-editor/pages-mode.md "Backgrounds"),
 * the Gradient category's Theme row: fourteen, seven light then seven bold and deep, from its
 * accent, its second colour and its third (a multi-colour theme's next branches, else the accent
 * deepened). Its solid colours are the Solid category's Theme Palette.
 */
export function themeBackgroundPresets(
  theme: Pick<ThemeDefinition, 'elementStroke' | 'palette'>,
): ThemeBackgroundPreset[] {
  const a = themeAccent(theme);
  const [b, c] = themeSecondaries(theme);
  const g = (id: string, label: string, from: string, to: string): ThemeBackgroundPreset => ({
    id: `theme-${id}`,
    label: `Theme ${label}`,
    fill: gradient(from, to),
  });
  return [
    g('dawn', 'dawn', '#ffffff', tint(a, 0.8)),
    g('mist', 'mist', tint(a, MIST_TOP_TINT), tint(a, MIST_BOTTOM_TINT)),
    g('glow', 'glow', tint(a, 0.85), tint(b, 0.7)),
    g('haze', 'haze', tint(b, 0.92), tint(a, 0.8)),
    g('sorbet', 'sorbet', tint(b, 0.85), tint(c, 0.75)),
    g('pastel', 'pastel', tint(c, 0.9), tint(a, 0.78)),
    g('bloom', 'bloom', tint(a, 0.7), tint(b, 0.5)),
    g('bright', 'bright', a, b),
    g('vivid', 'vivid', tint(a, 0.15), shade(a, 0.35)),
    g('aurora', 'aurora', shade(a, 0.3), shade(b, 0.1)),
    g('ember', 'ember', b, shade(c, 0.5)),
    // A new blank page's own background (defaultPageBackground).
    g('dusk', 'dusk', shade(a, DUSK_TOP_SHADE), shade(b, DUSK_BOTTOM_SHADE)),
    g('twilight', 'twilight', shade(b, 0.6), shade(a, 0.8)),
    g('ink', 'ink', shade(a, 0.75), '#0f172a'),
  ];
}

export type PageMotionColouringId = 'deep' | 'night' | 'bright' | 'vivid' | 'soft' | 'mist';

export const PAGE_MOTION_COLOURINGS: readonly { id: PageMotionColouringId; label: string }[] = [
  { id: 'deep', label: 'Theme Deep' },
  { id: 'night', label: 'Theme Night' },
  { id: 'vivid', label: 'Theme Vivid' },
  { id: 'bright', label: 'Theme Bright' },
  { id: 'soft', label: 'Theme Soft' },
  { id: 'mist', label: 'Theme Mist' },
];

type ThemeColours = Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>;

/** A colouring's two gradient stops, drawn from the theme's accent and its second colour. */
export function motionColouring(
  theme: ThemeColours,
  id: PageMotionColouringId,
): {
  from: string;
  to: string;
} {
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
 *  motion. */
export function motionFill(
  theme: ThemeColours,
  motion: PageMotion,
  colouring: PageMotionColouringId,
): PageFill {
  return {
    kind: 'gradient',
    ...motionColouring(theme, colouring),
    angle: PAGE_GRADIENT_ANGLE,
    motion,
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
