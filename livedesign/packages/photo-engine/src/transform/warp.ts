// Free Transform's resample (docs/specs/031-photo/photo-tools.md "Moving and transforming"): a
// raster mapped by a matrix (affine or perspective), sampled once from the original pixels.
import { createRaster, type Raster } from '../raster/raster';
import { invert, transformedBounds, type Matrix } from './matrix';
import { sampleInto, type Interpolation } from './resample';

/** `src` under `m` (src pixel coordinates to destination ones): the picture and where its top-left
 *  sits in the destination. Null when `m` cannot be inverted (a box squashed flat). */
export function transformRaster(
  src: Raster,
  m: Matrix,
  how: Interpolation = 'bicubic',
): { raster: Raster; x: number; y: number } | null {
  const inv = invert(m);
  if (!inv) return null;
  const b = transformedBounds(m, src.width, src.height);
  const out = createRaster(Math.max(1, b.width), Math.max(1, b.height));
  const px = new Float64Array(4);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const dx = b.x + x + 0.5;
      const dy = b.y + y + 0.5;
      const w = inv[6] * dx + inv[7] * dy + inv[8];
      if (w <= 0) continue;
      const sx = (inv[0] * dx + inv[1] * dy + inv[2]) / w;
      const sy = (inv[3] * dx + inv[4] * dy + inv[5]) / w;
      if (sx < -1 || sy < -1 || sx > src.width + 1 || sy > src.height + 1) continue;
      sampleInto(src, sx, sy, how, px);
      out.data.set(px, (y * out.width + x) * 4);
    }
  return { raster: out, x: b.x, y: b.y };
}
