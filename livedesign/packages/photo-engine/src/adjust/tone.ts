// The tone adjustments that are one curve per channel (docs/specs/031-photo/photo-adjustments.md):
// Brightness/Contrast, Exposure, Posterize, Invert, White Balance, Equalize; and Threshold and
// Desaturate, which read the pixel's luma or lightness.
import { linearToSrgb, lutFromChannels, lutFromCurve, srgbToLinear, type ChannelLut } from './lut';
import { num } from './params';

// Brightness/Contrast (docs/specs/031-photo/blueprints/DEFAULTS.md D12): brightness lifts the
// midtones most and leaves black and white where they are; contrast scales about mid grey.
export type BrightnessParams = { brightness: number; contrast: number };
export const readBrightness = (p: unknown): BrightnessParams => ({
  brightness: num(p, 'brightness', -150, 150, 0),
  contrast: num(p, 'contrast', -50, 100, 0),
});
export function brightnessLut({ brightness, contrast }: BrightnessParams): ChannelLut {
  const k = contrast >= 0 ? 1 + (contrast / 100) * 1.5 : 1 + contrast / 100;
  return lutFromCurve((v) => {
    const lifted = v + (brightness / 150) * 0.5 * (1 - (2 * v - 1) ** 2);
    return (lifted - 0.5) * k + 0.5;
  });
}

// Exposure, in linear light: v * 2^exposure + offset, then the gamma.
export type ExposureParams = { exposure: number; offset: number; gamma: number };
export const readExposure = (p: unknown): ExposureParams => ({
  exposure: num(p, 'exposure', -20, 20, 0),
  offset: num(p, 'offset', -0.5, 0.5, 0),
  gamma: num(p, 'gamma', 0.01, 9.99, 1),
});
export function exposureLut({ exposure, offset, gamma }: ExposureParams): ChannelLut {
  return lutFromCurve((v) => {
    const lin = srgbToLinear(v) * 2 ** exposure + offset;
    const g = Math.max(0, lin) ** (1 / gamma);
    return linearToSrgb(Math.min(1, g));
  });
}

export type PosterizeParams = { levels: number };
export const readPosterize = (p: unknown): PosterizeParams => ({
  levels: Math.round(num(p, 'levels', 2, 255, 4)),
});
export function posterizeLut({ levels }: PosterizeParams): ChannelLut {
  const n = levels - 1;
  return lutFromCurve((v) => Math.round(v * n) / n);
}

export function invertLut(): ChannelLut {
  return lutFromCurve((v) => 1 - v);
}

// White Balance: temperature warms (red up, blue down) or cools; tint moves toward magenta (green
// down) or green. Gains on linear light, so a neutral grey moves as a whole.
export type WhiteBalanceParams = { temperature: number; tint: number };
export const readWhiteBalance = (p: unknown): WhiteBalanceParams => ({
  temperature: num(p, 'temperature', -100, 100, 0),
  tint: num(p, 'tint', -100, 100, 0),
});
export function whiteBalanceGains({
  temperature,
  tint,
}: WhiteBalanceParams): [number, number, number] {
  const t = temperature / 100;
  const m = tint / 100;
  return [1 + 0.3 * t, 1 - 0.3 * m, 1 - 0.3 * t];
}
export function whiteBalanceLut(p: WhiteBalanceParams): ChannelLut {
  const gains = whiteBalanceGains(p);
  return lutFromChannels((v, c) => linearToSrgb(Math.min(1, srgbToLinear(v) * gains[c])));
}
/** The temperature and tint that make a picked colour (bytes) neutral grey. */
export function whiteBalanceFromNeutral(r: number, g: number, b: number): WhiteBalanceParams {
  const lr = Math.max(1e-4, srgbToLinear(r / 255));
  const lg = Math.max(1e-4, srgbToLinear(g / 255));
  const lb = Math.max(1e-4, srgbToLinear(b / 255));
  // Solve (1 + 0.3t) lr = (1 - 0.3t) lb for t, then green to their mean with the tint.
  const t = (lb - lr) / (0.3 * (lr + lb));
  const target = (1 + 0.3 * t) * lr;
  const m = (1 - target / lg) / 0.3;
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(-100, v * 100)));
  return { temperature: clamp(t), tint: clamp(m) };
}

export type ThresholdParams = { level: number };
export const readThreshold = (p: unknown): ThresholdParams => ({
  level: Math.round(num(p, 'level', 1, 255, 128)),
});

/** A luma table: 256 RGB triples, the colour a pixel of that luma becomes. */
export type LumaMap = Uint8ClampedArray;

export function thresholdMap({ level }: ThresholdParams): LumaMap {
  const out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) out.fill(i >= level ? 255 : 0, i * 3, i * 3 + 3);
  return out;
}

/** Equalize: a table from the luma histogram's cumulative counts, applied to every channel. */
export function equalizeLut(luma: Uint32Array): ChannelLut {
  let total = 0;
  for (const v of luma) total += v;
  const cdf = new Float64Array(256);
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += luma[i]!;
    cdf[i] = acc;
  }
  let first = 0;
  while (first < 255 && cdf[first] === 0) first++;
  const base = cdf[first]!;
  return lutFromCurve((v) => {
    const i = Math.round(v * 255);
    return total > base ? (cdf[i]! - base) / (total - base) : v;
  });
}
