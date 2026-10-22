// The blend modes' formulas (docs/specs/031-photo/photo-layers.md "Blend modes"): the W3C
// Compositing and Blending Level 1 ones where it defines them, the published Photoshop ones for the
// rest, each clamped to 0..1, and the source-over compositing that mixes a blended layer onto what is
// under it. `b` is the backdrop (what is under), `s` the source (the layer), channels 0 to 1. The
// GPU shader (blend-glsl.ts) states the same formulas; blend.test.ts holds both to reference values.
import type { BlendMode } from '../model/types';
import { lum, sat, setLum, setSat, type Rgb } from './colour';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Hard Mix's threshold give: half of one 8-bit level (the GPU compositor's shader uses the same).
export const HARD_MIX_GIVE = 0.5 / 255;

function colourDodge(b: number, s: number): number {
  if (b === 0) return 0;
  if (s >= 1) return 1;
  return Math.min(1, b / (1 - s));
}

function colourBurn(b: number, s: number): number {
  if (b >= 1) return 1;
  if (s <= 0) return 0;
  return 1 - Math.min(1, (1 - b) / s);
}

function hardLight(b: number, s: number): number {
  return s <= 0.5 ? b * 2 * s : screenCh(b, 2 * s - 1);
}

function screenCh(b: number, s: number): number {
  return b + s - b * s;
}

function softLight(b: number, s: number): number {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
}

function vividLight(b: number, s: number): number {
  return s <= 0.5 ? colourBurn(b, 2 * s) : colourDodge(b, 2 * (s - 0.5));
}

function pinLight(b: number, s: number): number {
  return s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1);
}

/** One separable mode's result for one channel, or undefined for a non-separable mode. */
export function blendChannel(mode: BlendMode, b: number, s: number): number | undefined {
  switch (mode) {
    case 'normal':
    case 'dissolve':
    case 'pass-through':
      return s;
    case 'darken':
      return Math.min(b, s);
    case 'multiply':
      return b * s;
    case 'colour-burn':
      return colourBurn(b, s);
    case 'linear-burn':
      return clamp01(b + s - 1);
    case 'lighten':
      return Math.max(b, s);
    case 'screen':
      return screenCh(b, s);
    case 'colour-dodge':
      return colourDodge(b, s);
    case 'linear-dodge':
      return clamp01(b + s);
    case 'overlay':
      return hardLight(s, b);
    case 'soft-light':
      return softLight(b, s);
    case 'hard-light':
      return hardLight(b, s);
    case 'vivid-light':
      return vividLight(b, s);
    case 'linear-light':
      return clamp01(b + 2 * s - 1);
    case 'pin-light':
      return pinLight(b, s);
    case 'hard-mix':
      // Half an 8-bit step of give, so a sum of exactly 255 decides the same way on the GPU, whose
      // unpremultiplied values carry a little float error.
      return b + s >= 1 - HARD_MIX_GIVE ? 1 : 0;
    case 'difference':
      return Math.abs(b - s);
    case 'exclusion':
      return b + s - 2 * b * s;
    case 'subtract':
      return clamp01(b - s);
    case 'divide':
      return s <= 0 ? (b <= 0 ? 0 : 1) : clamp01(b / s);
    default:
      return undefined;
  }
}

/** A mode's result for one colour. */
export function blendRgb(mode: BlendMode, b: Rgb, s: Rgb): Rgb {
  switch (mode) {
    case 'hue':
      return setLum(setSat(s, sat(b)), lum(b[0], b[1], b[2]));
    case 'saturation':
      return setLum(setSat(b, sat(s)), lum(b[0], b[1], b[2]));
    case 'colour':
      return setLum(s, lum(b[0], b[1], b[2]));
    case 'luminosity':
      return setLum(b, lum(s[0], s[1], s[2]));
    case 'darker-colour':
      return lum(s[0], s[1], s[2]) < lum(b[0], b[1], b[2]) ? s : b;
    case 'lighter-colour':
      return lum(s[0], s[1], s[2]) > lum(b[0], b[1], b[2]) ? s : b;
    default:
      return [
        blendChannel(mode, b[0], s[0])!,
        blendChannel(mode, b[1], s[1])!,
        blendChannel(mode, b[2], s[2])!,
      ];
  }
}

const NON_SEPARABLE = new Set<BlendMode>([
  'hue',
  'saturation',
  'colour',
  'luminosity',
  'darker-colour',
  'lighter-colour',
]);

export function isSeparable(mode: BlendMode): boolean {
  return !NON_SEPARABLE.has(mode);
}

const INV255 = 1 / 255;

// Each separable mode's channel function, looked up once a span rather than once a channel.
const CHANNEL_FNS = new Map<BlendMode, (b: number, s: number) => number>(
  (
    [
      'darken',
      'multiply',
      'colour-burn',
      'linear-burn',
      'lighten',
      'screen',
      'colour-dodge',
      'linear-dodge',
      'overlay',
      'soft-light',
      'hard-light',
      'vivid-light',
      'linear-light',
      'pin-light',
      'hard-mix',
      'difference',
      'exclusion',
      'subtract',
      'divide',
    ] as const
  ).map((m) => [m, (b: number, s: number) => blendChannel(m, b, s)!]),
);
CHANNEL_FNS.set('multiply', (b, s) => b * s);
CHANNEL_FNS.set('screen', screenCh);
CHANNEL_FNS.set('darken', (b, s) => (b < s ? b : s));
CHANNEL_FNS.set('lighten', (b, s) => (b > s ? b : s));
CHANNEL_FNS.set('overlay', (b, s) => hardLight(s, b));
CHANNEL_FNS.set('soft-light', softLight);
CHANNEL_FNS.set('hard-light', hardLight);
CHANNEL_FNS.set('colour-dodge', colourDodge);
CHANNEL_FNS.set('colour-burn', colourBurn);
CHANNEL_FNS.set('difference', (b, s) => (b > s ? b - s : s - b));

/**
 * Blends `count` pixels of `src` onto `dst` in place (both straight RGBA bytes), by `mode`, the
 * source's alpha times `opacity` (0..1) and times `coverage` (one byte a pixel, from `covAt`, when
 * given: a mask, a selection, a brush). Source-over: what the layer leaves uncovered keeps the
 * backdrop, and where the backdrop is transparent the layer's own colour shows.
 */
export function blendSpan(
  dst: Uint8ClampedArray,
  dstAt: number,
  src: Uint8ClampedArray,
  srcAt: number,
  count: number,
  mode: BlendMode,
  opacity: number,
  coverage?: Uint8Array | Uint8ClampedArray,
  covAt = 0,
): void {
  const normal = mode === 'normal' || mode === 'dissolve' || mode === 'pass-through';
  if (normal && !coverage) return normalSpan(dst, dstAt, src, srcAt, count, opacity);
  const f = normal ? null : CHANNEL_FNS.get(mode);
  const k255 = opacity * INV255;
  for (let n = 0; n < count; n++) {
    const di = dstAt + n * 4;
    const si = srcAt + n * 4;
    let as = src[si + 3]! * k255;
    if (coverage) as *= coverage[covAt + n]! * INV255;
    if (as <= 0) continue;
    const db = dst[di + 3]!;
    // The common case: an opaque layer fully over, or anything over transparency.
    if (db === 0 || (normal && as >= 1)) {
      dst[di] = src[si]!;
      dst[di + 1] = src[si + 1]!;
      dst[di + 2] = src[si + 2]!;
      dst[di + 3] = db === 0 ? as * 255 : 255;
      continue;
    }
    const ab = db * INV255;
    const ao = as + ab * (1 - as);
    const k = (1 - as) * ab;
    const inv = 1 / ao;
    if (normal) {
      // Bytes stay bytes: (as s + k b) / ao.
      dst[di] = (as * src[si]! + k * dst[di]!) * inv;
      dst[di + 1] = (as * src[si + 1]! + k * dst[di + 1]!) * inv;
      dst[di + 2] = (as * src[si + 2]! + k * dst[di + 2]!) * inv;
      dst[di + 3] = ao * 255;
      continue;
    }
    const sr = src[si]! * INV255;
    const sg = src[si + 1]! * INV255;
    const sb = src[si + 2]! * INV255;
    const br = dst[di]! * INV255;
    const bg = dst[di + 1]! * INV255;
    const bb = dst[di + 2]! * INV255;
    let mr: number;
    let mg: number;
    let mb: number;
    if (f) {
      mr = f(br, sr);
      mg = f(bg, sg);
      mb = f(bb, sb);
    } else {
      const m = blendRgb(mode, [br, bg, bb], [sr, sg, sb]);
      mr = m[0];
      mg = m[1];
      mb = m[2];
    }
    // Where the backdrop is partly transparent, the layer's own colour shows through.
    const ib = 1 - ab;
    mr = ib * sr + ab * mr;
    mg = ib * sg + ab * mg;
    mb = ib * sb + ab * mb;
    dst[di] = (as * mr + k * br) * inv * 255;
    dst[di + 1] = (as * mg + k * bg) * inv * 255;
    dst[di + 2] = (as * mb + k * bb) * inv * 255;
    dst[di + 3] = ao * 255;
  }
}

/** `blendSpan`'s Normal with no coverage, the composite's commonest pass: the same sums in a tighter loop
 *  (about a fifth faster, engine.perf.test.ts "composites a 512 tile of 10 layers"). */
function normalSpan(
  dst: Uint8ClampedArray,
  dstAt: number,
  src: Uint8ClampedArray,
  srcAt: number,
  count: number,
  opacity: number,
): void {
  const k255 = opacity * INV255;
  const end = dstAt + count * 4;
  for (let di = dstAt, si = srcAt; di < end; di += 4, si += 4) {
    const sa = src[si + 3]!;
    if (sa === 0) continue;
    const as = sa * k255;
    if (as <= 0) continue;
    const db = dst[di + 3]!;
    if (db === 0 || as >= 1) {
      dst[di] = src[si]!;
      dst[di + 1] = src[si + 1]!;
      dst[di + 2] = src[si + 2]!;
      dst[di + 3] = db === 0 ? as * 255 : 255;
      continue;
    }
    const ab = db * INV255;
    const ao = as + ab * (1 - as);
    const k = (1 - as) * ab;
    const inv = 1 / ao;
    dst[di] = (as * src[si]! + k * dst[di]!) * inv;
    dst[di + 1] = (as * src[si + 1]! + k * dst[di + 1]!) * inv;
    dst[di + 2] = (as * src[si + 2]! + k * dst[di + 2]!) * inv;
    dst[di + 3] = ao * 255;
  }
}

/** Paints `src` only where `dst` is transparent (the Brush's Behind mode): the backdrop over it. */
export function behindSpan(
  dst: Uint8ClampedArray,
  dstAt: number,
  src: Uint8ClampedArray,
  srcAt: number,
  count: number,
  opacity: number,
  coverage?: Uint8Array | Uint8ClampedArray,
  covAt = 0,
): void {
  for (let n = 0; n < count; n++) {
    const di = dstAt + n * 4;
    const si = srcAt + n * 4;
    let as = src[si + 3]! * INV255 * opacity;
    if (coverage) as *= coverage[covAt + n]! * INV255;
    if (as <= 0) continue;
    const ab = dst[di + 3]! * INV255;
    const ao = ab + as * (1 - ab);
    const k = as * (1 - ab);
    const inv = 1 / ao;
    for (let c = 0; c < 3; c++)
      dst[di + c] = (ab * dst[di + c]! * INV255 + k * src[si + c]! * INV255) * inv * 255;
    dst[di + 3] = ao * 255;
  }
}

/** Takes alpha away (the Eraser, the Brush's Clear mode): each pixel's alpha times (1 - amount). */
export function clearSpan(
  dst: Uint8ClampedArray,
  dstAt: number,
  count: number,
  amount: number,
  coverage?: Uint8Array | Uint8ClampedArray,
  covAt = 0,
): void {
  for (let n = 0; n < count; n++) {
    let a = amount;
    if (coverage) a *= coverage[covAt + n]! * INV255;
    if (a <= 0) continue;
    const i = dstAt + n * 4 + 3;
    dst[i] = dst[i]! * (1 - a);
  }
}
