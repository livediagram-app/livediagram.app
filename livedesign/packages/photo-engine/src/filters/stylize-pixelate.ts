// The Stylize and Pixelate filters (docs/specs/031-photo/photo-adjustments.md "Filters"): Emboss,
// Find Edges, Oil Paint, Solarize, Glowing Edges, Diffuse; Mosaic, Crystallize, Colour Halftone and
// Pointillize.
import { createRaster, type Raster } from '../raster/raster';
import { rng } from './helpers';
import { gaussianBlurRaster, lumaPlane } from './kernel';
import { checkpoint, choice, num, readParams, type FilterDef } from './types';

const embossSpecs = [
  num('angle', 'Angle', -360, 360, 135, 1, '°'),
  num('height', 'Height', 1, 10, 3, 1, 'px'),
  num('amount', 'Amount', 1, 500, 100, 1, '%'),
];
const oilSpecs = [
  num('stylization', 'Stylization', 1, 10, 4, 1),
  num('cleanliness', 'Cleanliness', 0, 10, 5, 1),
];
const glowSpecs = [
  num('width', 'Edge Width', 1, 14, 2, 1),
  num('brightness', 'Edge Brightness', 0, 20, 6, 1),
  num('smoothness', 'Smoothness', 1, 15, 5, 1),
];
const diffuseSpecs = [
  choice(
    'mode',
    'Mode',
    [
      ['normal', 'Normal'],
      ['darken', 'Darken Only'],
      ['lighten', 'Lighten Only'],
    ],
    'normal',
  ),
];
const mosaicSpecs = [num('cell', 'Cell Size', 2, 200, 10, 1, 'px')];
const crystalSpecs = [num('cell', 'Cell Size', 3, 300, 10, 1, 'px')];
const halftoneSpecs = [
  num('radius', 'Max. Radius', 4, 127, 8, 1, 'px'),
  num('angle1', 'Channel 1', -360, 360, 108, 1, '°'),
  num('angle2', 'Channel 2', -360, 360, 162, 1, '°'),
  num('angle3', 'Channel 3', -360, 360, 90, 1, '°'),
];
const pointSpecs = [num('cell', 'Cell Size', 3, 300, 6, 1, 'px')];

function sobel(src: Raster): Float32Array {
  const l = lumaPlane(src);
  const w = src.width;
  const h = src.height;
  const at = (x: number, y: number) =>
    l.data[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      out[y * w + x] = Math.min(1, Math.hypot(gx, gy) / 4);
    }
  return out;
}

/** The nearest of a jittered grid of seeds for each pixel (Voronoi cells). */
function cells(
  w: number,
  h: number,
  size: number,
  seed: number,
): { owner: Int32Array; seeds: { x: number; y: number }[] } {
  const rand = rng(seed);
  const cols = Math.ceil(w / size);
  const rows = Math.ceil(h / size);
  const seeds: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) seeds.push({ x: (c + rand()) * size, y: (r + rand()) * size });
  const owner = new Int32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = Math.floor(x / size);
      const r = Math.floor(y / size);
      let best = 0;
      let bestD = Infinity;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const cc = c + i;
          const rr = r + j;
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
          const s = seeds[rr * cols + cc]!;
          const d = (x + 0.5 - s.x) ** 2 + (y + 0.5 - s.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = rr * cols + cc;
          }
        }
      owner[y * w + x] = best;
    }
  return { owner, seeds };
}

function cellMeans(src: Raster, owner: Int32Array, n: number): Float32Array {
  const acc = new Float32Array(n * 5);
  for (let p = 0; p < owner.length; p++) {
    const k = owner[p]! * 5;
    const a = src.data[p * 4 + 3]!;
    acc[k]! += src.data[p * 4]! * a;
    acc[k + 1]! += src.data[p * 4 + 1]! * a;
    acc[k + 2]! += src.data[p * 4 + 2]! * a;
    acc[k + 3]! += a;
    acc[k + 4]!++;
  }
  return acc;
}

export const STYLIZE_PIXELATE_FILTERS: FilterDef[] = [
  {
    id: 'emboss',
    name: 'Emboss',
    category: 'stylize',
    params: embossSpecs,
    margin: (p) => Math.ceil(readParams(embossSpecs, p).height as number) + 1,
    run: (src, p) => {
      const { angle, height, amount } = readParams(embossSpecs, p) as Record<string, number>;
      const rad = (angle! * Math.PI) / 180;
      const dx = Math.round(Math.cos(rad) * height!);
      const dy = Math.round(-Math.sin(rad) * height!);
      const l = lumaPlane(src);
      const w = src.width;
      const h = src.height;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a =
            l.data[
              Math.min(h - 1, Math.max(0, y - dy)) * w + Math.min(w - 1, Math.max(0, x - dx))
            ]!;
          const b =
            l.data[
              Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))
            ]!;
          const v = 128 + (b - a) * 255 * (amount! / 100);
          const o = (y * w + x) * 4;
          out.data[o] = v;
          out.data[o + 1] = v;
          out.data[o + 2] = v;
          out.data[o + 3] = src.data[o + 3]!;
        }
      return out;
    },
  },
  {
    id: 'find-edges',
    name: 'Find Edges',
    category: 'stylize',
    params: [],
    margin: () => 1,
    run: (src) => {
      const e = sobel(src);
      const out = createRaster(src.width, src.height);
      for (let p = 0; p < e.length; p++) {
        const v = 255 * (1 - e[p]!);
        out.data[p * 4] = v;
        out.data[p * 4 + 1] = v;
        out.data[p * 4 + 2] = v;
        out.data[p * 4 + 3] = src.data[p * 4 + 3]!;
      }
      return out;
    },
  },
  {
    id: 'oil-paint',
    name: 'Oil Paint',
    category: 'stylize',
    params: oilSpecs,
    margin: (p) => (readParams(oilSpecs, p).stylization as number) + 1,
    run: (src, p, ctx) => {
      // Kuwahara: each pixel the mean of the calmest of its four quadrants.
      const { stylization, cleanliness } = readParams(oilSpecs, p) as Record<string, number>;
      const r = Math.round(stylization!);
      const w = src.width;
      const h = src.height;
      const d = src.data;
      const base = cleanliness! > 0 ? gaussianBlurRaster(src, cleanliness! / 5) : src;
      const out = createRaster(w, h);
      const quads = [
        [-r, -r],
        [0, -r],
        [-r, 0],
        [0, 0],
      ];
      for (let y = 0; y < h; y++) {
        if ((y & 31) === 0) checkpoint(ctx, y / h);
        for (let x = 0; x < w; x++) {
          let bestVar = Infinity;
          let best = [0, 0, 0];
          for (const [qx, qy] of quads) {
            let sr = 0;
            let sg = 0;
            let sb = 0;
            let sl = 0;
            let sl2 = 0;
            let n = 0;
            for (let j = 0; j <= r; j++) {
              const yy = Math.min(h - 1, Math.max(0, y + qy! + j));
              for (let i = 0; i <= r; i++) {
                const xx = Math.min(w - 1, Math.max(0, x + qx! + i));
                const q = (yy * w + xx) * 4;
                const pr = base.data[q]!;
                const pg = base.data[q + 1]!;
                const pb = base.data[q + 2]!;
                const l = 0.299 * pr + 0.587 * pg + 0.114 * pb;
                sr += pr;
                sg += pg;
                sb += pb;
                sl += l;
                sl2 += l * l;
                n++;
              }
            }
            const variance = sl2 / n - (sl / n) ** 2;
            if (variance < bestVar) {
              bestVar = variance;
              best = [sr / n, sg / n, sb / n];
            }
          }
          const o = (y * w + x) * 4;
          out.data[o] = best[0]!;
          out.data[o + 1] = best[1]!;
          out.data[o + 2] = best[2]!;
          out.data[o + 3] = d[o + 3]!;
        }
      }
      return out;
    },
  },
  {
    id: 'solarize',
    name: 'Solarize',
    category: 'stylize',
    params: [],
    margin: () => 0,
    run: (src) => {
      const out = createRaster(src.width, src.height);
      for (let i = 0; i < src.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const v = src.data[i + c]!;
          out.data[i + c] = v > 127 ? 255 - v : v;
        }
        out.data[i + 3] = src.data[i + 3]!;
      }
      return out;
    },
  },
  {
    id: 'glowing-edges',
    name: 'Glowing Edges',
    category: 'stylize',
    params: glowSpecs,
    margin: (p) => (readParams(glowSpecs, p).width as number) * 3 + 2,
    run: (src, p) => {
      const { width, brightness, smoothness } = readParams(glowSpecs, p) as Record<string, number>;
      const soft = gaussianBlurRaster(src, smoothness! / 3);
      const e = sobel(soft);
      const out = createRaster(src.width, src.height);
      const gain = 1 + brightness! / 4;
      const thick = gaussianBlurRaster(
        {
          width: src.width,
          height: src.height,
          data: Uint8ClampedArray.from({ length: e.length * 4 }, (_, i) =>
            i % 4 === 3 ? 255 : e[i >> 2]! * 255,
          ),
        },
        width! / 2,
      );
      for (let p2 = 0; p2 < e.length; p2++) {
        const k = Math.min(1, (thick.data[p2 * 4]! / 255) * gain);
        for (let c = 0; c < 3; c++) out.data[p2 * 4 + c] = src.data[p2 * 4 + c]! * k;
        out.data[p2 * 4 + 3] = src.data[p2 * 4 + 3]!;
      }
      return out;
    },
  },
  {
    id: 'diffuse',
    name: 'Diffuse',
    category: 'stylize',
    params: diffuseSpecs,
    margin: () => 1,
    run: (src, p, ctx) => {
      const { mode } = readParams(diffuseSpecs, p) as { mode: string };
      const rand = rng(ctx.seed);
      const w = src.width;
      const h = src.height;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const xx = Math.min(w - 1, Math.max(0, x + Math.floor(rand() * 3) - 1));
          const yy = Math.min(h - 1, Math.max(0, y + Math.floor(rand() * 3) - 1));
          const o = (y * w + x) * 4;
          const q = (yy * w + xx) * 4;
          const lo = 0.299 * src.data[o]! + 0.587 * src.data[o + 1]! + 0.114 * src.data[o + 2]!;
          const lq = 0.299 * src.data[q]! + 0.587 * src.data[q + 1]! + 0.114 * src.data[q + 2]!;
          const take = mode === 'normal' || (mode === 'darken' ? lq < lo : lq > lo);
          for (let c = 0; c < 4; c++) out.data[o + c] = take ? src.data[q + c]! : src.data[o + c]!;
        }
      return out;
    },
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    category: 'pixelate',
    params: mosaicSpecs,
    margin: (p) => readParams(mosaicSpecs, p).cell as number,
    run: (src, p, ctx) => {
      const size = Math.round(readParams(mosaicSpecs, p).cell as number);
      const w = src.width;
      const h = src.height;
      // Cells on the photo's own grid, so parts of it line up.
      const ox = ctx.photo ? ((ctx.photo.x % size) + size) % size : 0;
      const oy = ctx.photo ? ((ctx.photo.y % size) + size) % size : 0;
      const out = createRaster(w, h);
      for (let cy = -oy; cy < h; cy += size)
        for (let cx = -ox; cx < w; cx += size) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let n = 0;
          for (let y = Math.max(0, cy); y < Math.min(h, cy + size); y++)
            for (let x = Math.max(0, cx); x < Math.min(w, cx + size); x++) {
              const o = (y * w + x) * 4;
              const pa = src.data[o + 3]!;
              r += src.data[o]! * pa;
              g += src.data[o + 1]! * pa;
              b += src.data[o + 2]! * pa;
              a += pa;
              n++;
            }
          if (!n) continue;
          for (let y = Math.max(0, cy); y < Math.min(h, cy + size); y++)
            for (let x = Math.max(0, cx); x < Math.min(w, cx + size); x++) {
              const o = (y * w + x) * 4;
              if (a > 0) {
                out.data[o] = r / a;
                out.data[o + 1] = g / a;
                out.data[o + 2] = b / a;
              }
              out.data[o + 3] = a / n;
            }
        }
      return out;
    },
  },
  {
    id: 'crystallize',
    name: 'Crystallize',
    category: 'pixelate',
    params: crystalSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const size = Math.round(readParams(crystalSpecs, p).cell as number);
      const { owner, seeds } = cells(src.width, src.height, size, ctx.seed);
      const acc = cellMeans(src, owner, seeds.length);
      const out = createRaster(src.width, src.height);
      for (let q = 0; q < owner.length; q++) {
        const k = owner[q]! * 5;
        const a = acc[k + 3]!;
        if (a > 0) {
          out.data[q * 4] = acc[k]! / a;
          out.data[q * 4 + 1] = acc[k + 1]! / a;
          out.data[q * 4 + 2] = acc[k + 2]! / a;
        }
        out.data[q * 4 + 3] = a / acc[k + 4]!;
      }
      return out;
    },
  },
  {
    id: 'colour-halftone',
    name: 'Colour Halftone',
    category: 'pixelate',
    params: halftoneSpecs,
    margin: (p) => (readParams(halftoneSpecs, p).radius as number) * 2,
    run: (src, p) => {
      const { radius, angle1, angle2, angle3 } = readParams(halftoneSpecs, p) as Record<
        string,
        number
      >;
      const cell = radius! * 2;
      const angles = [angle1!, angle2!, angle3!].map((a) => (a * Math.PI) / 180);
      const w = src.width;
      const h = src.height;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            // Each channel a screen of dots at its angle, each dot as large as its cell's ink.
            const a = angles[c]!;
            const u = (x * Math.cos(a) + y * Math.sin(a)) / cell;
            const v = (-x * Math.sin(a) + y * Math.cos(a)) / cell;
            const cu = Math.floor(u) + 0.5;
            const cv = Math.floor(v) + 0.5;
            const sx = (cu * Math.cos(a) - cv * Math.sin(a)) * cell;
            const sy = (cu * Math.sin(a) + cv * Math.cos(a)) * cell;
            const q =
              (Math.min(h - 1, Math.max(0, Math.round(sy))) * w +
                Math.min(w - 1, Math.max(0, Math.round(sx)))) *
              4;
            const ink = 1 - src.data[q + c]! / 255;
            const dotR = Math.sqrt(ink) * cell * 0.7071;
            const dist = Math.hypot((u - cu) * cell, (v - cv) * cell);
            out.data[o + c] = Math.min(1, Math.max(0, dist - dotR + 0.5)) * 255;
          }
          out.data[o + 3] = src.data[o + 3]!;
        }
      return out;
    },
  },
  {
    id: 'pointillize',
    name: 'Pointillize',
    category: 'pixelate',
    params: pointSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const size = Math.round(readParams(pointSpecs, p).cell as number);
      const { owner, seeds } = cells(src.width, src.height, size, ctx.seed);
      const acc = cellMeans(src, owner, seeds.length);
      const out = createRaster(src.width, src.height);
      const bg = ctx.background;
      for (let q = 0; q < owner.length; q++) {
        const x = q % src.width;
        const y = (q - x) / src.width;
        const k = owner[q]! * 5;
        const s = seeds[owner[q]!]!;
        const inDot = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) <= size * 0.45;
        const a = acc[k + 3]!;
        for (let c = 0; c < 3; c++) out.data[q * 4 + c] = inDot && a > 0 ? acc[k + c]! / a : bg[c]!;
        out.data[q * 4 + 3] = src.data[q * 4 + 3]!;
      }
      return out;
    },
  },
];
