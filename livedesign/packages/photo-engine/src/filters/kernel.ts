// Blur primitives shared by the filters, the layer effects and the selection's feather
// (docs/specs/031-photo/blueprints/DEFAULTS.md D4): an exact separable Gaussian up to a sigma of 2.5,
// four box passes past it (constant time a pixel whatever the radius), and a premultiplied RGBA blur so a transparent edge never darkens.
import { createRaster, type Raster } from '../raster/raster';

export type Plane = { width: number; height: number; data: Float32Array };

export function planeFrom(width: number, height: number, values?: ArrayLike<number>): Plane {
  const data = new Float32Array(width * height);
  if (values) for (let i = 0; i < data.length; i++) data[i] = values[i]!;
  return { width, height, data };
}

/** A running-sum box blur of half-width `r` along each row, edges repeated. */
function boxRows(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    const first = src[base]!;
    const last = src[base + w - 1]!;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += k < 0 ? first : k >= w ? last : src[base + k]!;
    for (let x = 0; x < w; x++) {
      dst[base + x] = acc * inv;
      const out = x - r;
      const inn = x + r + 1;
      acc += (inn < w ? src[base + inn]! : last) - (out >= 0 ? src[base + out]! : first);
    }
  }
}

/** The same down each column, a row at a time (a running sum per column), so memory is read in
 *  order. */
function boxCols(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  const acc = new Float32Array(w);
  const rowAt = (y: number) => (y < 0 ? 0 : y >= h ? (h - 1) * w : y * w);
  for (let k = -r; k <= r; k++) {
    const o = rowAt(k);
    for (let x = 0; x < w; x++) acc[x]! += src[o + x]!;
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    const inn = rowAt(y + r + 1);
    const out = rowAt(y - r);
    for (let x = 0; x < w; x++) {
      dst[o + x] = acc[x]! * inv;
      acc[x]! += src[inn + x]! - src[out + x]!;
    }
  }
}

/** Box widths for three passes approximating a Gaussian of `sigma` (Kovesi's method). */
export function boxesForGauss(sigma: number, n = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

export function boxBlurPlane(p: Plane, r: number): Plane {
  if (r <= 0) return p;
  const tmp = new Float32Array(p.data.length);
  const out = new Float32Array(p.data.length);
  boxRows(p.data, tmp, p.width, p.height, r);
  boxCols(tmp, out, p.width, p.height, r);
  return { width: p.width, height: p.height, data: out };
}

// The sigma up to which the exact kernel is used.
const EXACT_SIGMA = 2.5;
// Box passes past it: four keep within about one level of the exact blur.
const BOX_PASSES = 4;

export function gaussianKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i]! /= sum;
  return k;
}

function convolvePass(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  k: Float32Array,
  horizontal: boolean,
) {
  const r = (k.length - 1) / 2;
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 1 : w;
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w : line;
    for (let i = 0; i < len; i++) {
      let acc = 0;
      for (let j = -r; j <= r; j++) {
        const at = i + j < 0 ? 0 : i + j >= len ? len - 1 : i + j;
        acc += src[base + at * step]! * k[j + r]!;
      }
      dst[base + i * step] = acc;
    }
  }
}

/** A Gaussian blur of `sigma` px (edges repeated). */
export function gaussianBlurPlane(p: Plane, sigma: number): Plane {
  if (sigma < 0.1) return p;
  const tmp = new Float32Array(p.data.length);
  if (sigma <= EXACT_SIGMA) {
    const k = gaussianKernel(sigma);
    const out = new Float32Array(p.data.length);
    convolvePass(p.data, tmp, p.width, p.height, k, true);
    convolvePass(tmp, out, p.width, p.height, k, false);
    return { width: p.width, height: p.height, data: out };
  }
  // Every pass reuses the same two buffers: allocating one a pass dominated the time.
  const a = new Float32Array(p.data);
  for (const w of boxesForGauss(sigma, BOX_PASSES)) {
    const r = (w - 1) / 2;
    if (r <= 0) continue;
    boxRows(a, tmp, p.width, p.height, r);
    boxCols(tmp, a, p.width, p.height, r);
  }
  return { width: p.width, height: p.height, data: a };
}

/** The raster's four channels as planes, premultiplied by alpha (0..1 each). */
export function premultipliedPlanes(r: Raster): [Plane, Plane, Plane, Plane] {
  const n = r.width * r.height;
  const planes = [0, 1, 2, 3].map(() => planeFrom(r.width, r.height)) as [
    Plane,
    Plane,
    Plane,
    Plane,
  ];
  const d = r.data;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3]! / 255;
    planes[0].data[i] = (d[i * 4]! / 255) * a;
    planes[1].data[i] = (d[i * 4 + 1]! / 255) * a;
    planes[2].data[i] = (d[i * 4 + 2]! / 255) * a;
    planes[3].data[i] = a;
  }
  return planes;
}

/** Premultiplied planes back to a straight RGBA raster. */
export function rasterFromPremultiplied(planes: readonly Plane[]): Raster {
  const [pr, pg, pb, pa] = planes as [Plane, Plane, Plane, Plane];
  const out = createRaster(pr.width, pr.height);
  const d = out.data;
  for (let i = 0; i < pr.data.length; i++) {
    const a = pa.data[i]!;
    if (a <= 0) continue;
    d[i * 4] = (pr.data[i]! / a) * 255;
    d[i * 4 + 1] = (pg.data[i]! / a) * 255;
    d[i * 4 + 2] = (pb.data[i]! / a) * 255;
    d[i * 4 + 3] = a * 255;
  }
  return out;
}

/** A box blur of half-width `r` along the rows of interleaved RGBA floats, edges repeated. */
function boxRows4(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const base = y * w * 4;
    const last = base + (w - 1) * 4;
    let a0 = 0;
    let a1 = 0;
    let a2 = 0;
    let a3 = 0;
    for (let k = -r; k <= r; k++) {
      const o = k < 0 ? base : k >= w ? last : base + k * 4;
      a0 += src[o]!;
      a1 += src[o + 1]!;
      a2 += src[o + 2]!;
      a3 += src[o + 3]!;
    }
    for (let x = 0; x < w; x++) {
      const o = base + x * 4;
      dst[o] = a0 * inv;
      dst[o + 1] = a1 * inv;
      dst[o + 2] = a2 * inv;
      dst[o + 3] = a3 * inv;
      const inn = x + r + 1 < w ? base + (x + r + 1) * 4 : last;
      const out = x - r >= 0 ? base + (x - r) * 4 : base;
      a0 += src[inn]! - src[out]!;
      a1 += src[inn + 1]! - src[out + 1]!;
      a2 += src[inn + 2]! - src[out + 2]!;
      a3 += src[inn + 3]! - src[out + 3]!;
    }
  }
}

/** The same down the columns, a row at a time. */
function boxCols4(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  const n = w * 4;
  const acc = new Float32Array(n);
  const rowAt = (y: number) => (y < 0 ? 0 : y >= h ? (h - 1) * n : y * n);
  for (let k = -r; k <= r; k++) {
    const o = rowAt(k);
    for (let i = 0; i < n; i++) acc[i]! += src[o + i]!;
  }
  for (let y = 0; y < h; y++) {
    const o = y * n;
    const inn = rowAt(y + r + 1);
    const out = rowAt(y - r);
    for (let i = 0; i < n; i++) {
      dst[o + i] = acc[i]! * inv;
      acc[i]! += src[inn + i]! - src[out + i]!;
    }
  }
}

/** A Gaussian blur of an RGBA raster, premultiplied so transparent pixels carry no colour in. */
export function gaussianBlurRaster(r: Raster, sigma: number): Raster {
  if (sigma < 0.1) return r;
  if (sigma <= EXACT_SIGMA)
    return rasterFromPremultiplied(premultipliedPlanes(r).map((p) => gaussianBlurPlane(p, sigma)));
  const n = r.width * r.height;
  const a = new Float32Array(n * 4);
  const d = r.data;
  for (let i = 0; i < n; i++) {
    const al = d[i * 4 + 3]!;
    const k = al / 255;
    a[i * 4] = d[i * 4]! * k;
    a[i * 4 + 1] = d[i * 4 + 1]! * k;
    a[i * 4 + 2] = d[i * 4 + 2]! * k;
    a[i * 4 + 3] = al;
  }
  const tmp = new Float32Array(n * 4);
  for (const w of boxesForGauss(sigma, BOX_PASSES)) {
    const rad = (w - 1) / 2;
    if (rad <= 0) continue;
    boxRows4(a, tmp, r.width, r.height, rad);
    boxCols4(tmp, a, r.width, r.height, rad);
  }
  const out = createRaster(r.width, r.height);
  const o = out.data;
  for (let i = 0; i < n; i++) {
    const al = a[i * 4 + 3]!;
    if (al <= 0) continue;
    const k = 255 / al;
    o[i * 4] = a[i * 4]! * k;
    o[i * 4 + 1] = a[i * 4 + 1]! * k;
    o[i * 4 + 2] = a[i * 4 + 2]! * k;
    o[i * 4 + 3] = al;
  }
  return out;
}

/** A raster's alpha as a plane (0..1). */
export function alphaPlane(r: Raster): Plane {
  const p = planeFrom(r.width, r.height);
  for (let i = 0; i < p.data.length; i++) p.data[i] = r.data[i * 4 + 3]! / 255;
  return p;
}

/** A raster's luma as a plane (0..1). */
export function lumaPlane(r: Raster): Plane {
  const p = planeFrom(r.width, r.height);
  const d = r.data;
  for (let i = 0; i < p.data.length; i++)
    p.data[i] = (0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!) / 255;
  return p;
}
