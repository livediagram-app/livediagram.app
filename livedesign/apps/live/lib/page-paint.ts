// What a page is painted with (docs/specs/007-editor/pages-mode.md
// "Backgrounds"): the panel's preset catalogue, and the CSS a sheet takes from its background. The
// export paints the same background onto its own canvas (export-page).
import {
  DUSK_BOTTOM_SHADE,
  DUSK_TOP_SHADE,
  STEEL_GRADIENT,
  FALLBACK_THEME_ACCENT,
  MIST_BOTTOM_TINT,
  MIST_TOP_TINT,
  themeAccent,
  themeSecondaries,
  PAGE_GRADIENT_ANGLE,
  pageImageTone,
  PAGE_PATTERN_PITCH,
  pagePatternInk,
  shade,
  tint,
  type ThemeDefinition,
  sameFill,
  type PageBackground,
  type PageFill,
  type PagePattern,
} from '@livedesign/document';
import type { CSSProperties } from 'react';
import {
  pageImageCssUrl,
  pageImageOverlayCss,
  pageImagePositionCss,
  pageImageSrc,
} from './page-image-paint';

// The background edit itself is the document's, shared with the agents' page changes.
export {
  PAGE_GRADIENT_ANGLE,
  PAGE_PATTERN_PITCH,
  pagePatternInk,
  sameFill,
  withBackgroundPatch,
} from '@livedesign/document';

type GradientPreset = { id: string; label: string; from: string; to: string };

// The plain paper as the canvas shows it (a sheet with no fill: white, or slate in dark mode), for
// what draws a page as it looks on screen (the Map, the Contents and Slides pictures). An export
// prints it white.
export const CANVAS_PAPER: Readonly<Record<'light' | 'dark', string>> = {
  light: '#ffffff',
  dark: '#0f172a',
};

export const PAGE_GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: 'sunrise', label: 'Sunrise', from: '#fde68a', to: '#fca5a5' },
  { id: 'peach', label: 'Peach', from: '#fed7aa', to: '#fecdd3' },
  { id: 'rose', label: 'Rose', from: '#ffe4e6', to: '#fbcfe8' },
  { id: 'lavender', label: 'Lavender', from: '#e9d5ff', to: '#fbcfe8' },
  { id: 'ocean', label: 'Ocean', from: '#bae6fd', to: '#c7d2fe' },
  { id: 'meadow', label: 'Meadow', from: '#bbf7d0', to: '#a5f3fc' },
  { id: 'mint', label: 'Mint', from: '#ccfbf1', to: '#d9f99d' },
  { id: 'sand', label: 'Sand', from: '#fef3c7', to: '#e7e5e4' },
  // A new slide document's slide (defaultPageBackground).
  { id: 'steel', label: 'Steel', ...STEEL_GRADIENT },
  { id: 'dusk', label: 'Dusk', from: '#1e1b4b', to: '#4c1d95' },
  { id: 'night', label: 'Night', from: '#0f172a', to: '#1e3a8a' },
  { id: 'forest', label: 'Forest', from: '#052e16', to: '#115e59' },
  { id: 'ember', label: 'Ember', from: '#7c2d12', to: '#be123c' },
];

export const PAGE_PATTERN_LABEL: Record<PagePattern | 'none', string> = {
  none: 'None',
  dots: 'Dots',
  grid: 'Grid',
  lines: 'Lines',
};

// The pattern's pitch in canvas px.

export const gradientFill = (p: Pick<GradientPreset, 'from' | 'to'>): PageFill => ({
  kind: 'gradient',
  from: p.from,
  to: p.to,
  angle: PAGE_GRADIENT_ANGLE,
});

/** The CSS `background` of a fill: a colour, a linear gradient, or a picture's tone under its
 *  overlay (a swatch's stand-in for it). */
export function fillCss(fill: PageFill): string {
  if (fill.kind === 'solid') return fill.color;
  if (fill.kind === 'image') return pageImageTone(fill);
  return `linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`;
}

// The pattern's layers, drawn in `currentColor` so the sheet's `color` sets the ink.
function patternLayers(pattern: PagePattern): { image: string; size: string } {
  const p = PAGE_PATTERN_PITCH;
  switch (pattern) {
    case 'dots':
      return {
        image: 'radial-gradient(circle, currentColor 1.4px, transparent 1.9px)',
        size: `${p}px ${p}px`,
      };
    case 'grid':
      return {
        image:
          'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
        size: `${p}px ${p}px, ${p}px ${p}px`,
      };
    case 'lines':
      return {
        image: 'linear-gradient(transparent calc(100% - 1px), currentColor calc(100% - 1px))',
        size: `100% ${p}px`,
      };
  }
}

/**
 * A sheet's inline style for its background: the fill (absent leaves the paper to the sheet's own
 * classes, white or slate in dark chrome) and the pattern over it, inked faintly in the page's ink.
 * `color` is that ink, so the pattern reads on any fill. A picture paints from the source
 * `resolveImage` gives its gallery id (its fetched blob URL), over its tone until it has one, under
 * its overlay ("Image backgrounds").
 */
export function pageSheetStyle(
  background: PageBackground | undefined,
  resolveImage?: (imageId: string) => string | undefined,
): CSSProperties {
  const fill = background?.fill;
  const style: CSSProperties = {};
  const images: string[] = [];
  const sizes: string[] = [];
  const clips: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  const layer = (
    image: string,
    size: string,
    clip: string,
    position = '0 0',
    repeat = 'repeat',
  ) => {
    images.push(image);
    sizes.push(size);
    clips.push(clip);
    positions.push(position);
    repeats.push(repeat);
  };
  if (background?.pattern) {
    const pattern = patternLayers(background.pattern);
    layer(pattern.image, pattern.size, 'border-box');
  }
  if (fill?.kind === 'gradient') {
    layer(fillCss(fill), '100% 100%', 'border-box');
  } else if (fill?.kind === 'solid') {
    style.backgroundColor = fill.color;
  } else if (fill?.kind === 'image') {
    if (fill.overlay) layer(pageImageOverlayCss(fill.overlay), '100% 100%', 'border-box');
    const src = pageImageSrc(fill, resolveImage);
    const url = src ? pageImageCssUrl(src) : null;
    if (url) layer(url, 'cover', 'border-box', pageImagePositionCss(fill.position), 'no-repeat');
    // The picture's own tone under it, while it loads (and where it cannot).
    style.backgroundColor = pageImageTone({ tone: fill.tone });
  }
  if (images.length) {
    // The colour paints under the last layer's clip: a clear last layer keeps it to the border.
    if (clips[clips.length - 1] === 'content-box') {
      layer('linear-gradient(transparent, transparent)', '100% 100%', 'border-box');
    }
    style.backgroundImage = images.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundClip = clips.join(', ');
    style.backgroundRepeat = repeats.every((r) => r === 'repeat') ? 'repeat' : repeats.join(', ');
    if (positions.some((p) => p !== '0 0')) style.backgroundPosition = positions.join(', ');
  }
  if (fill) style.color = pagePatternInk(background);
  return style;
}

export type ThemeBackgroundPreset = { id: string; label: string; fill: PageFill };

// The theme's accent and its default page background are the document's, shared with every path
// that makes a page.
export { themeAccent } from '@livedesign/document';
const FALLBACK_ACCENT = FALLBACK_THEME_ACCENT;
const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/**
 * Gradients drawn from the tab's theme (docs/specs/007-editor/pages-mode.md "Backgrounds"),
 * the Gradient category's Theme row: fourteen, seven light then seven bold and deep, from its
 * accent, its second colour and its third (a multi-colour theme's next branches, else the accent
 * deepened). Its solid colours are the Solid category's Theme Palette. Pure: theme in, presets out.
 */
export function themeBackgroundPresets(
  theme: Pick<ThemeDefinition, 'elementStroke' | 'palette'>,
): ThemeBackgroundPreset[] {
  const a = themeAccent(theme);
  const [b, c] = themeSecondaries(theme);
  const g = (id: string, label: string, from: string, to: string): ThemeBackgroundPreset => ({
    id: `theme-${id}`,
    label: `Theme ${label}`,
    fill: gradientFill({ from, to }),
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
    // A new infographic page's own background (defaultPageBackground).
    g('dusk', 'dusk', shade(a, DUSK_TOP_SHADE), shade(b, DUSK_BOTTOM_SHADE)),
    g('twilight', 'twilight', shade(b, 0.6), shade(a, 0.8)),
    g('ink', 'ink', shade(a, 0.75), '#0f172a'),
  ];
}

/** The theme accent the theme's gradients were drawn from (Theme bright runs from it): a page
 *  picture's Tint, where only the presets are at hand. */
export function themePresetAccent(presets: readonly ThemeBackgroundPreset[]): string {
  const bright = presets.find((p) => p.id === 'theme-bright')?.fill;
  return bright?.kind === 'gradient' && isHex(bright.from) ? bright.from : FALLBACK_ACCENT;
}

/** The Background section's categories (docs/specs/007-editor/pages-mode.md "Backgrounds"). */
export type BackgroundCategory = 'solid' | 'gradient' | 'image' | 'animated';

/** The category a page's fill belongs to: Animated for a gradient with a motion, Gradient for any
 *  other gradient (a theme's, a preset or a custom one), Image for a picture, else Solid (the paper
 *  and every solid colour). */
export function backgroundCategoryOf(fill: PageFill | undefined): BackgroundCategory {
  if (fill?.kind === 'gradient') return fill.motion ? 'animated' : 'gradient';
  return fill?.kind === 'image' ? 'image' : 'solid';
}

/** Whether the fill is a gradient no preset (of the catalogue or the theme) names: a custom one. */
export function isCustomGradient(
  fill: PageFill | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): boolean {
  return (
    fill?.kind === 'gradient' &&
    !fill.motion &&
    !PAGE_GRADIENT_PRESETS.some((g) => sameFill(fill, gradientFill(g))) &&
    !themePresets.some((t) => sameFill(fill, t.fill))
  );
}

// The custom gradient on the plain paper: Sky to Lavender.
const CUSTOM_GRADIENT_START = { from: '#e0f2fe', to: '#ede9fe' };

/** Where a new custom gradient starts: the page's current gradient, else its solid colour to a
 *  deepened version of it, else Sky to Lavender, at the presets' angle. */
export function customGradientSeed(fill: PageFill | undefined): PageFill {
  if (fill?.kind === 'gradient') return fill;
  if (fill?.kind === 'solid') return gradientFill({ from: fill.color, to: shade(fill.color, 0.3) });
  return gradientFill(CUSTOM_GRADIENT_START);
}
