// The Blur filters (docs/specs/031-photo/photo-adjustments.md "Filters"): Gaussian, Box, Motion,
// Radial (spin and zoom), Surface (edge-keeping), Lens (a round bokeh that blooms highlights) and
// Tilt-Shift (a band in focus).
import { createRaster, type Raster } from '../raster/raster';
import { sampleInto } from '../transform/resample';
import { centreOf } from './helpers';
import {
  boxBlurPlane,
  gaussianBlurRaster,
  premultipliedPlanes,
  rasterFromPremultiplied,
} from './kernel';
import { checkpoint, choice, num, point, readParams, type FilterDef } from './types';

/** Averages, for every pixel, the samples the `along` function lists (in pixel-centre coordinates),
 *  premultiplied so transparency carries no colour. */
function averageAlong(
  src: Raster,
  along: (x: number, y: number, out: { x: number; y: number }[]) => void,
  ctx: Parameters<FilterDef['run']>[2],
): Raster {
  const out = createRaster(src.width, src.height);
  const px = new Float64Array(4);
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < src.height; y++) {
    if ((y & 31) === 0) checkpoint(ctx, y / src.height);
    for (let x = 0; x < src.width; x++) {
      pts.length = 0;
      along(x + 0.5, y + 0.5, pts);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const p of pts) {
        sampleInto(
          src,
          Math.min(src.width - 0.5, Math.max(0.5, p.x)),
          Math.min(src.height - 0.5, Math.max(0.5, p.y)),
          'bilinear',
          px,
        );
        r += px[0]! * px[3]!;
        g += px[1]! * px[3]!;
        b += px[2]! * px[3]!;
        a += px[3]!;
      }
      const o = (y * src.width + x) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
        out.data[o + 3] = a / pts.length;
      }
    }
  }
  return out;
}

const gaussianSpecs = [num('radius', 'Radius', 0.1, 250, 4, 0.1, 'px')];
const boxSpecs = [num('radius', 'Radius', 1, 250, 4, 1, 'px')];
const motionSpecs = [
  num('angle', 'Angle', -360, 360, 0, 1, '°'),
  num('distance', 'Distance', 1, 999, 20, 1, 'px'),
];
const radialSpecs = [
  num('amount', 'Amount', 1, 100, 10, 1),
  choice(
    'method',
    'Method',
    [
      ['spin', 'Spin'],
      ['zoom', 'Zoom'],
    ],
    'spin',
  ),
  point('centre', 'Centre'),
];
const surfaceSpecs = [
  num('radius', 'Radius', 1, 100, 5, 1, 'px'),
  num('threshold', 'Threshold', 2, 255, 15, 1),
];
const lensSpecs = [
  num('radius', 'Radius', 1, 100, 10, 1, 'px'),
  num('brightness', 'Brightness', 0, 100, 20, 1),
];
const tiltSpecs = [
  num('blur', 'Blur', 1, 100, 12, 1, 'px'),
  num('focus', 'Focus', 0, 100, 25, 1, '%'),
  num('fade', 'Fade', 0, 100, 25, 1, '%'),
  num('angle', 'Angle', -90, 90, 0, 1, '°'),
  point('centre', 'Centre'),
];

export const BLUR_FILTERS: FilterDef[] = [
  {
    id: 'gaussian-blur',
    name: 'Gaussian Blur',
    category: 'blur',
    params: gaussianSpecs,
    margin: (p) => Math.ceil((readParams(gaussianSpecs, p).radius as number) * 3),
    run: (src, p) => gaussianBlurRaster(src, readParams(gaussianSpecs, p).radius as number),
  },
  {
    id: 'box-blur',
    name: 'Box Blur',
    category: 'blur',
    params: boxSpecs,
    margin: (p) => readParams(boxSpecs, p).radius as number,
    run: (src, p) => {
      const r = Math.round(readParams(boxSpecs, p).radius as number);
      return rasterFromPremultiplied(premultipliedPlanes(src).map((pl) => boxBlurPlane(pl, r)));
    },
  },
  {
    id: 'motion-blur',
    name: 'Motion Blur',
    category: 'blur',
    params: motionSpecs,
    margin: (p) => Math.ceil((readParams(motionSpecs, p).distance as number) / 2) + 1,
    run: (src, p, ctx) => {
      const { angle, distance } = readParams(motionSpecs, p) as { angle: number; distance: number };
      const rad = (angle * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = -Math.sin(rad);
      const n = Math.max(2, Math.ceil(distance));
      return averageAlong(
        src,
        (x, y, out) => {
          for (let i = 0; i < n; i++) {
            const t = (i / (n - 1) - 0.5) * distance;
            out.push({ x: x + ux * t, y: y + uy * t });
          }
        },
        ctx,
      );
    },
  },
  {
    id: 'radial-blur',
    name: 'Radial Blur',
    category: 'blur',
    params: radialSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { amount, method, centre } = readParams(radialSpecs, p) as {
        amount: number;
        method: string;
        centre: { x: number; y: number };
      };
      const c = centreOf(src, centre, ctx);
      const samples = Math.max(4, Math.ceil(amount * 1.5));
      return averageAlong(
        src,
        (x, y, out) => {
          const dx = x - c.x;
          const dy = y - c.y;
          for (let i = 0; i < samples; i++) {
            const t = i / (samples - 1) - 0.5;
            if (method === 'zoom') {
              const k = 1 + t * (amount / 100) * 0.6;
              out.push({ x: c.x + dx * k, y: c.y + dy * k });
            } else {
              const a = t * (amount / 100) * 0.6;
              const cos = Math.cos(a);
              const sin = Math.sin(a);
              out.push({ x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos });
            }
          }
        },
        ctx,
      );
    },
  },
  {
    id: 'surface-blur',
    name: 'Surface Blur',
    category: 'blur',
    params: surfaceSpecs,
    margin: (p) => readParams(surfaceSpecs, p).radius as number,
    run: (src, p, ctx) => {
      const { radius, threshold } = readParams(surfaceSpecs, p) as {
        radius: number;
        threshold: number;
      };
      const r = Math.round(radius);
      const w = src.width;
      const h = src.height;
      const d = src.data;
      const out = createRaster(w, h);
      // Sample a sparse grid for large radii so it stays quick.
      const step = Math.max(1, Math.floor(r / 6));
      for (let y = 0; y < h; y++) {
        if ((y & 31) === 0) checkpoint(ctx, y / h);
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const cr = d[o]!;
          const cg = d[o + 1]!;
          const cb = d[o + 2]!;
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sw = 0;
          for (let j = -r; j <= r; j += step) {
            const yy = Math.min(h - 1, Math.max(0, y + j));
            for (let i = -r; i <= r; i += step) {
              const xx = Math.min(w - 1, Math.max(0, x + i));
              const q = (yy * w + xx) * 4;
              const diff =
                (Math.abs(d[q]! - cr) + Math.abs(d[q + 1]! - cg) + Math.abs(d[q + 2]! - cb)) / 3;
              const wt = Math.max(0, 1 - diff / (2.5 * threshold));
              if (wt <= 0) continue;
              sr += d[q]! * wt;
              sg += d[q + 1]! * wt;
              sb += d[q + 2]! * wt;
              sw += wt;
            }
          }
          out.data[o] = sr / sw;
          out.data[o + 1] = sg / sw;
          out.data[o + 2] = sb / sw;
          out.data[o + 3] = d[o + 3]!;
        }
      }
      return out;
    },
  },
  {
    id: 'lens-blur',
    name: 'Lens Blur',
    category: 'blur',
    params: lensSpecs,
    margin: (p) => readParams(lensSpecs, p).radius as number,
    run: (src, p, ctx) => {
      const { radius, brightness } = readParams(lensSpecs, p) as {
        radius: number;
        brightness: number;
      };
      // A disc of samples (a sunflower pattern), highlights raised before averaging so they bloom.
      const count = Math.min(96, Math.max(16, Math.round(radius * radius * 0.6)));
      const golden = Math.PI * (3 - Math.sqrt(5));
      const disc = Array.from({ length: count }, (_, i) => {
        const rr = Math.sqrt((i + 0.5) / count) * radius;
        return { x: Math.cos(i * golden) * rr, y: Math.sin(i * golden) * rr };
      });
      const power = 1 + (brightness / 100) * 3;
      const lin = new Float32Array(256);
      for (let i = 0; i < 256; i++) lin[i] = (i / 255) ** power;
      const w = src.width;
      const h = src.height;
      const d = src.data;
      const out = createRaster(w, h);
      for (let y = 0; y < h; y++) {
        if ((y & 31) === 0) checkpoint(ctx, y / h);
        for (let x = 0; x < w; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          for (const s of disc) {
            const xx = Math.min(w - 1, Math.max(0, Math.round(x + s.x)));
            const yy = Math.min(h - 1, Math.max(0, Math.round(y + s.y)));
            const q = (yy * w + xx) * 4;
            const pa = d[q + 3]! / 255;
            r += lin[d[q]!]! * pa;
            g += lin[d[q + 1]!]! * pa;
            b += lin[d[q + 2]!]! * pa;
            a += pa;
          }
          const o = (y * w + x) * 4;
          if (a <= 0) continue;
          out.data[o] = (r / a) ** (1 / power) * 255;
          out.data[o + 1] = (g / a) ** (1 / power) * 255;
          out.data[o + 2] = (b / a) ** (1 / power) * 255;
          out.data[o + 3] = (a / disc.length) * 255;
        }
      }
      return out;
    },
  },
  {
    id: 'tilt-shift',
    name: 'Tilt-Shift',
    category: 'blur',
    params: tiltSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { blur, focus, fade, angle, centre } = readParams(tiltSpecs, p) as {
        blur: number;
        focus: number;
        fade: number;
        angle: number;
        centre: { x: number; y: number };
      };
      const blurred = gaussianBlurRaster(src, blur / 2);
      const c = centreOf(src, centre, ctx);
      const rad = (angle * Math.PI) / 180;
      const nx = -Math.sin(rad);
      const ny = Math.cos(rad);
      const span = Math.max(src.width, src.height);
      const inner = (focus / 100) * span * 0.5;
      const ramp = Math.max(1, (fade / 100) * span * 0.5);
      const out = createRaster(src.width, src.height);
      for (let y = 0; y < src.height; y++)
        for (let x = 0; x < src.width; x++) {
          const dist = Math.abs((x + 0.5 - c.x) * nx + (y + 0.5 - c.y) * ny);
          const k = Math.min(1, Math.max(0, (dist - inner) / ramp));
          const o = (y * src.width + x) * 4;
          for (let ch = 0; ch < 4; ch++)
            out.data[o + ch] = src.data[o + ch]! + (blurred.data[o + ch]! - src.data[o + ch]!) * k;
        }
      return out;
    },
  },
];
