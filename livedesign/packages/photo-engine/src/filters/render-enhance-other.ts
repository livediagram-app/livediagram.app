// The Render, Enhance and Other filters (docs/specs/031-photo/photo-adjustments.md "Filters"): Clouds,
// Difference Clouds, Vignette, Lens Flare; Clarity, Dehaze, Grain; Offset, Maximum, Minimum, Custom.
import { createRaster, type Raster } from '../raster/raster';
import { centreOf, fractalNoise, gauss, minMaxFilter, rng } from './helpers';
import { gaussianBlurPlane, gaussianBlurRaster, lumaPlane, planeFrom } from './kernel';
import { unsharp } from './sharpen-noise';
import {
  checkpoint,
  choice,
  num,
  point,
  readParams,
  type FilterDef,
  type ParamSpec,
} from './types';

const vignetteSpecs = [
  num('amount', 'Amount', -100, 100, -50, 1),
  num('midpoint', 'Midpoint', 0, 100, 50, 1),
  num('roundness', 'Roundness', -100, 100, 0, 1),
  num('feather', 'Feather', 0, 100, 50, 1),
];
const flareSpecs = [
  num('brightness', 'Brightness', 10, 300, 100, 1, '%'),
  point('centre', 'Flare Centre'),
  choice(
    'lens',
    'Lens Type',
    [
      ['zoom', '50-300mm Zoom'],
      ['prime35', '35mm Prime'],
      ['prime105', '105mm Prime'],
    ],
    'zoom',
  ),
];
const claritySpecs = [num('amount', 'Amount', -100, 100, 30, 1)];
const dehazeSpecs = [num('amount', 'Amount', -100, 100, 40, 1)];
const grainSpecs = [
  num('amount', 'Amount', 0, 100, 25, 1),
  num('size', 'Size', 0, 100, 25, 1),
  num('roughness', 'Roughness', 0, 100, 50, 1),
];
const offsetSpecs = [
  num('horizontal', 'Horizontal', -30000, 30000, 0, 1, 'px'),
  num('vertical', 'Vertical', -30000, 30000, 0, 1, 'px'),
  choice(
    'edges',
    'Undefined Areas',
    [
      ['wrap', 'Wrap Around'],
      ['repeat', 'Repeat Edge Pixels'],
      ['transparent', 'Set to Transparent'],
    ],
    'wrap',
  ),
];
const morphSpecs = [num('radius', 'Radius', 1, 500, 1, 1, 'px')];
const customSpecs: ParamSpec[] = [
  {
    key: 'kernel',
    name: 'Kernel',
    kind: 'kernel',
    default: [0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, 5, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0],
  },
  num('scale', 'Scale', 1, 9999, 1, 1),
  num('offset', 'Offset', -9999, 9999, 0, 1),
];

function clouds(
  src: Raster,
  fg: readonly number[],
  bg: readonly number[],
  seed: number,
  ox: number,
  oy: number,
): Raster {
  const out = createRaster(src.width, src.height);
  const scale = 1 / 128;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const t = fractalNoise((x + ox) * scale, (y + oy) * scale, seed);
      const o = (y * src.width + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = fg[c]! + (bg[c]! - fg[c]!) * t;
      out.data[o + 3] = 255;
    }
  return out;
}

export const RENDER_ENHANCE_OTHER_FILTERS: FilterDef[] = [
  {
    id: 'clouds',
    name: 'Clouds',
    category: 'render',
    params: [],
    margin: () => 0,
    run: (src, _p, ctx) =>
      clouds(src, ctx.foreground, ctx.background, ctx.seed, ctx.photo?.x ?? 0, ctx.photo?.y ?? 0),
  },
  {
    id: 'difference-clouds',
    name: 'Difference Clouds',
    category: 'render',
    params: [],
    margin: () => 0,
    run: (src, _p, ctx) => {
      const cl = clouds(
        src,
        ctx.foreground,
        ctx.background,
        ctx.seed,
        ctx.photo?.x ?? 0,
        ctx.photo?.y ?? 0,
      );
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < src.data.length; i += 4) {
        for (let c = 0; c < 3; c++) out.data[i + c] = Math.abs(src.data[i + c]! - cl.data[i + c]!);
        out.data[i + 3] = src.data[i + 3]!;
      }
      return out;
    },
  },
  {
    id: 'vignette',
    name: 'Vignette',
    category: 'render',
    params: vignetteSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { amount, midpoint, roundness, feather } = readParams(vignetteSpecs, p) as Record<
        string,
        number
      >;
      const c = centreOf(src, { x: 0.5, y: 0.5 }, ctx);
      const pw = ctx.photo?.width ?? src.width;
      const ph = ctx.photo?.height ?? src.height;
      // Roundness pulls the oval toward a circle (positive) or the frame's own shape (negative).
      const round = (roundness! + 100) / 200;
      const rx = (pw / 2) * (1 - round) + (Math.min(pw, ph) / 2) * round;
      const ry = (ph / 2) * (1 - round) + (Math.min(pw, ph) / 2) * round;
      const start = 0.2 + (midpoint! / 100) * 0.9;
      const soft = 0.05 + (feather! / 100) * 1.2;
      const out = createRaster(src.width, src.height);
      for (let y = 0; y < src.height; y++)
        for (let x = 0; x < src.width; x++) {
          const d = Math.hypot((x + 0.5 - c.x) / rx, (y + 0.5 - c.y) / ry);
          const t = Math.min(1, Math.max(0, (d - start) / soft));
          const k = t * t * (3 - 2 * t) * (amount! / 100);
          const o = (y * src.width + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const v = src.data[o + ch]!;
            out.data[o + ch] = k < 0 ? v * (1 + k) : v + (255 - v) * k;
          }
          out.data[o + 3] = src.data[o + 3]!;
        }
      return out;
    },
  },
  {
    id: 'lens-flare',
    name: 'Lens Flare',
    category: 'render',
    params: flareSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { brightness, centre, lens } = readParams(flareSpecs, p) as {
        brightness: number;
        centre: { x: number; y: number };
        lens: string;
      };
      const c = centreOf(src, centre, ctx);
      const pw = ctx.photo?.width ?? src.width;
      const ph = ctx.photo?.height ?? src.height;
      const mid = { x: pw / 2 - (ctx.photo?.x ?? 0), y: ph / 2 - (ctx.photo?.y ?? 0) };
      const k = brightness / 100;
      const span = Math.hypot(pw, ph);
      const core = span * (lens === 'prime105' ? 0.03 : 0.04);
      // Ghosts along the line from the flare through the centre.
      const ghosts = (lens === 'prime35' ? [0.5, 1.3, 1.8] : [0.4, 0.8, 1.2, 1.6]).map((t, i) => ({
        x: c.x + (mid.x - c.x) * t * 2,
        y: c.y + (mid.y - c.y) * t * 2,
        r: span * (0.02 + 0.015 * (i % 3)),
        tint: [
          [255, 200, 120],
          [120, 200, 255],
          [200, 255, 160],
          [255, 140, 200],
        ][i % 4]!,
      }));
      const out = createRaster(src.width, src.height);
      for (let y = 0; y < src.height; y++)
        for (let x = 0; x < src.width; x++) {
          const o = (y * src.width + x) * 4;
          const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
          const glow = Math.exp(-((d / core) ** 2)) * 255 + Math.exp(-d / (core * 6)) * 80;
          let add = [glow, glow * 0.95, glow * 0.85];
          // A soft horizontal streak.
          const streak =
            Math.exp(-Math.abs(y + 0.5 - c.y) / 2) *
            Math.exp(-Math.abs(x + 0.5 - c.x) / (span * 0.25)) *
            120;
          add = add.map((v) => v + streak);
          for (const g of ghosts) {
            const gd = Math.hypot(x + 0.5 - g.x, y + 0.5 - g.y) / g.r;
            if (gd < 1) {
              const ring = gd > 0.85 ? (1 - gd) / 0.15 : 0.25;
              add = add.map((v, i) => v + (g.tint[i]! * ring) / 3);
            }
          }
          for (let ch = 0; ch < 3; ch++) {
            const v = src.data[o + ch]!;
            // Screened in, so it never darkens.
            const a = Math.min(255, add[ch]! * k);
            out.data[o + ch] = 255 - ((255 - v) * (255 - a)) / 255;
          }
          out.data[o + 3] = src.data[o + 3]!;
        }
      return out;
    },
  },
  {
    id: 'clarity',
    name: 'Clarity',
    category: 'enhance',
    params: claritySpecs,
    margin: () => 60,
    run: (src, p) => {
      const amount = readParams(claritySpecs, p).amount as number;
      if (amount === 0) return src;
      // Local contrast on the midtones: a wide unsharp mask weighted toward middle grey.
      const sharp = amount > 0 ? unsharp(src, amount * 0.8, 20, 0) : gaussianBlurRaster(src, 6);
      const out = createRaster(src.width, src.height);
      const k = Math.abs(amount) / 100;
      for (let i = 0; i < src.data.length; i += 4) {
        const l =
          (0.299 * src.data[i]! + 0.587 * src.data[i + 1]! + 0.114 * src.data[i + 2]!) / 255;
        const mid = 1 - Math.abs(l - 0.5) * 2;
        const w = amount > 0 ? mid : mid * k;
        for (let c = 0; c < 3; c++)
          out.data[i + c] = src.data[i + c]! + (sharp.data[i + c]! - src.data[i + c]!) * w;
        out.data[i + 3] = src.data[i + 3]!;
      }
      return out;
    },
  },
  {
    id: 'dehaze',
    name: 'Dehaze',
    category: 'enhance',
    params: dehazeSpecs,
    margin: () => 40,
    run: (src, p, ctx) => {
      const amount = (readParams(dehazeSpecs, p).amount as number) / 100;
      const w = src.width;
      const h = src.height;
      const d = src.data;
      // The dark channel (He et al., 2009): the minimum channel over a patch, a guess at the haze.
      const minc = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const m = Math.min(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!);
        minc[i * 4] = m;
        minc[i * 4 + 1] = m;
        minc[i * 4 + 2] = m;
        minc[i * 4 + 3] = 255;
      }
      const dark = minMaxFilter({ width: w, height: h, data: minc }, 7, false);
      checkpoint(ctx, 0.3);
      // The haze's colour: the brightest of the darkest-channel's brightest thousandth.
      const hist = new Uint32Array(256);
      for (let i = 0; i < w * h; i++) hist[dark.data[i * 4]!]!++;
      let cut = 255;
      for (let seen = 0; cut > 0 && seen + hist[cut]! < Math.max(1, (w * h) / 1000); cut--)
        seen += hist[cut]!;
      const A = [1, 1, 1];
      for (let i = 0; i < w * h; i++) {
        if (dark.data[i * 4]! < cut) continue;
        for (let c = 0; c < 3; c++) A[c] = Math.max(A[c]!, d[i * 4 + c]!);
      }
      const tPlane = planeFrom(w, h);
      for (let i = 0; i < w * h; i++)
        tPlane.data[i] = 1 - 0.95 * Math.abs(amount) * (dark.data[i * 4]! / Math.max(...A));
      const t = gaussianBlurPlane(tPlane, 8);
      checkpoint(ctx, 0.7);
      const out = createRaster(w, h);
      for (let i = 0; i < w * h; i++) {
        const ti = Math.max(0.1, t.data[i]!);
        for (let c = 0; c < 3; c++) {
          const v = d[i * 4 + c]!;
          out.data[i * 4 + c] = amount >= 0 ? (v - A[c]!) / ti + A[c]! : v + (A[c]! - v) * (1 - ti);
        }
        out.data[i * 4 + 3] = d[i * 4 + 3]!;
      }
      return out;
    },
  },
  {
    id: 'grain',
    name: 'Grain',
    category: 'enhance',
    params: grainSpecs,
    margin: () => 8,
    run: (src, p, ctx) => {
      const { amount, size, roughness } = readParams(grainSpecs, p) as Record<string, number>;
      const rand = rng(ctx.seed);
      const noise = planeFrom(src.width, src.height);
      for (let i = 0; i < noise.data.length; i++) noise.data[i] = gauss(rand);
      const grain = gaussianBlurPlane(noise, 0.3 + (size! / 100) * 2);
      const strength = (amount! / 100) * 60 * (0.5 + roughness! / 100);
      const l = lumaPlane(src);
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < noise.data.length; i++) {
        // Strongest in the midtones, as film grain shows.
        const mid = 1 - Math.abs(l.data[i]! - 0.5) * 1.4;
        const g = grain.data[i]! * strength * Math.max(0.2, mid) * 2;
        for (let c = 0; c < 3; c++) out.data[i * 4 + c] = src.data[i * 4 + c]! + g;
        out.data[i * 4 + 3] = src.data[i * 4 + 3]!;
      }
      return out;
    },
  },
  {
    id: 'offset',
    name: 'Offset',
    category: 'other',
    params: offsetSpecs,
    margin: () => Infinity,
    run: (src, p) => {
      const { horizontal, vertical, edges } = readParams(offsetSpecs, p) as {
        horizontal: number;
        vertical: number;
        edges: string;
      };
      const w = src.width;
      const h = src.height;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let sx = x - horizontal;
          let sy = y - vertical;
          if (edges === 'wrap') {
            sx = ((sx % w) + w) % w;
            sy = ((sy % h) + h) % h;
          } else if (edges === 'repeat') {
            sx = Math.min(w - 1, Math.max(0, sx));
            sy = Math.min(h - 1, Math.max(0, sy));
          } else if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          out.data.set(
            src.data.subarray((sy * w + sx) * 4, (sy * w + sx) * 4 + 4),
            (y * w + x) * 4,
          );
        }
      return out;
    },
  },
  {
    id: 'maximum',
    name: 'Maximum',
    category: 'other',
    params: morphSpecs,
    margin: (p) => readParams(morphSpecs, p).radius as number,
    run: (src, p) =>
      minMaxFilter(src, Math.round(readParams(morphSpecs, p).radius as number), true),
  },
  {
    id: 'minimum',
    name: 'Minimum',
    category: 'other',
    params: morphSpecs,
    margin: (p) => readParams(morphSpecs, p).radius as number,
    run: (src, p) =>
      minMaxFilter(src, Math.round(readParams(morphSpecs, p).radius as number), false),
  },
  {
    id: 'custom',
    name: 'Custom',
    category: 'other',
    params: customSpecs,
    margin: () => 2,
    run: (src, p) => {
      const { kernel, scale, offset } = readParams(customSpecs, p) as {
        kernel: number[];
        scale: number;
        offset: number;
      };
      const w = src.width;
      const h = src.height;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let j = -2; j <= 2; j++) {
              const yy = Math.min(h - 1, Math.max(0, y + j));
              for (let i = -2; i <= 2; i++) {
                const k = kernel[(j + 2) * 5 + i + 2]!;
                if (k) s += src.data[(yy * w + Math.min(w - 1, Math.max(0, x + i))) * 4 + c]! * k;
              }
            }
            out.data[o + c] = s / scale + offset;
          }
          out.data[o + 3] = src.data[o + 3]!;
        }
      return out;
    },
  },
];
