// Resampling (docs/specs/031-photo/photo-pages.md "Changing the size"): Bicubic (Keys, a = -0.5,
// DEFAULTS D3), Bilinear and Nearest Neighbour, premultiplied so a transparent edge brings no dark
// fringe in; shrinking past half averages the area first.
import { createRaster, type Raster } from '../raster/raster';

export type Interpolation = 'bicubic' | 'bilinear' | 'nearest';

const A = -0.5;
function cubic(t: number): number {
  const x = Math.abs(t);
  if (x <= 1) return (A + 2) * x * x * x - (A + 3) * x * x + 1;
  if (x < 2) return A * x * x * x - 5 * A * x * x + 8 * A * x - 4 * A;
  return 0;
}

/** The colour at (x, y) in pixel-centre coordinates (the centre of pixel i is i + 0.5), into
 *  `out` as straight RGBA bytes; outside the raster is transparent. */
export function sampleInto(
  src: Raster,
  x: number,
  y: number,
  how: Interpolation,
  out: Float64Array,
): void {
  const w = src.width;
  const h = src.height;
  const d = src.data;
  if (how === 'nearest') {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= w || py >= h) {
      out.fill(0);
      return;
    }
    const i = (py * w + px) * 4;
    out[0] = d[i]!;
    out[1] = d[i + 1]!;
    out[2] = d[i + 2]!;
    out[3] = d[i + 3]!;
    return;
  }
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  const reach = how === 'bicubic' ? 2 : 1;
  const start = how === 'bicubic' ? -1 : 0;
  for (let j = start; j <= reach; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= h) continue;
    const wy = how === 'bicubic' ? cubic(j - ty) : j === 0 ? 1 - ty : ty;
    if (wy === 0) continue;
    for (let i = start; i <= reach; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= w) continue;
      const wx = how === 'bicubic' ? cubic(i - tx) : i === 0 ? 1 - tx : tx;
      const k = wx * wy;
      if (k === 0) continue;
      const o = (yy * w + xx) * 4;
      const pa = d[o + 3]!;
      r += d[o]! * pa * k;
      g += d[o + 1]! * pa * k;
      b += d[o + 2]! * pa * k;
      a += pa * k;
    }
  }
  if (a <= 0) {
    out.fill(0);
    return;
  }
  out[0] = r / a;
  out[1] = g / a;
  out[2] = b / a;
  out[3] = Math.min(255, a);
}

/** The raster shrunk by whole factors by averaging each block (premultiplied). */
function boxDown(src: Raster, fx: number, fy: number): Raster {
  const w = Math.max(1, Math.floor(src.width / fx));
  const h = Math.max(1, Math.floor(src.height / fy));
  const out = createRaster(w, h);
  const d = src.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let j = 0; j < fy; j++) {
        const sy = y * fy + j;
        if (sy >= src.height) break;
        for (let i = 0; i < fx; i++) {
          const sx = x * fx + i;
          if (sx >= src.width) break;
          const o = (sy * src.width + sx) * 4;
          const pa = d[o + 3]!;
          r += d[o]! * pa;
          g += d[o + 1]! * pa;
          b += d[o + 2]! * pa;
          a += pa;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
        out.data[o + 3] = a / n;
      }
    }
  return out;
}

/** The raster resized to `w` x `h`. */
export function resizeRaster(
  src: Raster,
  w: number,
  h: number,
  how: Interpolation = 'bicubic',
): Raster {
  let from = src;
  if (how !== 'nearest') {
    // Average down to within twice the target first, so a large shrink is smooth.
    const fx = Math.floor(src.width / w / 2);
    const fy = Math.floor(src.height / h / 2);
    if (fx >= 2 || fy >= 2) from = boxDown(src, Math.max(1, fx), Math.max(1, fy));
  }
  const out = createRaster(w, h);
  const sx = from.width / w;
  const sy = from.height / h;
  const px = new Float64Array(4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      sampleInto(from, (x + 0.5) * sx, (y + 0.5) * sy, how, px);
      out.data.set(px, (y * w + x) * 4);
    }
  return out;
}
