import { EVENT_STORMING_NOTES, type EventStormingNoteKind } from '@livediagram/diagram';
import { hexToRgb, hueDistance, rgbToHsv, type Hsv } from './colour';

// Which note kind a pixel's colour belongs to (spec/139 Phase 8).
//
// The hue CENTRES are derived from the notation's own catalogue — the same
// `EVENT_STORMING_NOTES` fills the palette tiles and the template read from —
// because colour IS the notation here, and a second hand-written table of
// hues is how the detector ends up calling a policy an aggregate six months
// after somebody adjusts a hex.
//
// The BANDS and floors are not derivable: they are calibrated tolerances for
// paper under room light, and they live here as named constants.

export type PixelClass = EventStormingNoteKind | 'wall' | 'ink' | 'unknown';

// The hue BANDS, per kind.
//
// The catalogue fills are the prior, not the truth: real paper under real light
// lands a long way from a swatch. The greens on the operator's wall measure
// h≈86 where the catalogue's read-model is h≈137, and every band below is
// widened to the measured reality rather than to the hex. Where two kinds share
// a hue (the two yellows, and pink) saturation decides — see below.
//
// `from`/`to` walk clockwise round the circle, so a band may wrap through 0.
type HueBand = { kind: EventStormingNoteKind; from: number; to: number };

const HUE_BANDS: HueBand[] = [
  // Orange paper. Starts at 12 so the red-pink hotspot keeps its own ground.
  { kind: 'domain-event', from: 12, to: 44 },
  // Yellow: actor vs aggregate, split by saturation below.
  { kind: 'actor', from: 44, to: 70 },
  // Green, from the yellow-greens a warm room produces to a proper green.
  { kind: 'read-model', from: 70, to: 175 },
  // Blue.
  { kind: 'command', from: 185, to: 250 },
  // Purple. Runs to 305 because the pale lilac the operator's wall uses for a
  // policy measures h≈300 — a swatch would have said 280.
  { kind: 'policy', from: 250, to: 305 },
  // Pink, ALL of it: the operator's walls use pink for hotspots, and the
  // catalogue's external-system pink cannot be told from it in a photograph —
  // both are pink paper, and the pale one the catalogue uses is too pale to
  // clear the paper floor at all on a kraft wall. Hotspot wins; an
  // external-system read as a hotspot is re-kinded in the draft, which is one
  // click, and the alternative is a hotspot read as an external system, which
  // is a risk nobody flagged. See spec/139.
  { kind: 'hotspot', from: 305, to: 12 },
];

// Below this value a pixel is ink, or a shadow deep enough to be unreadable.
const VALUE_FLOOR = 0.2;
// The floor a photograph with no measurable wall falls back to.
const SATURATION_FLOOR = 0.28;
// A pale yellow is an aggregate; a saturated one is an actor (Q18). They sit a
// couple of degrees apart in hue, so saturation is the whole distinction: the
// catalogue's own values are 0.23 (aggregate) and 0.46 (actor), and the line
// goes midway between them.
const PALE_YELLOW_MAX_SATURATION = 0.34;
// The two yellows.
const YELLOW_KINDS = new Set<EventStormingNoteKind>(['actor', 'aggregate']);

// The catalogue's own fills, as HSV. Kept because the bands above are a
// widening OF these — a test asserts every catalogue fill still lands on its
// own kind, so a change to a hex that walks out of its band is caught.
export type PaperClass = {
  kind: EventStormingNoteKind;
  hue: number;
  saturation: number;
  value: number;
};

export const PAPER_CLASSES: PaperClass[] = EVENT_STORMING_NOTES.map((note) => {
  const hsv = rgbToHsv(hexToRgb(note.fill));
  return { kind: note.kind, hue: hsv.h, saturation: hsv.s, value: hsv.v };
});

// Near the WALL's own hue a pixel has to be properly saturated to be paper:
// brown kraft and an orange domain event are the same hue, and only the wall's
// dullness separates them.
const WALL_HUE_NEIGHBOURHOOD_DEG = 34;
// Far from it, much less is needed — a pale purple policy on a brown wall is
// unmistakably not the wall, at any saturation the eye can see.
const OFF_HUE_MIN_SATURATION = 0.18;

// The floors a particular PHOTOGRAPH needs, rather than the ones a swatch
// would (see `wallFloorsOf`).
export type PaperFloors = { saturation: number; value: number; wallHue: number };

export const DEFAULT_FLOORS: PaperFloors = {
  saturation: SATURATION_FLOOR,
  value: VALUE_FLOOR,
  // A photo with no measurable wall has no hue to keep clear of.
  wallHue: -1,
};

function inBand(hue: number, band: HueBand): boolean {
  return band.from <= band.to
    ? hue >= band.from && hue < band.to
    : hue >= band.from || hue < band.to;
}

export function classifyHsv(hsv: Hsv, floors: PaperFloors = DEFAULT_FLOORS): PixelClass {
  if (hsv.v < VALUE_FLOOR) return 'ink';
  if (hsv.v < floors.value) return 'wall';
  // How saturated a pixel must be to be paper depends on whether it shares the
  // wall's hue. Kraft and orange are the same colour, differing only in how
  // dull the wall is; a purple is not the wall at any saturation.
  const nearWallHue =
    floors.wallHue >= 0 && hueDistance(hsv.h, floors.wallHue) <= WALL_HUE_NEIGHBOURHOOD_DEG;
  const needed = nearWallHue
    ? floors.saturation
    : Math.min(floors.saturation, OFF_HUE_MIN_SATURATION);
  if (hsv.s < needed) return 'wall';

  const band = HUE_BANDS.find((b) => inBand(hsv.h, b));
  if (!band) return 'unknown';

  // Actor and aggregate are both yellow paper; only the saturation tells them
  // apart (Q18).
  if (YELLOW_KINDS.has(band.kind)) {
    return hsv.s <= PALE_YELLOW_MAX_SATURATION ? 'aggregate' : 'actor';
  }
  return band.kind;
}

export { HUE_BANDS };

export function classifyRgb(
  r: number,
  g: number,
  b: number,
  floors: PaperFloors = DEFAULT_FLOORS,
): PixelClass {
  return classifyHsv(rgbToHsv({ r, g, b }), floors);
}

// How much more saturated than the wall a pixel has to be before it is paper.
// Measured on real photographs of kraft-paper walls: the wall sits around 0.15
// and the palest paper on it around 0.35.
const WALL_SATURATION_MARGIN = 0.14;
// …and no lower than this whatever the wall says, so a white-wall photo does
// not start calling its own shadows paper.
const MIN_PAPER_SATURATION = 0.28;
// Paper is lit; the gaps between notes and the shadow under a curling corner
// are not. Relative to the wall's own brightness rather than absolute, because
// the whole photograph may be dim.
const WALL_VALUE_RATIO = 0.8;

// The wall's own hue: the mean direction of the LEAST saturated pixels, which
// on a kraft wall is the kraft and on a whiteboard is nothing in particular.
function medianHueOf(image: { data: Uint8ClampedArray }): number {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i < image.data.length; i += 4 * 7) {
    const r = image.data[i]!;
    const g = image.data[i + 1]!;
    const b = image.data[i + 2]!;
    const max = Math.max(r, g, b);
    if (max < 24) continue;
    const s = (max - Math.min(r, g, b)) / max;
    // Only the dull pixels: the wall, never the paper.
    if (s > 0.3) continue;
    const h = (rgbToHsv({ r, g, b }).h * Math.PI) / 180;
    sx += Math.cos(h);
    sy += Math.sin(h);
    n += 1;
  }
  if (n === 0) return -1;
  const deg = (Math.atan2(sy / n, sx / n) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

// Otsu's threshold over a histogram: the cut that minimises the variance
// within the two groups it makes. Returned in the histogram's own units
// (0..1 here, 101 buckets).
function otsu(buckets: Int32Array): number {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    total += buckets[i]!;
    sum += i * buckets[i]!;
  }
  if (total === 0) return 0;
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
    const between = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (between > best) {
      best = between;
      bestAt = i;
    }
  }
  return bestAt / 100;
}

// Measure the wall, so the paper can be told from it. The wall is whatever the
// image is mostly made of: the MEDIAN saturation and value of its lit pixels.
// On a kraft wall that median is the kraft; on a whiteboard it is the board.
export function wallFloorsOf(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): PaperFloors {
  const satBuckets = new Int32Array(101);
  const valBuckets = new Int32Array(101);
  let lit = 0;
  // Every 7th pixel: a median does not need all four million of them, and
  // this runs on a phone.
  for (let i = 0; i < image.data.length; i += 4 * 7) {
    const r = image.data[i]!;
    const g = image.data[i + 1]!;
    const b = image.data[i + 2]!;
    const max = Math.max(r, g, b);
    if (max < 24) continue;
    const s = (max - Math.min(r, g, b)) / max;
    satBuckets[Math.round(s * 100)]! += 1;
    valBuckets[Math.round((max / 255) * 100)]! += 1;
    lit += 1;
  }
  if (lit === 0) return DEFAULT_FLOORS;
  // The MODE, not the median. The wall is the one surface the whole frame is
  // mostly made of, and the mode finds it whether it covers 90% of the photo
  // or 55% — a median is dragged upwards by a densely covered wall, which is
  // exactly the case where the paper and the wall are hardest to tell apart
  // (on a real photo it put the floor above the notes' own saturation and the
  // detector found a sixth of them).
  //
  // Smoothed over a small window, because a histogram of a photograph is noisy
  // and the true peak is a hill rather than a spike.
  const modeOf = (buckets: Int32Array) => {
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
  };
  const wallSaturation = modeOf(satBuckets);
  const wallValue = modeOf(valBuckets);
  // Where the wall stops and the paper starts: the threshold that best splits
  // the saturation histogram into two populations (Otsu). A photograph of a
  // wall of sticky notes IS two populations — dull wall, bright paper — and a
  // fixed margin above the wall cannot serve both a pale kraft wall in shade
  // and the same wall under a window. Floored, so a photo that is ALL paper
  // (one big note) cannot set a threshold below the wall it never saw.
  const split = otsu(satBuckets);
  return {
    saturation: Math.max(
      MIN_PAPER_SATURATION,
      Math.min(split, wallSaturation + WALL_SATURATION_MARGIN),
    ),
    value: Math.max(VALUE_FLOOR, wallValue * WALL_VALUE_RATIO),
    wallHue: medianHueOf(image),
  };
}

export const CALIBRATION = {
  HUE_BANDS,
  SATURATION_FLOOR,
  OFF_HUE_MIN_SATURATION,
  WALL_HUE_NEIGHBOURHOOD_DEG,
  VALUE_FLOOR,
  PALE_YELLOW_MAX_SATURATION,
  WALL_SATURATION_MARGIN,
  MIN_PAPER_SATURATION,
  WALL_VALUE_RATIO,
} as const;
