// Shared pieces of the filters: seeded randomness, value noise, sliding minimum and maximum, a
// sliding median, mapping a picture through a coordinate function, and mixing by a threshold.
import { createRaster, type Raster } from '../raster/raster';
import { sampleInto } from '../transform/resample';
import { checkpoint, type FilterContext } from './types';

/** A repeatable random number in [0, 1). */
export function rng(seed: number): () => number {
  let s = (seed >>> 0) ^ 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A unit normal sample from two uniform ones. */
export function gauss(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise at (x, y), 0..1. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise: octaves of value noise, each half the size and weight, 0..1. */
export function fractalNoise(x: number, y: number, seed: number, octaves = 6): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** The sliding minimum or maximum over a window of 2r+1 (van Herk / Gil-Werman), along a line. */
function slide(
  src: Uint8ClampedArray | Uint8Array,
  dst: Uint8ClampedArray | Uint8Array,
  start: number,
  step: number,
  n: number,
  r: number,
  max: boolean,
): void {
  const k = 2 * r + 1;
  const g = new Uint8Array(n + k);
  const h = new Uint8Array(n + k);
  const at = (i: number) => src[start + Math.min(n - 1, Math.max(0, i - r)) * step]!;
  const pick = max ? Math.max : Math.min;
  const len = n + 2 * r;
  for (let b = 0; b < len; b += k) {
    const e = Math.min(len, b + k);
    g[b] = at(b);
    for (let i = b + 1; i < e; i++) g[i] = pick(g[i - 1]!, at(i));
    h[e - 1] = at(e - 1);
    for (let i = e - 2; i >= b; i--) h[i] = pick(h[i + 1]!, at(i));
  }
  for (let i = 0; i < n; i++) dst[start + i * step] = pick(h[i]!, g[i + 2 * r] ?? h[i]!);
}

/** Each channel's minimum or maximum over a (2r+1) square, alpha kept. */
export function minMaxFilter(src: Raster, r: number, max: boolean): Raster {
  const out = createRaster(src.width, src.height);
  out.data.set(src.data);
  if (r < 1) return out;
  const w = src.width;
  const h = src.height;
  const tmp = new Uint8ClampedArray(src.data.length);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) slide(src.data, tmp, y * w * 4 + c, 4, w, r, max);
    for (let x = 0; x < w; x++) slide(tmp, out.data, x * 4 + c, w * 4, h, r, max);
  }
  return out;
}

/** Each channel's median over a (2r+1) square (Huang's sliding histogram), alpha kept. */
export function medianFilter(src: Raster, r: number, ctx?: FilterContext): Raster {
  const out = createRaster(src.width, src.height);
  out.data.set(src.data);
  if (r < 1) return out;
  const w = src.width;
  const h = src.height;
  const d = src.data;
  const half = ((2 * r + 1) * (2 * r + 1)) >> 1;
  const hist = new Int32Array(256);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      if (ctx && (y & 63) === 0) checkpoint(ctx, (c * h + y) / (3 * h));
      hist.fill(0);
      for (let j = -r; j <= r; j++) {
        const yy = Math.min(h - 1, Math.max(0, y + j));
        for (let i = -r; i <= r; i++)
          hist[d[(yy * w + Math.min(w - 1, Math.max(0, i))) * 4 + c]!]!++;
      }
      let med = 0;
      let below = 0;
      // Find the first median.
      for (let acc = 0; med < 256; med++) {
        if (acc + hist[med]! > half) break;
        acc += hist[med]!;
        below = acc;
      }
      out.data[y * w * 4 + c] = med;
      for (let x = 1; x < w; x++) {
        const xo = Math.min(w - 1, Math.max(0, x - r - 1));
        const xi = Math.min(w - 1, Math.max(0, x + r));
        for (let j = -r; j <= r; j++) {
          const yy = Math.min(h - 1, Math.max(0, y + j));
          const vo = d[(yy * w + xo) * 4 + c]!;
          const vi = d[(yy * w + xi) * 4 + c]!;
          hist[vo]!--;
          if (vo < med) below--;
          hist[vi]!++;
          if (vi < med) below++;
        }
        while (below > half) {
          med--;
          below -= hist[med]!;
        }
        while (below + hist[med]! <= half) {
          below += hist[med]!;
          med++;
        }
        out.data[(y * w + x) * 4 + c] = med;
      }
    }
  }
  return out;
}

/** The picture remapped: each output pixel's colour sampled (bilinear) from where `from` says,
 *  in source pixel-centre coordinates; null leaves it transparent. */
export function remap(
  src: Raster,
  from: (x: number, y: number) => { x: number; y: number } | null,
  ctx?: FilterContext,
): Raster {
  const out = createRaster(src.width, src.height);
  const px = new Float64Array(4);
  for (let y = 0; y < src.height; y++) {
    if (ctx && (y & 63) === 0) checkpoint(ctx, y / src.height);
    for (let x = 0; x < src.width; x++) {
      const p = from(x + 0.5, y + 0.5);
      if (!p) continue;
      // Edges repeat: a distortion never pulls in transparency.
      const sx = Math.min(src.width - 0.5, Math.max(0.5, p.x));
      const sy = Math.min(src.height - 0.5, Math.max(0.5, p.y));
      sampleInto(src, sx, sy, 'bilinear', px);
      out.data.set(px, (y * src.width + x) * 4);
    }
  }
  return out;
}

/** The centre a filter is placed by, in this raster's pixels (a run on part of the photo still
 *  centres on the photo's point). */
export function centreOf(
  src: Raster,
  at: { x: number; y: number },
  ctx: FilterContext,
): { x: number; y: number } {
  const p = ctx.photo;
  if (!p) return { x: at.x * src.width, y: at.y * src.height };
  return { x: at.x * p.width - p.x, y: at.y * p.height - p.y };
}
