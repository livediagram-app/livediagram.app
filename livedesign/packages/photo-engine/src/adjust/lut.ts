// Lookup tables for the per-channel adjustments (docs/specs/031-photo/photo-adjustments.md
// "Formulas"): 256 entries a channel, so Levels, Curves, Exposure and the rest are exact and fast at
// any size, and the GPU draws them from the same table.
import type { Raster } from '../raster/raster';

/** Four tables of 256 bytes: red, green, blue, alpha (alpha the identity unless set). */
export type ChannelLut = Uint8Array;

export function identityLut(): ChannelLut {
  const lut = new Uint8Array(256 * 4);
  for (let c = 0; c < 4; c++) for (let i = 0; i < 256; i++) lut[c * 256 + i] = i;
  return lut;
}

/** A table that applies `f` (0..1 to 0..1) to red, green and blue alike. */
export function lutFromCurve(f: (v: number) => number): ChannelLut {
  const lut = identityLut();
  for (let i = 0; i < 256; i++) {
    const v = Math.round(Math.min(1, Math.max(0, f(i / 255))) * 255);
    lut[i] = v;
    lut[256 + i] = v;
    lut[512 + i] = v;
  }
  return lut;
}

/** A table that applies a per-channel curve to red, green and blue. */
export function lutFromChannels(f: (v: number, channel: 0 | 1 | 2) => number): ChannelLut {
  const lut = identityLut();
  for (let c = 0 as 0 | 1 | 2; c < 3; c = (c + 1) as 0 | 1 | 2) {
    for (let i = 0; i < 256; i++)
      lut[c * 256 + i] = Math.round(Math.min(1, Math.max(0, f(i / 255, c))) * 255);
  }
  return lut;
}

/** `second` after `first`: one table doing both. */
export function composeLuts(first: ChannelLut, second: ChannelLut): ChannelLut {
  const out = new Uint8Array(256 * 4);
  for (let c = 0; c < 4; c++)
    for (let i = 0; i < 256; i++) out[c * 256 + i] = second[c * 256 + first[c * 256 + i]!]!;
  return out;
}

export function isIdentityLut(lut: ChannelLut): boolean {
  for (let c = 0; c < 4; c++)
    for (let i = 0; i < 256; i++) if (lut[c * 256 + i] !== i) return false;
  return true;
}

export function applyLut(r: Raster, lut: ChannelLut): void {
  const d = r.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]!]!;
    d[i + 1] = lut[256 + d[i + 1]!]!;
    d[i + 2] = lut[512 + d[i + 2]!]!;
    d[i + 3] = lut[768 + d[i + 3]!]!;
  }
}

/** sRGB to linear light, and back (IEC 61966-2-1). */
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}
