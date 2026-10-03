// What an Infographic page is painted with (docs/specs/007-editor/infographic-pages.md
// "Backgrounds"): the panel's preset catalogue, and the CSS a sheet takes from its background. The
// export paints the same background onto its own canvas (export-page).
import {
  pageIsDark,
  type InfographicPage,
  type PageBackground,
  type PageFill,
  type PagePattern,
} from '@livediagram/document';
import type { CSSProperties } from 'react';

export type SolidPreset = { id: string; label: string; color: string | null };
export type GradientPreset = { id: string; label: string; from: string; to: string };

// Light to dark. Paper is the page's own default (no fill stored).
export const PAGE_SOLID_PRESETS: readonly SolidPreset[] = [
  { id: 'paper', label: 'Paper', color: null },
  { id: 'cream', label: 'Cream', color: '#fbf7ef' },
  { id: 'mist', label: 'Mist', color: '#f1f5f9' },
  { id: 'sky', label: 'Sky', color: '#e0f2fe' },
  { id: 'mint', label: 'Mint', color: '#dcfce7' },
  { id: 'lavender', label: 'Lavender', color: '#ede9fe' },
  { id: 'blush', label: 'Blush', color: '#fce7f3' },
  { id: 'sunshine', label: 'Sunshine', color: '#fef9c3' },
  { id: 'ink', label: 'Ink', color: '#1e293b' },
  { id: 'midnight', label: 'Midnight', color: '#0f172a' },
  { id: 'forest', label: 'Forest', color: '#14532d' },
  { id: 'plum', label: 'Plum', color: '#3b0764' },
];

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
export function pageSheetStyle(background: PageBackground | undefined): CSSProperties {
  const fill = background?.fill;
  const style: CSSProperties = {};
  const images: string[] = [];
  const sizes: string[] = [];
  if (background?.pattern) {
    const layer = patternLayers(background.pattern);
    images.push(layer.image);
    sizes.push(layer.size);
  }
  if (fill?.kind === 'gradient') {
    images.push(fillCss(fill));
    sizes.push('100% 100%');
  } else if (fill?.kind === 'solid') {
    style.backgroundColor = fill.color;
  }
  if (images.length) {
    style.backgroundImage = images.join(', ');
    style.backgroundSize = sizes.join(', ');
  }
  if (fill) {
    style.color = pageIsDark({ background }) ? 'rgb(255 255 255 / 0.14)' : 'rgb(15 23 42 / 0.1)';
  }
  return style;
}

/** The page with `patch` laid over its background (a hover preview, or an edit about to land). */
export function withBackgroundPatch(
  page: InfographicPage,
  patch: Partial<PageBackground> | undefined,
): PageBackground | undefined {
  if (!patch) return page.background;
  const merged: PageBackground = { ...page.background, ...patch };
  if (!merged.fill) delete merged.fill;
  if (!merged.pattern) delete merged.pattern;
  return merged.fill || merged.pattern ? merged : undefined;
}
