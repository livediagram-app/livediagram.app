// What an Illustrate page is painted with (docs/specs/007-editor/illustrate-pages.md
// "Backgrounds"): the panel's preset catalogue, and the CSS a sheet takes from its background. The
// export paints the same background onto its own canvas (export-page).
import {
  isLightColor,
  pageIsDark,
  shade,
  tint,
  type ThemeDefinition,
  type IllustratePage,
  type PageBackground,
  type PageFill,
  type PagePattern,
} from '@livediagram/document';
import type { CSSProperties } from 'react';

export type GradientPreset = { id: string; label: string; from: string; to: string };

export const PAGE_GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: 'sunrise', label: 'Sunrise', from: '#fde68a', to: '#fca5a5' },
  { id: 'ocean', label: 'Ocean', from: '#bae6fd', to: '#c7d2fe' },
  { id: 'meadow', label: 'Meadow', from: '#bbf7d0', to: '#a5f3fc' },
  { id: 'peach', label: 'Peach', from: '#fed7aa', to: '#fecdd3' },
  { id: 'dusk', label: 'Dusk', from: '#1e1b4b', to: '#4c1d95' },
  { id: 'night', label: 'Night', from: '#0f172a', to: '#1e3a8a' },
];

// CSS degrees: 180 runs top to bottom, so 160 leans the run toward the bottom right.
export const PAGE_GRADIENT_ANGLE = 160;

export const PAGE_PATTERN_LABEL: Record<PagePattern | 'none', string> = {
  none: 'None',
  dots: 'Dots',
  grid: 'Grid',
  lines: 'Lines',
};

// The pattern's pitch in canvas px.
export const PAGE_PATTERN_PITCH = 24;

export const gradientFill = (p: Pick<GradientPreset, 'from' | 'to'>): PageFill => ({
  kind: 'gradient',
  from: p.from,
  to: p.to,
  angle: PAGE_GRADIENT_ANGLE,
});

/** The CSS `background` of a fill: a colour, or a linear gradient. */
export function fillCss(fill: PageFill): string {
  return fill.kind === 'solid'
    ? fill.color
    : `linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`;
}

/** Whether two fills are the same (a preset's swatch shows as chosen). */
export function sameFill(a: PageFill | undefined, b: PageFill | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind === 'solid' && b.kind === 'solid')
    return a.color.toLowerCase() === b.color.toLowerCase();
  if (a.kind === 'gradient' && b.kind === 'gradient') {
    return a.from === b.from && a.to === b.to && a.angle === b.angle;
  }
  return false;
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
 * `color` is that ink, so the pattern reads on any fill.
 */
export function pageSheetStyle(
  background: PageBackground | undefined,
  // An article page's ruling (docs/specs/007-editor/article-pages.md "Article style"): its Lines
  // drawn at its body line pitch inside its margins, on the writing's baselines.
  ruling?: { pitch: number; inset: number; top: number },
): CSSProperties {
  const fill = background?.fill;
  const style: CSSProperties = {};
  const images: string[] = [];
  const sizes: string[] = [];
  const clips: string[] = [];
  if (background?.pattern) {
    const layer = patternLayers(background.pattern);
    images.push(layer.image);
    if (ruling && background.pattern === 'lines') {
      sizes.push(`100% ${ruling.pitch}px`);
      clips.push('content-box');
      style.padding = `${ruling.top}px ${ruling.inset}px ${ruling.inset}px`;
      style.backgroundOrigin = 'content-box';
    } else {
      sizes.push(layer.size);
      clips.push('border-box');
    }
  }
  if (fill?.kind === 'gradient') {
    images.push(fillCss(fill));
    sizes.push('100% 100%');
    clips.push('border-box');
  } else if (fill?.kind === 'solid') {
    style.backgroundColor = fill.color;
  }
  if (images.length) {
    // The colour paints under the last layer's clip: a clear last layer keeps it to the border.
    if (clips[clips.length - 1] === 'content-box') {
      images.push('linear-gradient(transparent, transparent)');
      sizes.push('100% 100%');
      clips.push('border-box');
    }
    style.backgroundImage = images.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundClip = clips.join(', ');
    style.backgroundRepeat = 'repeat';
  }
  if (fill) style.color = pagePatternInk(background);
  return style;
}

/** The pattern's ink on a page: faint white on a dark fill, faint slate on a light one (and on the
 *  plain paper, whose sheet sets it by class on screen). */
export function pagePatternInk(background: PageBackground | undefined): string {
  return pageIsDark({ background }) ? 'rgb(255 255 255 / 0.14)' : 'rgb(15 23 42 / 0.1)';
}

/** The page with `patch` laid over its background (a hover preview, or an edit about to land). */
export function withBackgroundPatch(
  page: IllustratePage,
  patch: Partial<PageBackground> | undefined,
): PageBackground | undefined {
  if (!patch) return page.background;
  const merged: PageBackground = { ...page.background, ...patch };
  if (!merged.fill) delete merged.fill;
  if (!merged.pattern) delete merged.pattern;
  return merged.fill || merged.pattern ? merged : undefined;
}

export type ThemeBackgroundPreset = { id: string; label: string; fill: PageFill };

// The accent a theme without its own stroke paints in (the brand blue).
const FALLBACK_ACCENT = '#0ea5e9';
const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The tab theme's accent: its element stroke, else its first palette colour, else the brand blue.
 *  What theme backgrounds and a document's accent are drawn from. */
export function themeAccent(theme: Pick<ThemeDefinition, 'elementStroke' | 'palette'>): string {
  return isHex(theme.elementStroke)
    ? theme.elementStroke
    : isHex(theme.palette?.[0]?.stroke)
      ? theme.palette![0]!.stroke
      : FALLBACK_ACCENT;
}

/**
 * Backgrounds drawn from the tab's theme (docs/specs/007-editor/illustrate-pages.md
 * "Backgrounds"), offered first: two pale tints of its accent, its own element fill (when it has
 * a light one of its own), a deep shade, and a light and a dark gradient running to its second
 * colour (a multi-colour theme's next branch, else a deeper accent). Pure: theme in, presets out.
 */
export function themeBackgroundPresets(
  theme: Pick<ThemeDefinition, 'elementStroke' | 'elementFill' | 'palette'>,
): ThemeBackgroundPreset[] {
  const accent = themeAccent(theme);
  const second = isHex(theme.palette?.[1]?.stroke)
    ? theme.palette![1]!.stroke
    : shade(accent, 0.25);
  const solid = (color: string): PageFill => ({ kind: 'solid', color });
  const out: ThemeBackgroundPreset[] = [
    { id: 'theme-wash', label: 'Theme wash', fill: solid(tint(accent, 0.93)) },
    { id: 'theme-tint', label: 'Theme tint', fill: solid(tint(accent, 0.8)) },
  ];
  if (isHex(theme.elementFill) && isLightColor(theme.elementFill)) {
    out.push({
      id: 'theme-fill',
      label: 'Theme fill',
      fill: solid(theme.elementFill.toLowerCase()),
    });
  }
  out.push(
    { id: 'theme-deep', label: 'Theme deep', fill: solid(shade(accent, 0.6)) },
    {
      id: 'theme-glow',
      label: 'Theme glow',
      fill: gradientFill({ from: tint(accent, 0.85), to: tint(second, 0.7) }),
    },
    {
      id: 'theme-dusk',
      label: 'Theme dusk',
      fill: gradientFill({ from: shade(accent, 0.65), to: shade(second, 0.4) }),
    },
  );
  return out;
}

/** The Background section's categories (docs/specs/007-editor/illustrate-pages.md "Backgrounds"). */
export type BackgroundCategory = 'theme' | 'solid' | 'gradient';

/** The category a page's fill belongs to: a theme preset's Theme, any other gradient's Gradient,
 *  else Solid (the paper and every solid colour). */
export function backgroundCategoryOf(
  fill: PageFill | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): BackgroundCategory {
  if (fill && themePresets.some((t) => sameFill(fill, t.fill))) return 'theme';
  return fill?.kind === 'gradient' ? 'gradient' : 'solid';
}

/** Whether the fill is a gradient no preset (of the catalogue or the theme) names: a custom one. */
export function isCustomGradient(
  fill: PageFill | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): boolean {
  return (
    fill?.kind === 'gradient' &&
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
