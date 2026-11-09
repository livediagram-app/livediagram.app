// Text effects in exports (docs/specs/008-canvas/text-effects.md "Rendering"; blueprint "Export runs"): a
// highlighted fragment's marker band and a gradient fragment's fill, placed from the same measures that
// wrap the label. Shared by the SVG emitter (rects and linearGradient defs) and the PNG drawer
// (fillRect and createLinearGradient), so the two put a band in the same place.

import {
  HIGHLIGHT_BAND_BOTTOM,
  HIGHLIGHT_BAND_TOP,
  HIGHLIGHT_PAD_EM,
  HIGHLIGHT_RADIUS_EM,
  isHighlightColour,
  textGradientOf,
} from './text-effects';
import { r2, xmlEscape } from './svg-render-primitives';

// What a resolved export run carries for its effects, unknown values already dropped.
export type ExportRunEffects = {
  highlight?: string;
  gradient?: { from: string; to: string };
};

/** A run's effects as an export draws them: only the values a renderer knows. */
export function exportRunEffects(run: { highlight?: unknown; gradient?: unknown }): ExportRunEffects {
  const g = textGradientOf(run.gradient);
  return {
    ...(isHighlightColour(run.highlight) ? { highlight: run.highlight } : {}),
    ...(g ? { gradient: { from: g.from, to: g.to } } : {}),
  };
}

/** Whether two fragments draw the same effects, so the wrap may merge them. */
export function sameEffects(a: ExportRunEffects, b: ExportRunEffects): boolean {
  return (
    a.highlight === b.highlight &&
    a.gradient?.from === b.gradient?.from &&
    a.gradient?.to === b.gradient?.to
  );
}

// The line box a band is a fraction of: the run's size at the canvas's label leading.
const BAND_LINE_BOX = 1.25;

/** A fragment's band: `lineY` is the line's central baseline, `x` / `width` the fragment's words. */
export function highlightBandRect(
  lineY: number,
  size: number,
  x: number,
  width: number,
): { x: number; y: number; width: number; height: number; radius: number } {
  const box = size * BAND_LINE_BOX;
  const top = lineY - box / 2;
  const pad = size * HIGHLIGHT_PAD_EM;
  return {
    x: x - pad,
    y: top + box * HIGHLIGHT_BAND_TOP,
    width: width + pad * 2,
    height: box * (HIGHLIGHT_BAND_BOTTOM - HIGHLIGHT_BAND_TOP),
    radius: size * HIGHLIGHT_RADIUS_EM,
  };
}

// A def id from the element id, safe as an XML name.
export function textEffectIdPrefix(elementId: string): string {
  return `tg-${elementId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** One fragment of a laid-out line: where its words start and how wide they are. */
export type PlacedFragment = { x: number; width: number; size: number } & ExportRunEffects;

/**
 * A line's effects as SVG: its bands (drawn before the text) and its gradient defs, with the fill
 * each fragment takes (`url(#…)`, or null to keep its colour). `next` numbers the defs across the
 * label so ids stay unique and deterministic.
 */
export function svgLineEffects(
  fragments: readonly PlacedFragment[],
  lineY: number,
  idPrefix: string,
  next: { n: number },
): { bands: string; defs: string; fills: (string | null)[] } {
  let bands = '';
  let defs = '';
  const fills = fragments.map((f) => {
    if (f.highlight && f.width > 0) {
      const b = highlightBandRect(lineY, f.size, f.x, f.width);
      bands +=
        `<rect x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.width)}" height="${r2(b.height)}"` +
        ` rx="${r2(b.radius)}" fill="${xmlEscape(f.highlight)}"/>`;
    }
    if (!f.gradient || f.width <= 0) return null;
    const id = `${idPrefix}-${next.n++}`;
    defs +=
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(f.x)}" y1="0" x2="${r2(f.x + f.width)}" y2="0">` +
      `<stop offset="0" stop-color="${xmlEscape(f.gradient.from)}"/>` +
      `<stop offset="1" stop-color="${xmlEscape(f.gradient.to)}"/></linearGradient>`;
    return `url(#${id})`;
  });
  return { bands, defs, fills };
}
