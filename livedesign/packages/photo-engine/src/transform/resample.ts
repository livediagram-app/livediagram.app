// Resampling (docs/specs/031-photo/photo-pages.md "Changing the size"): Bicubic (Keys, a = -0.5,
// DEFAULTS D3), Bilinear and Nearest Neighbour, premultiplied so a transparent edge brings no dark
// fringe in; shrinking past half averages the area first.
import { createRaster, type Raster, type Rect } from '../raster/raster';

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

/** How resizeRaster takes a `width` x `height` picture to `w` x `h`: the whole-block average first (`bx`, `by`;
 *  1 for none), the averaged size, and the step from one output pixel to the next in it. */
export type ResizePlan = {
  width: number;
  height: number;
  w: number;
  h: number;
  how: Interpolation;
  bx: number;
  by: number;
  fromW: number;
  fromH: number;
  sx: number;
  sy: number;
};

export function resizePlan(
  width: number,
  height: number,
  w: number,
  h: number,
  how: Interpolation = 'bicubic',
): ResizePlan {
  let bx = 1;
  let by = 1;
  if (how !== 'nearest') {
    const fx = Math.floor(width / w / 2);
    const fy = Math.floor(height / h / 2);
    if (fx >= 2 || fy >= 2) {
      bx = Math.max(1, fx);
      by = Math.max(1, fy);
    }
  }
  const fromW = bx > 1 || by > 1 ? Math.max(1, Math.floor(width / bx)) : width;
  const fromH = bx > 1 || by > 1 ? Math.max(1, Math.floor(height / by)) : height;
  return { width, height, w, h, how, bx, by, fromW, fromH, sx: fromW / w, sy: fromH / h };
}

// The averaged picture's pixels one output span reads, [lo, hi): the filter's reach (two either side for
// Bicubic) past the first and last sample, kept inside the averaged picture.
function span(o0: number, o1: number, step: number, size: number): [number, number] {
  const lo = Math.max(0, Math.floor((o0 + 0.5) * step - 0.5) - 2);
  const hi = Math.min(size, Math.floor((o1 - 0.5) * step - 0.5) + 3);
  return [lo, Math.max(lo, hi)];
}

/** The source pixels (relative to the picture's top left) that output rect `out` of resizeRaster reads: what
 *  resizeRegion needs to draw it. Whole averaging blocks, so the region averages as the whole picture does. */
export function resizeSourceRect(plan: ResizePlan, out: Rect): Rect {
  const [x0, x1] = span(out.x, out.x + out.width, plan.sx, plan.fromW);
  const [y0, y1] = span(out.y, out.y + out.height, plan.sy, plan.fromH);
  return {
    x: x0 * plan.bx,
    y: y0 * plan.by,
    width: Math.min(plan.width - x0 * plan.bx, (x1 - x0) * plan.bx),
    height: Math.min(plan.height - y0 * plan.by, (y1 - y0) * plan.by),
  };
}

/** Output rect `out` of resizeRaster(picture, plan.w, plan.h, plan.how), drawn from `region` alone: the picture's
 *  pixels in resizeSourceRect(plan, out). The same pixels as the whole resize gives there, so a large picture can be
 *  resized a tile at a time without ever being held whole (Make Sizes, docs/specs/031-photo/photo-pages.md). */
export function resizeRegion(region: Raster, plan: ResizePlan, out: Rect): Raster {
  const src = resizeSourceRect(plan, out);
  const from = plan.bx > 1 || plan.by > 1 ? boxDown(region, plan.bx, plan.by) : region;
  const ox = src.x / plan.bx;
  const oy = src.y / plan.by;
  const tile = createRaster(out.width, out.height);
  const px = new Float64Array(4);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      sampleInto(
        from,
        (out.x + x + 0.5) * plan.sx - ox,
        (out.y + y + 0.5) * plan.sy - oy,
        plan.how,
        px,
      );
      tile.data.set(px, (y * out.width + x) * 4);
    }
  return tile;
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
