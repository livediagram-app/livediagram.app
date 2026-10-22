// Gradients (docs/specs/031-photo/photo-tools.md "Fills and gradients"): sampling a gradient's
// colour and opacity stops, its 256-step table, and rendering one across a rect in one of the five
// styles. Shared by the Gradient tool, fill layers and the Gradient Map adjustment.
import { hexToBytes } from '../colour/colour';
import type { Gradient, GradientStyle } from '../model/types';
import { createRaster, type Raster, type Rect } from '../raster/raster';

function between<T extends { at: number }>(stops: readonly T[], t: number): [T, T, number] {
  if (t <= stops[0]!.at) return [stops[0]!, stops[0]!, 0];
  const last = stops[stops.length - 1]!;
  if (t >= last.at) return [last, last, 0];
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i]!;
    if (t <= b.at) {
      const a = stops[i - 1]!;
      const span = b.at - a.at;
      return [a, b, span > 0 ? (t - a.at) / span : 0];
    }
  }
  return [last, last, 0];
}

/** The gradient's colour (bytes) and opacity (0..1) at t (0..1). */
export function sampleGradient(g: Gradient, t: number): [number, number, number, number] {
  const [a, b, k] = between(g.colours, t);
  const ca = hexToBytes(a.colour);
  const cb = hexToBytes(b.colour);
  const [oa, ob, ko] = between(g.opacities, t);
  return [
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
    oa.opacity + (ob.opacity - oa.opacity) * ko,
  ];
}

export const GRADIENT_STEPS = 256;

/** The gradient as 256 RGBA steps (bytes), reversed when asked. */
export function gradientTable(g: Gradient, reverse = false): Uint8ClampedArray {
  const out = new Uint8ClampedArray(GRADIENT_STEPS * 4);
  for (let i = 0; i < GRADIENT_STEPS; i++) {
    const t = i / (GRADIENT_STEPS - 1);
    const [r, gg, b, a] = sampleGradient(g, reverse ? 1 - t : t);
    out[i * 4] = r;
    out[i * 4 + 1] = gg;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a * 255;
  }
  return out;
}

/** Where on the gradient (0..1, before clamping) a point falls, for a gradient from `from` to `to`. */
export function gradientT(
  style: GradientStyle,
  x: number,
  y: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2) || 1;
  const px = x - from.x;
  const py = y - from.y;
  switch (style) {
    case 'linear':
      return len2 > 0 ? (px * dx + py * dy) / len2 : 0;
    case 'reflected':
      return Math.abs(len2 > 0 ? (px * dx + py * dy) / len2 : 0);
    case 'radial':
      return Math.sqrt(px * px + py * py) / len;
    case 'diamond': {
      // The distance along the gradient's own axes, the larger of the two.
      const ux = dx / len;
      const uy = dy / len;
      const a = Math.abs(px * ux + py * uy);
      const b = Math.abs(-px * uy + py * ux);
      return Math.max(a, b) / len;
    }
    case 'angle': {
      const base = Math.atan2(dy, dx);
      let a = Math.atan2(py, px) - base;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return a / (2 * Math.PI);
    }
  }
}

// An ordered 4x4 Bayer matrix, as a dither of up to one level either way.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16 - 0.5,
);

/** The gradient painted over `rect` (photo coordinates), from `from` to `to`. */
export function renderGradient(
  g: Gradient,
  style: GradientStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  rect: Rect,
  { reverse = false, dither = true }: { reverse?: boolean; dither?: boolean } = {},
): Raster {
  const table = gradientTable(g, reverse);
  const out = createRaster(rect.width, rect.height);
  const d = out.data;
  const last = GRADIENT_STEPS - 1;
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x + 0.5;
      const py = rect.y + y + 0.5;
      const t = Math.min(1, Math.max(0, gradientT(style, px, py, from, to)));
      const pos = t * last;
      const i0 = Math.floor(pos);
      const i1 = Math.min(last, i0 + 1);
      const k = pos - i0;
      const o = (y * rect.width + x) * 4;
      const jitter = dither ? BAYER[(y & 3) * 4 + (x & 3)]! : 0;
      for (let c = 0; c < 4; c++) {
        const v = table[i0 * 4 + c]! + (table[i1 * 4 + c]! - table[i0 * 4 + c]!) * k;
        d[o + c] = c < 3 ? v + jitter : v;
      }
    }
  }
  return out;
}

/** A fill layer's gradient line across a photo: through its centre at `angle` degrees, `scale`
 *  times the half-diagonal each way (docs/specs/031-photo/photo-layers.md "A layer"). */
export function fillGradientLine(
  width: number,
  height: number,
  angle: number,
  scale: number,
  style: GradientStyle,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const cx = width / 2;
  const cy = height / 2;
  const rad = (angle * Math.PI) / 180;
  // Photoshop's angle: 90 is bottom to top.
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const half = (Math.abs(width * ux) + Math.abs(height * uy)) / 2;
  const reach = half * scale;
  if (style === 'linear' || style === 'angle')
    return {
      from: { x: cx - ux * reach, y: cy - uy * reach },
      to: { x: cx + ux * reach, y: cy + uy * reach },
    };
  return { from: { x: cx, y: cy }, to: { x: cx + ux * reach, y: cy + uy * reach } };
}
