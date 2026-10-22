// Filling (docs/specs/031-photo/photo-tools.md "Fills and gradients", "Retouching" Fill…): the Paint
// Bucket's like-coloured area, a fill of a selection with a colour, and the Gradient tool's drag, each
// drawn onto a layer by a blend mode and opacity within the selection.
import { blendSpan } from '../colour/blend';
import type { BlendMode, Gradient, GradientStyle, Point } from '../model/types';
import { maskBounds, type Mask8 } from '../raster/mask';
import { createRaster, type Raster, type Rect } from '../raster/raster';
import { antiAliasEdge, floodSelect } from '../select/flood';
import { renderGradient } from './gradient';

/** `src` (photo coordinates at `rect`) blended onto `dst` (a raster at `at` in photo coordinates),
 *  by mode and opacity, times `coverage` (photo-coordinate mask) when given. */
export function blendOnto(
  dst: Raster,
  at: Point,
  src: Raster,
  rect: Rect,
  mode: BlendMode,
  opacity: number,
  coverage?: Mask8 | null,
): void {
  const cov = new Uint8Array(rect.width);
  for (let y = 0; y < rect.height; y++) {
    const dy = rect.y + y - at.y;
    if (dy < 0 || dy >= dst.height) continue;
    let x0 = 0;
    let x1 = rect.width;
    x0 = Math.max(x0, at.x - rect.x);
    x1 = Math.min(x1, at.x + dst.width - rect.x);
    if (x1 <= x0) continue;
    for (let x = x0; x < x1; x++) {
      if (!coverage) {
        cov[x] = 255;
        continue;
      }
      const mx = rect.x + x - coverage.x;
      const my = rect.y + y - coverage.y;
      cov[x] =
        mx < 0 || my < 0 || mx >= coverage.width || my >= coverage.height
          ? 0
          : coverage.data[my * coverage.width + mx]!;
    }
    blendSpan(
      dst.data,
      (dy * dst.width + (rect.x + x0 - at.x)) * 4,
      src.data,
      (y * rect.width + x0) * 4,
      x1 - x0,
      mode,
      opacity,
      cov,
      x0,
    );
  }
}

/** A solid colour over a rect. */
export function colourRaster(rect: Rect, rgb: readonly number[]): Raster {
  const r = createRaster(rect.width, rect.height);
  for (let i = 0; i < r.data.length; i += 4) {
    r.data[i] = rgb[0]!;
    r.data[i + 1] = rgb[1]!;
    r.data[i + 2] = rgb[2]!;
    r.data[i + 3] = 255;
  }
  return r;
}

export type FillPaint = { mode?: BlendMode; opacity?: number; selection?: Mask8 | null };
export type BucketOptions = FillPaint & {
  tolerance?: number;
  contiguous?: boolean;
  antiAlias?: boolean;
};
export type GradientFillOptions = FillPaint & { reverse?: boolean; dither?: boolean };

/** The Paint Bucket's area: the pixels like the one at `p` in `sample` (photo-sized from (0, 0)),
 *  anti-aliased and kept within the selection. */
export function bucketRegion(
  sample: Raster,
  p: Point,
  {
    tolerance = 32,
    contiguous = true,
    antiAlias = true,
    selection = null,
  }: Omit<BucketOptions, 'mode' | 'opacity'> = {},
): Mask8 {
  let region = floodSelect(sample, Math.floor(p.x), Math.floor(p.y), { tolerance, contiguous });
  if (antiAlias) region = antiAliasEdge(region);
  if (selection) {
    for (let y = 0; y < region.height; y++)
      for (let x = 0; x < region.width; x++) {
        const sx = x - selection.x;
        const sy = y - selection.y;
        const s =
          sx < 0 || sy < 0 || sx >= selection.width || sy >= selection.height
            ? 0
            : selection.data[sy * selection.width + sx]!;
        region.data[y * region.width + x] = (region.data[y * region.width + x]! * s) / 255;
      }
  }
  return region;
}

/** The Paint Bucket: the area like the pixel at `p` (sampled from `sample`, the layer or the
 *  composite, both photo-sized from (0, 0)) filled on `layer` (at `at`), within the selection. Answers
 *  the filled area's bounds, or null when nothing was filled. */
export function bucketFill(
  layer: Raster,
  at: Point,
  sample: Raster,
  p: Point,
  colour: readonly number[],
  { mode = 'normal', opacity = 1, ...rest }: BucketOptions = {},
): Rect | null {
  const region = bucketRegion(sample, p, rest);
  const b = maskBounds(region);
  if (!b) return null;
  blendOnto(layer, at, colourRaster(b, colour), b, mode, opacity, region);
  return b;
}

/** The Gradient tool: the gradient from `from` to `to` drawn over the selection (else the whole
 *  layer's photo-sized rect `bounds`). */
export function gradientFill(
  layer: Raster,
  at: Point,
  bounds: Rect,
  gradient: Gradient,
  style: GradientStyle,
  from: Point,
  to: Point,
  {
    reverse = false,
    dither = true,
    mode = 'normal',
    opacity = 1,
    selection = null,
  }: GradientFillOptions = {},
): Rect {
  const rect = selection
    ? { x: selection.x, y: selection.y, width: selection.width, height: selection.height }
    : bounds;
  const g = renderGradient(gradient, style, from, to, rect, { reverse, dither });
  blendOnto(layer, at, g, rect, mode, opacity, selection);
  return rect;
}
