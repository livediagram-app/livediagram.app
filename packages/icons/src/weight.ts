// Icon weight in on-screen pixels (docs/specs/004-interface-design/iconography.md, "Weight").
// Weight is specified as the stroke a person sees, never in viewBox units, so a glyph drawn on
// any grid at any size reads the same. No React here: ui, the editor and the Workers share it.

export const ICON_STROKE_PX = 1.25;
export const ICON_STROKE_PX_SMALL = 1;
export const ICON_SMALL_MAX_PX = 12;

export type GlyphSize = 12 | 14 | 16 | 20 | 24;
export const GLYPH_SIZES: readonly GlyphSize[] = [12, 14, 16, 20, 24];

// The on-screen stroke for a glyph rendered at `sizePx`.
export function glyphStrokePx(sizePx: number): number {
  return sizePx <= ICON_SMALL_MAX_PX ? ICON_STROKE_PX_SMALL : ICON_STROKE_PX;
}

// The `stroke-width` (viewBox units) that draws `px` on screen for a `units`-wide viewBox at `sizePx`.
export function strokeUnits(px: number, sizePx: number, units: number): number {
  if (!(sizePx > 0) || !(units > 0) || !Number.isFinite(sizePx) || !Number.isFinite(units)) {
    throw new RangeError('strokeUnits: size and units must be positive');
  }
  return (px * units) / sizePx;
}
