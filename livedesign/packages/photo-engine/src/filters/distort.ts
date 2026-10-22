// The Distort filters (docs/specs/031-photo/photo-adjustments.md "Filters"): Pinch, Twirl, Spherize,
// Wave, Ripple, Polar Coordinates and Lens Correction, each a remapping of where each pixel takes its
// colour from, placed by the picture's centre.
import { createRaster } from '../raster/raster';
import { sampleInto } from '../transform/resample';
import { centreOf, remap } from './helpers';
import { checkpoint, choice, num, readParams, type FilterDef } from './types';

const pinchSpecs = [num('amount', 'Amount', -100, 100, 50, 1, '%')];
const twirlSpecs = [num('angle', 'Angle', -999, 999, 50, 1, '°')];
const sphereSpecs = [num('amount', 'Amount', -100, 100, 100, 1, '%')];
const waveSpecs = [
  num('wavelength', 'Wavelength', 1, 999, 120, 1, 'px'),
  num('amplitude', 'Amplitude', 0, 999, 10, 1, 'px'),
  toggleDir('horizontal', 'Horizontal', true),
  toggleDir('vertical', 'Vertical', false),
];
const rippleSpecs = [
  num('amount', 'Amount', -999, 999, 100, 1, '%'),
  choice(
    'size',
    'Size',
    [
      ['small', 'Small'],
      ['medium', 'Medium'],
      ['large', 'Large'],
    ],
    'medium',
  ),
];
const polarSpecs = [
  choice(
    'direction',
    'Direction',
    [
      ['to-polar', 'Rectangular to Polar'],
      ['to-rect', 'Polar to Rectangular'],
    ],
    'to-polar',
  ),
];
const lensSpecs = [
  num('distortion', 'Remove Distortion', -100, 100, 0, 1),
  num('vignette', 'Vignette', -100, 100, 0, 1),
  num('redCyan', 'Fix Red/Cyan Fringe', -100, 100, 0, 1),
  num('blueYellow', 'Fix Blue/Yellow Fringe', -100, 100, 0, 1),
];

function toggleDir(key: string, name: string, def: boolean) {
  return { key, name, kind: 'toggle' as const, default: def };
}

export const DISTORT_FILTERS: FilterDef[] = [
  {
    id: 'pinch',
    name: 'Pinch',
    category: 'distort',
    params: pinchSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const amount = (readParams(pinchSpecs, p).amount as number) / 100;
      const c = centreOf(src, { x: 0.5, y: 0.5 }, ctx);
      const radius = Math.min(src.width, src.height) / 2;
      return remap(
        src,
        (x, y) => {
          const dx = x - c.x;
          const dy = y - c.y;
          const d = Math.hypot(dx, dy) / radius;
          if (d >= 1 || d === 0) return { x, y };
          const k = Math.sin((Math.PI / 2) * d) ** -amount;
          return { x: c.x + dx * k, y: c.y + dy * k };
        },
        ctx,
      );
    },
  },
  {
    id: 'twirl',
    name: 'Twirl',
    category: 'distort',
    params: twirlSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const angle = ((readParams(twirlSpecs, p).angle as number) * Math.PI) / 180;
      const c = centreOf(src, { x: 0.5, y: 0.5 }, ctx);
      const radius = Math.min(src.width, src.height) / 2;
      return remap(
        src,
        (x, y) => {
          const dx = x - c.x;
          const dy = y - c.y;
          const d = Math.hypot(dx, dy);
          if (d >= radius) return { x, y };
          const a = angle * (1 - d / radius) ** 2;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
        },
        ctx,
      );
    },
  },
  {
    id: 'spherize',
    name: 'Spherize',
    category: 'distort',
    params: sphereSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const amount = (readParams(sphereSpecs, p).amount as number) / 100;
      const c = centreOf(src, { x: 0.5, y: 0.5 }, ctx);
      const rx = src.width / 2;
      const ry = src.height / 2;
      return remap(
        src,
        (x, y) => {
          const nx = (x - c.x) / rx;
          const ny = (y - c.y) / ry;
          const d = Math.hypot(nx, ny);
          if (d >= 1 || d === 0) return { x, y };
          // A sphere's refraction: the radius bent toward asin for a bulge, sin for a dent.
          const bent = amount >= 0 ? Math.asin(d) / (Math.PI / 2) : Math.sin((d * Math.PI) / 2);
          const k = 1 + (bent / d - 1) * Math.abs(amount);
          return { x: c.x + nx * k * rx, y: c.y + ny * k * ry };
        },
        ctx,
      );
    },
  },
  {
    id: 'wave',
    name: 'Wave',
    category: 'distort',
    params: waveSpecs,
    margin: (p) => Math.ceil(readParams(waveSpecs, p).amplitude as number) + 1,
    run: (src, p, ctx) => {
      const { wavelength, amplitude, horizontal, vertical } = readParams(waveSpecs, p) as {
        wavelength: number;
        amplitude: number;
        horizontal: boolean;
        vertical: boolean;
      };
      const ox = ctx.photo?.x ?? 0;
      const oy = ctx.photo?.y ?? 0;
      return remap(
        src,
        (x, y) => ({
          x: x + (horizontal ? amplitude * Math.sin(((y + oy) / wavelength) * 2 * Math.PI) : 0),
          y: y + (vertical ? amplitude * Math.sin(((x + ox) / wavelength) * 2 * Math.PI) : 0),
        }),
        ctx,
      );
    },
  },
  {
    id: 'ripple',
    name: 'Ripple',
    category: 'distort',
    params: rippleSpecs,
    margin: (p) => Math.ceil(Math.abs(readParams(rippleSpecs, p).amount as number) / 20) + 2,
    run: (src, p, ctx) => {
      const { amount, size } = readParams(rippleSpecs, p) as { amount: number; size: string };
      const wl = size === 'small' ? 8 : size === 'large' ? 32 : 16;
      const amp = (amount / 100) * (wl / 4);
      const ox = ctx.photo?.x ?? 0;
      const oy = ctx.photo?.y ?? 0;
      return remap(
        src,
        (x, y) => ({
          x: x + amp * Math.sin(((y + oy) / wl) * 2 * Math.PI + Math.sin((x + ox) / (wl * 3))),
          y: y + amp * Math.sin(((x + ox) / wl) * 2 * Math.PI + Math.sin((y + oy) / (wl * 3))),
        }),
        ctx,
      );
    },
  },
  {
    id: 'polar-coordinates',
    name: 'Polar Coordinates',
    category: 'distort',
    params: polarSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { direction } = readParams(polarSpecs, p) as { direction: string };
      const w = src.width;
      const h = src.height;
      const cx = w / 2;
      const cy = h / 2;
      const rmax = Math.min(cx, cy);
      return remap(
        src,
        direction === 'to-polar'
          ? (x, y) => {
              const dx = (x - cx) / cx;
              const dy = (y - cy) / cy;
              const a = Math.atan2(dx, -dy);
              const r = Math.hypot(dx, dy);
              return { x: ((a + Math.PI) / (2 * Math.PI)) * w, y: r * h };
            }
          : (x, y) => {
              const a = (x / w) * 2 * Math.PI - Math.PI;
              const r = (y / h) * rmax;
              return {
                x: cx + Math.sin(a) * r * (cx / rmax),
                y: cy - Math.cos(a) * r * (cy / rmax),
              };
            },
        ctx,
      );
    },
  },
  {
    id: 'lens-correction',
    name: 'Lens Correction',
    category: 'distort',
    params: lensSpecs,
    margin: () => Infinity,
    run: (src, p, ctx) => {
      const { distortion, vignette, redCyan, blueYellow } = readParams(lensSpecs, p) as Record<
        string,
        number
      >;
      const c = centreOf(src, { x: 0.5, y: 0.5 }, ctx);
      const norm = Math.hypot(src.width, src.height) / 2;
      const k = -(distortion! / 100) * 0.3;
      const out = createRaster(src.width, src.height);
      const px = new Float64Array(4);
      // Each channel scaled from the centre a little differently to pull its fringe back in line.
      const scales = [1 + (redCyan! / 100) * 0.004, 1, 1 + (blueYellow! / 100) * 0.004];
      for (let y = 0; y < src.height; y++) {
        if ((y & 63) === 0) checkpoint(ctx, y / src.height);
        for (let x = 0; x < src.width; x++) {
          const dx = x + 0.5 - c.x;
          const dy = y + 0.5 - c.y;
          const r = Math.hypot(dx, dy) / norm;
          const f = 1 + k * r * r;
          const o = (y * src.width + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const sx = Math.min(src.width - 0.5, Math.max(0.5, c.x + dx * f * scales[ch]!));
            const sy = Math.min(src.height - 0.5, Math.max(0.5, c.y + dy * f * scales[ch]!));
            sampleInto(src, sx, sy, 'bilinear', px);
            out.data[o + ch] = px[ch]!;
            if (ch === 1) out.data[o + 3] = px[3]!;
          }
          const vg = 1 + (vignette! / 100) * r * r;
          for (let ch = 0; ch < 3; ch++) out.data[o + ch] = out.data[o + ch]! * vg;
        }
      }
      return out;
    },
  },
];
