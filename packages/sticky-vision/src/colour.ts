// Colour, the way a photograph of paper needs it (spec/139 Phase 8).
//
// Hue is what tells an orange domain event from a blue command, and hue is the
// one channel that survives a room's lighting reasonably well — as long as the
// whole image is balanced first, which is what `greyWorldBalance` is for.

import { hexToRgb as parseHex } from '@livediagram/diagram';

export type Rgb = { r: number; g: number; b: number };
// h in 0..360, s and v in 0..1.
export type Hsv = { h: number; s: number; v: number };

export type ImageBuffer = {
  width: number;
  height: number;
  // RGBA, row-major, 4 bytes per pixel — what a canvas hands over.
  data: Uint8ClampedArray;
};

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

// The shortest way round the hue circle, so red at 5° and red at 355° are ten
// degrees apart rather than three hundred and fifty.
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// White balance from the WALL, not from the whole scene.
//
// Plain grey-world assumes the average of an image is grey, and a photograph
// of a sticky wall is the case where that is least true: half the frame is
// saturated paper, so the average leans orange and "correcting" it drains the
// colour out of the very thing being measured — a yellow actor came back pale
// enough to be read as an aggregate.
//
// So the illuminant is estimated from the NEAR-NEUTRAL pixels only: the wall,
// the whiteboard, the shadowed gaps between notes. Those genuinely are grey,
// so whatever tint they carry IS the light in the room. If there are too few
// of them (a photo that is nothing but paper) the image is left alone rather
// than corrected by guesswork.

// Which pixels count as "the wall" is a PERCENTILE, not a fixed saturation:
// the palest paper in the notation sits at 0.23, and a wall under a warm bulb
// can reach the same number, so no single line separates them. The least
// saturated quarter of a photograph of a wall is the wall.
const NEUTRAL_PERCENTILE = 0.25;
// …unless even that quarter is colourful, in which case there is no wall in
// the frame and correcting from paper would drain it.
const NEUTRAL_MAX_SATURATION = 0.35;
// A floor, so a perfectly neutral photo still has pixels to measure.
const NEUTRAL_MIN_SATURATION = 0.15;

export function greyWorldBalance(image: ImageBuffer): ImageBuffer {
  const { width, height, data } = image;
  // Saturation histogram (256 buckets) — a percentile without sorting four
  // million floats.
  const buckets = new Int32Array(256);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    if (max < 24) continue; // too dark to say anything about the light
    const s = (max - Math.min(r, g, b)) / max;
    buckets[Math.min(255, Math.round(s * 255))]! += 1;
    lit += 1;
  }
  if (lit === 0) return image;
  let seen = 0;
  let cutoff = 255;
  const target = lit * NEUTRAL_PERCENTILE;
  for (let b = 0; b < 256; b += 1) {
    seen += buckets[b]!;
    if (seen >= target) {
      cutoff = b;
      break;
    }
  }
  const limit = Math.max(NEUTRAL_MIN_SATURATION, cutoff / 255);
  if (limit > NEUTRAL_MAX_SATURATION) return image;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    if (max < 24) continue;
    if ((max - Math.min(r, g, b)) / max > limit) continue;
    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }
  if (count === 0) return image;
  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  if (avgR < 1 || avgG < 1 || avgB < 1) return image;
  const grey = (avgR + avgG + avgB) / 3;
  const kr = grey / avgR;
  const kg = grey / avgG;
  const kb = grey / avgB;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i]! * kr;
    out[i + 1] = data[i + 1]! * kg;
    out[i + 2] = data[i + 2]! * kb;
    out[i + 3] = data[i + 3]!;
  }
  void width;
  void height;
  return { width, height, data: out };
}

export function pixelAt(image: ImageBuffer, x: number, y: number): Rgb {
  const i = (y * image.width + x) * 4;
  return { r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]! };
}

// A catalogue fill to channels, through the diagram package's one hex parser.
// Every caller passes a `#rrggbb` it owns, so one that doesn't parse is a bug
// and throws, where the old slice-and-parseInt copy handed back NaN channels.
export function hexToRgb(hex: string): Rgb {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`Not a #rrggbb colour: ${hex}`);
  return rgb;
}

export const COLOUR_CALIBRATION = {
  NEUTRAL_PERCENTILE,
  NEUTRAL_MAX_SATURATION,
  NEUTRAL_MIN_SATURATION,
} as const;
