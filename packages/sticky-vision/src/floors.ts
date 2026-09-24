import type { ImageBuffer } from './colour';
import { modeOf, otsu } from './histogram';
import { hueOf, measure, wallLabOf, type Surface } from './surface';

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
const WALL_VALUE_RATIO = 0.7;
// Below this value a pixel is ink, or a shadow deep enough to be unreadable.
// No wall, however dark, sets a floor under the point where a camera stops
// recording colour at all.
export const VALUE_FLOOR = 0.2;
// The floor a photograph with no measurable wall falls back to.
export const SATURATION_FLOOR = 0.28;

// The floors a particular PHOTOGRAPH needs, rather than the ones a swatch
// would (see `wallFloorsOf`).
export type PaperFloors = {
  saturation: number;
  value: number;
  wallHue: number;
  // The wall's own colour in CIELAB a*b*, where it was measured. Without it
  // the classifier decides by HSV alone.
  wallA?: number;
  wallB?: number;
};

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
// How far a one-surface tile's saturation may sit from the FRAME's wall and
// still be taken for wall itself. Within this it measures its own floor —
// which matters on a wall whose own colour is paper-like, where the frame's
// floor is too low and every empty tile would otherwise let the wall in;
// beyond it the tile is full of paper and defers to the frame, or a note
// bigger than a cell would be measured as the wall and then rejected.
const TILE_WALL_TOLERANCE = 0.1;

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
  const wallHue = hueOf(surface, saturation);
  return {
    floors: {
      saturation,
      value: Math.max(VALUE_FLOOR, wallValue * WALL_VALUE_RATIO),
      wallHue,
      ...wallLabOf(surface, saturation),
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
  // Measured once, and kept whole: the tiles need not just the frame's floors
  // but the frame's own WALL saturation, to tell a tile full of wall from a
  // tile full of paper.
  const frame = floorsOf(measure(image, 0, 0, image.width, image.height, 7));
  const global = opts.global ?? frame.floors;

  const saturation = new Float64Array(tilesX * tilesY);
  const value = new Float64Array(tilesX * tilesY);
  // Hue as a unit vector, so interpolating 350° with 10° gives 0° rather than
  // the 180° a linear blend would invent.
  const hueX = new Float64Array(tilesX * tilesY);
  const hueY = new Float64Array(tilesX * tilesY);
  // The wall's a*b*, blended linearly: unlike a hue it is a point, not an angle.
  const wallA = new Float64Array(tilesX * tilesY);
  const wallB = new Float64Array(tilesX * tilesY);
  let wallColourKnown = true;

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
      const trusted =
        surface.lit > 0 &&
        (measured.bimodal ||
          Math.abs(measured.wallSaturation - frame.wallSaturation) <= TILE_WALL_TOLERANCE);
      saturation[i] = trusted ? local.saturation : global.saturation;
      // The wall's colour follows the same trust as its saturation: a cell
      // full of paper would otherwise measure the paper as the wall.
      const colour = trusted && local.wallA !== undefined ? local : global;
      if (colour.wallA === undefined || colour.wallB === undefined) wallColourKnown = false;
      wallA[i] = colour.wallA ?? 0;
      wallB[i] = colour.wallB ?? 0;
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
    if (wallColourKnown) {
      out.wallA = wallA[i00]! * w00 + wallA[i10]! * w10 + wallA[i01]! * w01 + wallA[i11]! * w11;
      out.wallB = wallB[i00]! * w00 + wallB[i10]! * w10 + wallB[i01]! * w01 + wallB[i11]! * w11;
    }
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
  TILE_WALL_TOLERANCE,
} as const;
