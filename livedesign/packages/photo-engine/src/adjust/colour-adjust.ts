// The colour adjustments that read a whole pixel (docs/specs/031-photo/photo-adjustments.md):
// Vibrance, Hue/Saturation, Colour Balance, Black & White, Photo Filter, Channel Mixer, Selective
// Colour, Desaturate, and Gradient Map (by luma). Each is a function of one pixel's colour (0..1), so
// the GPU draws it from a 3D table baked from the same function.
import { hexToBytes, hslToRgb, lum, rgbToHsl, setLum, type Rgb } from '../colour/colour';
import type { Gradient } from '../model/types';
import { gradientTable } from '../paint/gradient';
import { parseGradient } from '../model/parse';
import { bool, hex, isRec, num, oneOf, rec } from './params';
import type { LumaMap } from './tone';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type PixelFn = (r: number, g: number, b: number) => Rgb;

// Vibrance: saturation that protects colours already saturated; Saturation: all alike.
export type VibranceParams = { vibrance: number; saturation: number };
export const readVibrance = (p: unknown): VibranceParams => ({
  vibrance: num(p, 'vibrance', -100, 100, 0),
  saturation: num(p, 'saturation', -100, 100, 0),
});
export function vibranceFn({ vibrance, saturation }: VibranceParams): PixelFn {
  const vib = vibrance / 100;
  const sat = saturation / 100;
  return (r, g, b) => {
    const l = lum(r, g, b);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max - min;
    // Less saturated colours move more.
    const amount = 1 + sat + vib * (1 - s) * (vib > 0 ? 1 : 0.5);
    return setLum(
      [l + (r - l) * amount, l + (g - l) * amount, l + (b - l) * amount].map(clamp01) as Rgb,
      l,
    );
  };
}

// Hue/Saturation: a master shift and one per colour range, the ranges' weights by hue distance (a
// full 30 degrees either side of the centre, fading to nothing over the next 30).
export const HUE_RANGES = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const;
export type HueRange = (typeof HUE_RANGES)[number];
type HslShift = { hue: number; saturation: number; lightness: number };
export type HueSaturationParams = {
  master: HslShift;
  ranges: Record<HueRange, HslShift>;
  colourise: boolean;
};
const readShift = (v: unknown): HslShift => ({
  hue: num(v, 'hue', -180, 180, 0),
  saturation: num(v, 'saturation', -100, 100, 0),
  lightness: num(v, 'lightness', -100, 100, 0),
});
export function readHueSaturation(p: unknown): HueSaturationParams {
  const ranges = rec(p, 'ranges');
  return {
    master: readShift(rec(p, 'master')),
    ranges: Object.fromEntries(HUE_RANGES.map((r) => [r, readShift(ranges[r])])) as Record<
      HueRange,
      HslShift
    >,
    colourise: bool(p, 'colourise', false),
  };
}

function rangeWeight(hueDeg: number, centre: number): number {
  let d = Math.abs(hueDeg - centre) % 360;
  if (d > 180) d = 360 - d;
  return d <= 30 ? 1 : d >= 60 ? 0 : 1 - (d - 30) / 30;
}

function applyLightness(c: number, l: number): number {
  return l >= 0 ? c + (1 - c) * l : c * (1 + l);
}

export function hueSaturationFn(p: HueSaturationParams): PixelFn {
  if (p.colourise) {
    const hue = (((p.master.hue % 360) + 360) % 360) / 360;
    const s = clamp01((p.master.saturation + 100) / 200);
    const l = p.master.lightness / 100;
    return (r, g, b) => {
      const light = lum(r, g, b);
      const [cr, cg, cb] = hslToRgb(hue, s, light);
      return [applyLightness(cr, l), applyLightness(cg, l), applyLightness(cb, l)];
    };
  }
  return (r, g, b) => {
    const [h, s, l] = rgbToHsl(r, g, b);
    const deg = h * 360;
    let dh = p.master.hue;
    let ds = p.master.saturation;
    let dl = p.master.lightness;
    if (s > 0) {
      HUE_RANGES.forEach((name, i) => {
        const w = rangeWeight(deg, i * 60);
        if (w === 0) return;
        const shift = p.ranges[name];
        dh += shift.hue * w;
        ds += shift.saturation * w;
        dl += shift.lightness * w;
      });
    }
    const nh = (((deg + dh) % 360) + 360) % 360;
    // Up, toward full saturation (greys stay grey); down, toward grey.
    const ns = clamp01(
      ds >= 0 ? s + (1 - s) * (ds / 100) * Math.min(1, s * 2) : s * (1 + ds / 100),
    );
    const [cr, cg, cb] = hslToRgb(nh / 360, ns, l);
    const k = dl / 100;
    return [
      clamp01(applyLightness(cr, k)),
      clamp01(applyLightness(cg, k)),
      clamp01(applyLightness(cb, k)),
    ];
  };
}

// Colour Balance (GIMP's transfer functions): shadows, midtones and highlights each shift
// Cyan-Red, Magenta-Green and Yellow-Blue, weighted by the channel's own level.
export type BalanceRange = [number, number, number];
export type ColourBalanceParams = {
  shadows: BalanceRange;
  midtones: BalanceRange;
  highlights: BalanceRange;
  preserveLuminosity: boolean;
};
const readRange = (v: unknown): BalanceRange =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? (v.map((n: number) => Math.min(100, Math.max(-100, n))) as BalanceRange)
    : [0, 0, 0];
export const readColourBalance = (p: unknown): ColourBalanceParams => ({
  shadows: readRange(isRec(p) ? p.shadows : undefined),
  midtones: readRange(isRec(p) ? p.midtones : undefined),
  highlights: readRange(isRec(p) ? p.highlights : undefined),
  preserveLuminosity: bool(p, 'preserveLuminosity', true),
});
export function colourBalanceFn(p: ColourBalanceParams): PixelFn {
  const A = 0.25;
  const B = 0.333;
  const S = 0.7;
  const shadowsW = (v: number) => clamp01((v - B) / -A + 0.5) * S;
  const midW = (v: number) => clamp01((v - B) / A + 0.5) * clamp01((v + B - 1) / -A + 0.5) * S;
  const highW = (v: number) => clamp01((v + B - 1) / A + 0.5) * S;
  return (r, g, b) => {
    const ch: Rgb = [r, g, b];
    const out = ch.map((v, i) => {
      const shift =
        (p.shadows[i]! * shadowsW(v) + p.midtones[i]! * midW(v) + p.highlights[i]! * highW(v)) /
        100;
      return clamp01(v + shift);
    }) as Rgb;
    return p.preserveLuminosity ? setLum(out, lum(r, g, b)) : out;
  };
}

// Black & White: grey from the hue sector's weights (min + (mid-min)*secondary + (max-mid)*primary),
// optionally tinted.
export const BW_COLOURS = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const;
export type BlackWhiteParams = Record<(typeof BW_COLOURS)[number], number> & {
  tint: boolean;
  tintColour: string;
};
const BW_DEFAULTS = { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 };
export const readBlackWhite = (p: unknown): BlackWhiteParams => ({
  ...(Object.fromEntries(
    BW_COLOURS.map((c) => [c, num(p, c, -200, 300, BW_DEFAULTS[c])]),
  ) as Record<(typeof BW_COLOURS)[number], number>),
  tint: bool(p, 'tint', false),
  tintColour: hex(p, 'tintColour', '#e1d3b3'),
});
export function blackWhiteFn(p: BlackWhiteParams): PixelFn {
  const w = (k: (typeof BW_COLOURS)[number]) => p[k] / 100;
  const [tr, tg, tb] = hexToBytes(p.tintColour).map((v) => v / 255) as Rgb;
  const [th, ts] = rgbToHsl(tr, tg, tb);
  return (r, g, b) => {
    const ch: Rgb = [r, g, b];
    const order = [0, 1, 2].sort((a, c) => ch[c]! - ch[a]!);
    const [iMax, iMid, iMin] = order as [number, number, number];
    const max = ch[iMax]!;
    const mid = ch[iMid]!;
    const min = ch[iMin]!;
    // The primary is the largest channel; the secondary the pair of the two largest.
    const primary = (['reds', 'greens', 'blues'] as const)[iMax]!;
    const pair = iMax + iMid;
    const secondary = pair === 1 ? 'yellows' : pair === 3 ? 'cyans' : 'magentas';
    const grey = clamp01(min + (mid - min) * w(secondary) + (max - mid) * w(primary));
    if (!p.tint) return [grey, grey, grey];
    return hslToRgb(th, ts, grey);
  };
}

// Photo Filter: a coloured filter over the lens, by density, the luminosity kept where asked.
export const PHOTO_FILTER_PRESETS: Record<string, string> = {
  'warming-85': '#ec8a00',
  'warming-lba': '#fa9600',
  'cooling-80': '#006dff',
  'cooling-lbb': '#005dff',
  sepia: '#ac7a33',
};
export type PhotoFilterParams = { colour: string; density: number; preserveLuminosity: boolean };
export const readPhotoFilter = (p: unknown): PhotoFilterParams => ({
  colour: hex(p, 'colour', PHOTO_FILTER_PRESETS['warming-85']!),
  density: num(p, 'density', 0.01, 1, 0.25),
  preserveLuminosity: bool(p, 'preserveLuminosity', true),
});
export function photoFilterFn(p: PhotoFilterParams): PixelFn {
  const [fr, fg, fb] = hexToBytes(p.colour).map((v) => v / 255) as Rgb;
  return (r, g, b) => {
    const d = p.density;
    const out: Rgb = [r * (1 - d + d * fr), g * (1 - d + d * fg), b * (1 - d + d * fb)];
    return p.preserveLuminosity ? setLum(out, lum(r, g, b)) : out;
  };
}

// Channel Mixer: each output channel a weighted sum of the inputs plus a constant (percent).
export type MixRow = [number, number, number, number];
export type ChannelMixerParams = {
  red: MixRow;
  green: MixRow;
  blue: MixRow;
  grey: MixRow;
  monochrome: boolean;
};
const readRow = (v: unknown, def: MixRow): MixRow =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? (v.map((n: number) => Math.min(200, Math.max(-200, n))) as MixRow)
    : def;
export const readChannelMixer = (p: unknown): ChannelMixerParams => {
  const r = isRec(p) ? p : {};
  return {
    red: readRow(r.red, [100, 0, 0, 0]),
    green: readRow(r.green, [0, 100, 0, 0]),
    blue: readRow(r.blue, [0, 0, 100, 0]),
    grey: readRow(r.grey, [40, 40, 20, 0]),
    monochrome: bool(p, 'monochrome', false),
  };
};
export function channelMixerFn(p: ChannelMixerParams): PixelFn {
  const mix = (row: MixRow, r: number, g: number, b: number) =>
    clamp01((row[0] * r + row[1] * g + row[2] * b) / 100 + row[3] / 100);
  if (p.monochrome)
    return (r, g, b) => {
      const v = mix(p.grey, r, g, b);
      return [v, v, v];
    };
  return (r, g, b) => [mix(p.red, r, g, b), mix(p.green, r, g, b), mix(p.blue, r, g, b)];
}

// Selective Colour: per range, cyan, magenta, yellow and black ink added or taken away, relative
// (by the ink already there) or absolute.
export const SELECTIVE_RANGES = [
  'reds',
  'yellows',
  'greens',
  'cyans',
  'blues',
  'magentas',
  'whites',
  'neutrals',
  'blacks',
] as const;
export type SelectiveRange = (typeof SELECTIVE_RANGES)[number];
export type Inks = [number, number, number, number];
export type SelectiveColourParams = { ranges: Record<SelectiveRange, Inks>; relative: boolean };
const readInks = (v: unknown): Inks =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? (v.map((n: number) => Math.min(100, Math.max(-100, n))) as Inks)
    : [0, 0, 0, 0];
export const readSelectiveColour = (p: unknown): SelectiveColourParams => {
  const ranges = rec(p, 'ranges');
  return {
    ranges: Object.fromEntries(SELECTIVE_RANGES.map((r) => [r, readInks(ranges[r])])) as Record<
      SelectiveRange,
      Inks
    >,
    relative: oneOf(p, 'method', ['relative', 'absolute'] as const, 'relative') === 'relative',
  };
};
export function selectiveColourFn(p: SelectiveColourParams): PixelFn {
  return (r, g, b) => {
    const ch: Rgb = [r, g, b];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const mid = r + g + b - max - min;
    const weights: [SelectiveRange, number][] = [];
    // A primary range where it is the largest channel; a secondary where the third is the smallest.
    const iMax = ch.indexOf(max);
    const iMin = ch.indexOf(min);
    weights.push([(['reds', 'greens', 'blues'] as const)[iMax]!, max - mid]);
    weights.push([(['cyans', 'magentas', 'yellows'] as const)[iMin]!, mid - min]);
    if (min > 0.5) weights.push(['whites', (min - 0.5) * 2]);
    if (max < 0.5) weights.push(['blacks', (0.5 - max) * 2]);
    weights.push(['neutrals', clamp01(1 - (Math.abs(max - 0.5) + Math.abs(min - 0.5)))]);
    const out: Rgb = [r, g, b];
    for (const [range, w] of weights) {
      if (w <= 0) continue;
      const inks = p.ranges[range];
      for (let c = 0; c < 3; c++) {
        const amount = (inks[c]! + inks[3]) / 100;
        const ink = 1 - out[c]!;
        const delta = p.relative ? (amount >= 0 ? amount * ink : amount * ink) : amount;
        out[c] = clamp01(1 - (ink + delta * w));
      }
    }
    return out;
  };
}

/** Desaturate: each pixel's lightness, (max + min) / 2. */
export const desaturateFn: PixelFn = (r, g, b) => {
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  return [l, l, l];
};

// Gradient Map: the pixel's luma picks its colour along the gradient.
export type GradientMapParams = { gradient: Gradient; reverse: boolean; dither: boolean };
const BW_GRADIENT: Gradient = {
  colours: [
    { at: 0, colour: '#000000' },
    { at: 1, colour: '#ffffff' },
  ],
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 1 },
  ],
};
export const readGradientMap = (p: unknown): GradientMapParams => ({
  gradient: parseGradient(isRec(p) ? p.gradient : undefined) ?? BW_GRADIENT,
  reverse: bool(p, 'reverse', false),
  dither: bool(p, 'dither', false),
});
export function gradientMapMap(p: GradientMapParams): LumaMap {
  const table = gradientTable(p.gradient, p.reverse);
  const out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    out[i * 3] = table[i * 4]!;
    out[i * 3 + 1] = table[i * 4 + 1]!;
    out[i * 3 + 2] = table[i * 4 + 2]!;
  }
  return out;
}
