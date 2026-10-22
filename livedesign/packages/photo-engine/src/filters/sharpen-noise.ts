// The Sharpen and Noise filters (docs/specs/031-photo/photo-adjustments.md "Filters"): Unsharp Mask,
// Sharpen, Sharpen More and High Pass; Add Noise, Reduce Noise, Median, Despeckle and Dust & Scratches.
import { createRaster, type Raster } from '../raster/raster';
import { gauss, medianFilter, rng } from './helpers';
import { gaussianBlurRaster } from './kernel';
import { checkpoint, choice, num, readParams, toggle, type FilterDef } from './types';

/** A 3 x 3 convolution of the colour channels (alpha kept), edges repeated. */
export function convolve3(src: Raster, k: readonly number[], scale = 1, offset = 0): Raster {
  const w = src.width;
  const h = src.height;
  const d = src.data;
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = -1; j <= 1; j++) {
          const yy = Math.min(h - 1, Math.max(0, y + j));
          for (let i = -1; i <= 1; i++) {
            const xx = Math.min(w - 1, Math.max(0, x + i));
            s += d[(yy * w + xx) * 4 + c]! * k[(j + 1) * 3 + i + 1]!;
          }
        }
        out.data[o + c] = s / scale + offset;
      }
      out.data[o + 3] = d[o + 3]!;
    }
  return out;
}

const unsharpSpecs = [
  num('amount', 'Amount', 1, 500, 100, 1, '%'),
  num('radius', 'Radius', 0.1, 250, 1, 0.1, 'px'),
  num('threshold', 'Threshold', 0, 255, 0, 1),
];
const highPassSpecs = [num('radius', 'Radius', 0.1, 250, 10, 0.1, 'px')];
const addNoiseSpecs = [
  num('amount', 'Amount', 0.1, 400, 12.5, 0.1, '%'),
  choice(
    'distribution',
    'Distribution',
    [
      ['uniform', 'Uniform'],
      ['gaussian', 'Gaussian'],
    ],
    'gaussian',
  ),
  toggle('monochromatic', 'Monochromatic', false),
];
const reduceSpecs = [
  num('strength', 'Strength', 0, 10, 6, 1),
  num('preserve', 'Preserve Details', 0, 100, 60, 1, '%'),
  num('colour', 'Reduce Colour Noise', 0, 100, 45, 1, '%'),
];
const medianSpecs = [num('radius', 'Radius', 1, 100, 1, 1, 'px')];
const dustSpecs = [
  num('radius', 'Radius', 1, 100, 1, 1, 'px'),
  num('threshold', 'Threshold', 0, 255, 0, 1),
];

export function unsharp(src: Raster, amount: number, radius: number, threshold: number): Raster {
  const blurred = gaussianBlurRaster(src, radius);
  const out = createRaster(src.width, src.height);
  const k = amount / 100;
  for (let i = 0; i < src.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = src.data[i + c]!;
      const diff = v - blurred.data[i + c]!;
      out.data[i + c] = Math.abs(diff) * 2 >= threshold ? v + diff * k : v;
    }
    out.data[i + 3] = src.data[i + 3]!;
  }
  return out;
}

export const SHARPEN_NOISE_FILTERS: FilterDef[] = [
  {
    id: 'unsharp-mask',
    name: 'Unsharp Mask',
    category: 'sharpen',
    params: unsharpSpecs,
    margin: (p) => Math.ceil((readParams(unsharpSpecs, p).radius as number) * 3),
    run: (src, p) => {
      const { amount, radius, threshold } = readParams(unsharpSpecs, p) as Record<string, number>;
      return unsharp(src, amount!, radius!, threshold!);
    },
  },
  {
    id: 'sharpen',
    name: 'Sharpen',
    category: 'sharpen',
    params: [],
    margin: () => 1,
    run: (src) => convolve3(src, [0, -1, 0, -1, 8, -1, 0, -1, 0], 4),
  },
  {
    id: 'sharpen-more',
    name: 'Sharpen More',
    category: 'sharpen',
    params: [],
    margin: () => 1,
    run: (src) => convolve3(src, [-1, -1, -1, -1, 12, -1, -1, -1, -1], 4),
  },
  {
    id: 'high-pass',
    name: 'High Pass',
    category: 'sharpen',
    params: highPassSpecs,
    margin: (p) => Math.ceil((readParams(highPassSpecs, p).radius as number) * 3),
    run: (src, p) => {
      const blurred = gaussianBlurRaster(src, readParams(highPassSpecs, p).radius as number);
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < src.data.length; i += 4) {
        for (let c = 0; c < 3; c++) out.data[i + c] = src.data[i + c]! - blurred.data[i + c]! + 128;
        out.data[i + 3] = src.data[i + 3]!;
      }
      return out;
    },
  },
  {
    id: 'add-noise',
    name: 'Add Noise',
    category: 'noise',
    params: addNoiseSpecs,
    margin: () => 0,
    run: (src, p, ctx) => {
      const { amount, distribution, monochromatic } = readParams(addNoiseSpecs, p) as {
        amount: number;
        distribution: string;
        monochromatic: boolean;
      };
      const rand = rng(ctx.seed);
      const spread = (amount / 100) * 255;
      const sample = () =>
        distribution === 'gaussian' ? gauss(rand) * spread * 0.5 : (rand() * 2 - 1) * spread;
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const m = monochromatic ? sample() : 0;
        for (let c = 0; c < 3; c++)
          out.data[i + c] = src.data[i + c]! + (monochromatic ? m : sample());
        out.data[i + 3] = src.data[i + 3]!;
      }
      return out;
    },
  },
  {
    id: 'reduce-noise',
    name: 'Reduce Noise',
    category: 'noise',
    params: reduceSpecs,
    margin: () => 6,
    run: (src, p, ctx) => {
      const { strength, preserve, colour } = readParams(reduceSpecs, p) as Record<string, number>;
      const w = src.width;
      const h = src.height;
      const d = src.data;
      const out = createRaster(w, h);
      // A bilateral filter on luma, its range tightened by Preserve Details; colour noise blurred
      // separately in the chroma.
      const r = 3;
      const sigmaR = Math.max(1, strength! * 6 * (1 - (preserve! / 100) * 0.8));
      const chroma = gaussianBlurRaster(src, 1 + (colour! / 100) * 3);
      for (let y = 0; y < h; y++) {
        if ((y & 31) === 0) checkpoint(ctx, y / h);
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const l0 = 0.299 * d[o]! + 0.587 * d[o + 1]! + 0.114 * d[o + 2]!;
          let sum = 0;
          let sw = 0;
          for (let j = -r; j <= r; j++) {
            const yy = Math.min(h - 1, Math.max(0, y + j));
            for (let i = -r; i <= r; i++) {
              const xx = Math.min(w - 1, Math.max(0, x + i));
              const q = (yy * w + xx) * 4;
              const l = 0.299 * d[q]! + 0.587 * d[q + 1]! + 0.114 * d[q + 2]!;
              const wt = Math.exp(
                -((i * i + j * j) / 8) - ((l - l0) * (l - l0)) / (2 * sigmaR * sigmaR),
              );
              sum += l * wt;
              sw += wt;
            }
          }
          const lum = strength === 0 ? l0 : sum / sw;
          // Recombine the smoothed luma with the (blurred, by Reduce Colour Noise) chroma.
          const cl =
            0.299 * chroma.data[o]! + 0.587 * chroma.data[o + 1]! + 0.114 * chroma.data[o + 2]!;
          const mix = colour! / 100;
          for (let c = 0; c < 3; c++) {
            const own = d[o + c]! - l0;
            const soft = chroma.data[o + c]! - cl;
            out.data[o + c] = lum + own + (soft - own) * mix;
          }
          out.data[o + 3] = d[o + 3]!;
        }
      }
      return out;
    },
  },
  {
    id: 'median',
    name: 'Median',
    category: 'noise',
    params: medianSpecs,
    margin: (p) => readParams(medianSpecs, p).radius as number,
    run: (src, p, ctx) =>
      medianFilter(src, Math.round(readParams(medianSpecs, p).radius as number), ctx),
  },
  {
    id: 'despeckle',
    name: 'Despeckle',
    category: 'noise',
    params: [],
    margin: () => 2,
    run: (src, _p, ctx) => {
      // The median where the picture is smooth; edges kept.
      const med = medianFilter(src, 1, ctx);
      const out = createRaster(src.width, src.height);
      const w = src.width;
      const d = src.data;
      for (let y = 0; y < src.height; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const right = x < w - 1 ? o + 4 : o;
          const down = y < src.height - 1 ? o + w * 4 : o;
          const edge = Math.abs(d[o]! - d[right]!) + Math.abs(d[o]! - d[down]!) > 60;
          for (let c = 0; c < 4; c++) out.data[o + c] = edge ? d[o + c]! : med.data[o + c]!;
        }
      return out;
    },
  },
  {
    id: 'dust-scratches',
    name: 'Dust & Scratches',
    category: 'noise',
    params: dustSpecs,
    margin: (p) => readParams(dustSpecs, p).radius as number,
    run: (src, p, ctx) => {
      const { radius, threshold } = readParams(dustSpecs, p) as Record<string, number>;
      const med = medianFilter(src, Math.round(radius!), ctx);
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const diff = Math.max(
          Math.abs(src.data[i]! - med.data[i]!),
          Math.abs(src.data[i + 1]! - med.data[i + 1]!),
          Math.abs(src.data[i + 2]! - med.data[i + 2]!),
        );
        for (let c = 0; c < 4; c++)
          out.data[i + c] = diff > threshold! ? med.data[i + c]! : src.data[i + c]!;
      }
      return out;
    },
  },
];
