import { rgbToHsv, type ImageBuffer } from './colour';

// Measuring the wall a photograph was taken of, so the paper on it can be told
// apart from it (spec/139 Phase 8).
//
// Twice over, because a photograph of a wall is rarely lit evenly:
//
//   `wallFloorsOf`  — one pair of floors for the whole frame.
//   `localFloorsOf` — a coarse grid of them, bilinearly blended, so a wall
//                     with a window at one end is measured at both ends.
//
// The local version exists because a single frame-wide floor fails in BOTH
// directions at once on a real photo: it is too high for the shaded third
// (paper there reads as wall) and too low for the lit third (sunlit kraft
// reads as paper, bridging every note into one blob the shape filters then
// throw away, notes and all). Measured on six photographs of one workshop
// wall — see docs/vision/sticky-detection.md.

// How much more saturated than the wall a pixel has to be before it is paper.
// Measured on real photographs of kraft-paper walls: the wall sits around 0.15
// and the palest paper on it around 0.35. Too small and the wall's own noise
// is paper; too large and pale paper is wall.
const WALL_SATURATION_MARGIN = 0.14;
// …and no lower than this whatever the wall says, so a white-wall photo does
// not start calling its own shadows paper.
const MIN_PAPER_SATURATION = 0.28;
// Paper is lit; the gaps between notes and the shadow under a curling corner
// are not. Relative to the wall's own brightness rather than absolute, because
// the whole photograph may be dim.
const WALL_VALUE_RATIO = 0.8;
// Below this value a pixel is ink, or a shadow deep enough to be unreadable.
// No wall, however dark, sets a floor under the point where a camera stops
// recording colour at all.
export const VALUE_FLOOR = 0.2;
// The floor a photograph with no measurable wall falls back to.
export const SATURATION_FLOOR = 0.28;

// The floors a particular PHOTOGRAPH needs, rather than the ones a swatch
// would (see `wallFloorsOf`).
export type PaperFloors = { saturation: number; value: number; wallHue: number };

export const DEFAULT_FLOORS: PaperFloors = {
  saturation: SATURATION_FLOOR,
  value: VALUE_FLOOR,
  // A photo with no measurable wall has no hue to keep clear of.
  wallHue: -1,
};

// How coarse the local grid is, on the LONG side of the image (the short side
// gets however many tiles keep the cells roughly square).
//
// The trade: too few tiles and a shadow edge falls inside one cell, which is
// the frame-wide floor's problem again in miniature; too many and a cell is
// smaller than a sticky, so a cell can be all paper and there is no wall left
// in it to measure. Eight over the long side puts a cell at about two notes
// across on a photo framed the way the import asks for.
const FLOOR_TILES_LONG_SIDE = 8;
// Sample every Nth pixel, per axis, inside a tile. A mode and an Otsu split
// need a populated histogram, not every pixel: at this stride a tile of a
// 1000px photo still contributes a couple of thousand samples, and the whole
// grid costs about one pass over a quarter of the image.
const FLOOR_SAMPLE_STRIDE = 2;
// Below this share of its own total variance, a tile's saturation histogram is
// ONE population rather than two, so there is nothing in it to split: the tile
// is all wall or all paper. Which one it is, only the frame can say.
const TILE_BIMODAL_STRENGTH = 0.12;

// Otsu's threshold over a histogram: the cut that minimises the variance
// within the two groups it makes. Returned in the histogram's own units
// (0..1 here, 101 buckets), with the strength of the split — how much of the
// spread that cut actually explains — so a caller can tell a real two-surface
// histogram from one blurry hill.
function otsu(buckets: Int32Array): { at: number; strength: number } {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    total += buckets[i]!;
    sum += i * buckets[i]!;
  }
  if (total === 0) return { at: 0, strength: 0 };
  const mean = sum / total;
  let variance = 0;
  for (let i = 0; i < buckets.length; i += 1) variance += buckets[i]! * (i - mean) ** 2;
  variance /= total;
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let best = 0;
  let bestAt = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    backgroundWeight += buckets[i]!;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += i * buckets[i]!;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const between =
      (backgroundWeight / total) *
      (foregroundWeight / total) *
      (backgroundMean - foregroundMean) ** 2;
    if (between > best) {
      best = between;
      bestAt = i;
    }
  }
  return { at: bestAt / 100, strength: variance > 0 ? best / variance : 0 };
}

// The MODE, not the median. The wall is the one surface the whole frame is
// mostly made of, and the mode finds it whether it covers 90% of the photo or
// 55% — a median is dragged upwards by a densely covered wall, which is
// exactly the case where the paper and the wall are hardest to tell apart (on
// a real photo it put the floor above the notes' own saturation and the
// detector found a sixth of them).
//
// Smoothed over a small window, because a histogram of a photograph is noisy
// and the true peak is a hill rather than a spike.
function modeOf(buckets: Int32Array): number {
  const window = 3;
  let bestAt = 0;
  let best = -1;
  for (let i = 0; i < buckets.length; i += 1) {
    let sum = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(buckets.length - 1, i + window); j += 1) {
      sum += buckets[j]!;
    }
    if (sum > best) {
      best = sum;
      bestAt = i;
    }
  }
  return bestAt / 100;
}

// What one region of a photograph is made of: the saturation and value
// histograms of its lit pixels, and the mean hue direction of its DULL ones —
// which on a kraft wall is the kraft and on a whiteboard is nothing in
// particular.
type Surface = {
  saturation: Int32Array;
  value: Int32Array;
  lit: number;
  // The mean hue DIRECTION per saturation bucket, so the wall's hue can be
  // taken from the dull pixels once it is known how dull the wall is here.
  // Summed as unit vectors: hues are angles, and 350° and 10° average to 0°,
  // not to 180°.
  hueX: Float64Array;
  hueY: Float64Array;
  hueCount: Int32Array;
};

function measure(
  image: { data: Uint8ClampedArray; width: number; height: number },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stride: number,
): Surface {
  const surface: Surface = {
    saturation: new Int32Array(101),
    value: new Int32Array(101),
    lit: 0,
    hueX: new Float64Array(101),
    hueY: new Float64Array(101),
    hueCount: new Int32Array(101),
  };
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i]!;
      const g = image.data[i + 1]!;
      const b = image.data[i + 2]!;
      const max = Math.max(r, g, b);
      // Black is not a surface: it is ink, or a shadow with nothing readable
      // in it, and averaging it into the wall drags every floor down.
      if (max < 24) continue;
      const s = (max - Math.min(r, g, b)) / max;
      const bucket = Math.round(s * 100);
      surface.saturation[bucket]! += 1;
      surface.value[Math.round((max / 255) * 100)]! += 1;
      surface.lit += 1;
      const h = (rgbToHsv({ r, g, b }).h * Math.PI) / 180;
      surface.hueX[bucket]! += Math.cos(h);
      surface.hueY[bucket]! += Math.sin(h);
      surface.hueCount[bucket]! += 1;
    }
  }
  return surface;
}

// The wall's own hue: the mean direction of the pixels too dull to be paper,
// which on a kraft wall is the kraft and on a whiteboard is nothing in
// particular.
//
// "Too dull to be paper" is the floor this same region just measured, not a
// fixed number. A fixed one gets it backwards exactly where it matters: in
// deep shade the paper's saturation drops into any fixed cut, so the note
// starts voting for the wall's hue — and a wall hue pulled onto a red note
// then lets the real wall in as paper everywhere that tile reaches.
function hueOf(surface: Surface, below: number): number {
  let x = 0;
  let y = 0;
  let n = 0;
  const limit = Math.min(100, Math.round(below * 100));
  for (let i = 0; i < limit; i += 1) {
    x += surface.hueX[i]!;
    y += surface.hueY[i]!;
    n += surface.hueCount[i]!;
  }
  if (n === 0) return -1;
  const deg = (Math.atan2(y / n, x / n) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

// What one region measures: the floors it implies, plus the two facts a
// caller needs to decide whether to trust them — how bimodal its saturation
// was (two surfaces, or one) and which saturation that one surface sat at.
type Measured = { floors: PaperFloors; bimodal: boolean; wallSaturation: number };

function floorsOf(surface: Surface): Measured {
  if (surface.lit === 0) {
    return { floors: DEFAULT_FLOORS, bimodal: false, wallSaturation: SATURATION_FLOOR };
  }
  const wallSaturation = modeOf(surface.saturation);
  const wallValue = modeOf(surface.value);
  // Where the wall stops and the paper starts: the threshold that best splits
  // the saturation histogram into two populations (Otsu). A photograph of a
  // wall of sticky notes IS two populations — dull wall, bright paper — and a
  // fixed margin above the wall cannot serve both a pale kraft wall in shade
  // and the same wall under a window.
  //
  // Only when there ARE two populations, though. Otsu always returns a cut,
  // and over a histogram with one hill in it that cut lands inside the hill —
  // i.e. a hair above the wall's own noise, which then reads as paper. A
  // region with nothing but wall in it keeps the margin instead.
  const split = otsu(surface.saturation);
  const bimodal = split.strength >= TILE_BIMODAL_STRENGTH;
  const margin = wallSaturation + WALL_SATURATION_MARGIN;
  const saturation = Math.max(MIN_PAPER_SATURATION, bimodal ? Math.min(split.at, margin) : margin);
  return {
    floors: {
      saturation,
      value: Math.max(VALUE_FLOOR, wallValue * WALL_VALUE_RATIO),
      wallHue: hueOf(surface, saturation),
    },
    bimodal,
    wallSaturation,
  };
}

// Measure the wall over the WHOLE frame. Still the right answer for a question
// about one small region — classifying the paper inside a box the author drew
// — and the fallback the local grid leans on.
export function wallFloorsOf(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): PaperFloors {
  // Every 7th pixel: a mode does not need all four million of them, and this
  // runs on a phone.
  return floorsOf(measure(image, 0, 0, image.width, image.height, 7)).floors;
}

// A grid of floors over the image, blended so no pixel sits on a seam.
export type FloorField = {
  tilesX: number;
  tilesY: number;
  // What the whole frame says, for the tiles that cannot say anything.
  global: PaperFloors;
  // The floors at one pixel, interpolated between the four tiles around it.
  floorsAt: (x: number, y: number) => PaperFloors;
  // The same, written into a caller-owned object. The classifier calls this
  // once per pixel, and a fresh object per pixel is a few million allocations
  // on a photograph.
  floorsInto: (x: number, y: number, out: PaperFloors) => void;
};

export function localFloorsOf(
  image: ImageBuffer,
  opts: { tiles?: number; global?: PaperFloors } = {},
): FloorField {
  const longSide = Math.max(image.width, image.height);
  const tiles = opts.tiles ?? FLOOR_TILES_LONG_SIDE;
  // Roughly square cells: the long side gets `tiles`, the short side gets
  // however many keep the same cell size.
  const cell = Math.max(1, Math.round(longSide / tiles));
  const tilesX = Math.max(1, Math.round(image.width / cell));
  const tilesY = Math.max(1, Math.round(image.height / cell));
  const global = opts.global ?? wallFloorsOf(image);

  const saturation = new Float64Array(tilesX * tilesY);
  const value = new Float64Array(tilesX * tilesY);
  // Hue as a unit vector, so interpolating 350° with 10° gives 0° rather than
  // the 180° a linear blend would invent.
  const hueX = new Float64Array(tilesX * tilesY);
  const hueY = new Float64Array(tilesX * tilesY);

  const globalHue = (global.wallHue * Math.PI) / 180;
  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      const x0 = Math.floor((tx * image.width) / tilesX);
      const x1 = Math.floor(((tx + 1) * image.width) / tilesX);
      const y0 = Math.floor((ty * image.height) / tilesY);
      const y1 = Math.floor(((ty + 1) * image.height) / tilesY);
      const surface = measure(image, x0, y0, x1, y1, FLOOR_SAMPLE_STRIDE);
      const measured = floorsOf(surface);
      const local = measured.floors;
      const i = ty * tilesX + tx;
      // The VALUE floor is always the tile's own: how bright it is there is
      // knowable from whatever surface fills the cell, and that is precisely
      // what a shaded wall needs.
      value[i] = local.value;
      // The SATURATION floor and the wall HUE are the tile's own only when
      // the tile holds two surfaces to compare — wall and paper. One surface
      // filling a cell is unknowable locally: a note bigger than the cell
      // would otherwise be measured as "the wall" and then rejected as not
      // standing out from it, which is how a big sticky disappears. The frame
      // knows which of the two it is; the cell does not, so it defers.
      const trusted = measured.bimodal && surface.lit > 0;
      saturation[i] = trusted ? local.saturation : global.saturation;
      const hue = trusted && local.wallHue >= 0 ? (local.wallHue * Math.PI) / 180 : globalHue;
      const usable = (trusted && local.wallHue >= 0) || global.wallHue >= 0;
      hueX[i] = usable ? Math.cos(hue) : 0;
      hueY[i] = usable ? Math.sin(hue) : 0;
    }
  }

  const cellW = image.width / tilesX;
  const cellH = image.height / tilesY;
  const floorsInto = (x: number, y: number, out: PaperFloors) => {
    // Tile CENTRES carry the measurement, so a pixel between two centres is a
    // blend of both and there is no step at a tile's edge.
    const fx = Math.min(tilesX - 1, Math.max(0, x / cellW - 0.5));
    const fy = Math.min(tilesY - 1, Math.max(0, y / cellH - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(tilesX - 1, x0 + 1);
    const y1 = Math.min(tilesY - 1, y0 + 1);
    const ax = fx - x0;
    const ay = fy - y0;
    const i00 = y0 * tilesX + x0;
    const i10 = y0 * tilesX + x1;
    const i01 = y1 * tilesX + x0;
    const i11 = y1 * tilesX + x1;
    const w00 = (1 - ax) * (1 - ay);
    const w10 = ax * (1 - ay);
    const w01 = (1 - ax) * ay;
    const w11 = ax * ay;
    out.saturation =
      saturation[i00]! * w00 +
      saturation[i10]! * w10 +
      saturation[i01]! * w01 +
      saturation[i11]! * w11;
    out.value = value[i00]! * w00 + value[i10]! * w10 + value[i01]! * w01 + value[i11]! * w11;
    const hx = hueX[i00]! * w00 + hueX[i10]! * w10 + hueX[i01]! * w01 + hueX[i11]! * w11;
    const hy = hueY[i00]! * w00 + hueY[i10]! * w10 + hueY[i01]! * w01 + hueY[i11]! * w11;
    if (hx === 0 && hy === 0) {
      out.wallHue = -1;
      return;
    }
    const deg = (Math.atan2(hy, hx) * 180) / Math.PI;
    out.wallHue = deg < 0 ? deg + 360 : deg;
  };

  return {
    tilesX,
    tilesY,
    global,
    floorsInto,
    floorsAt: (x, y) => {
      const out: PaperFloors = { saturation: 0, value: 0, wallHue: -1 };
      floorsInto(x, y, out);
      return out;
    },
  };
}

export const FLOOR_CALIBRATION = {
  VALUE_FLOOR,
  SATURATION_FLOOR,
  WALL_SATURATION_MARGIN,
  MIN_PAPER_SATURATION,
  WALL_VALUE_RATIO,
  FLOOR_TILES_LONG_SIDE,
  FLOOR_SAMPLE_STRIDE,
  TILE_BIMODAL_STRENGTH,
} as const;
