import type { Box, PaperMask } from './boxes';
import type { Luminance } from './seam';

// The seam between two notes of one kind from DIFFERENT PADS (spec/139
// Phase 9).
//
// An orange-yellow actor stuck flush beside a lemon one is one blob to the
// colour mask (both are actor yellow), and often shows neither a shadow nor
// a step in brightness between them. Their paper is plainly different
// colours, though, and a note's own paper is one colour from edge to edge:
// the light falling off across it changes how bright it is far more than
// what colour. So the seam is the line that splits the box's paper into two
// sides whose MEDIAN colours differ most, ink left out; a median, because a
// line of blue writing is a minority of either side.

// How far apart the two sides' median paper colours must be, in either
// opponent channel (red − green, or yellow − blue: RGB levels), for the line
// between them to be a seam. The panorama's orange-yellow and lemon actors
// differ by about 35 in red − green. Measured on the eight labelled walls:
// 28–32 part one or two such pairs and cost no wall a note; from 36 up none
// is parted; at 25 and below the seam also cuts the panorama's lattice of
// small actors in the wrong places, and four notes are lost.
const HUE_SEAM_MIN_STEP = 30;

// The opponent channels are differences of two bytes: -255..255.
const BINS = 511;
const OFFSET = 255;

export type HueSeam = { vertical: boolean; at: number; step: number };

// The median of the `count` values in `hist` from `at`, as a channel value.
function medianOf(hist: Int32Array, at: number, count: number): number {
  const half = count / 2;
  let seen = 0;
  for (let v = 0; v < BINS; v += 1) {
    seen += hist[at + v]!;
    if (seen >= half) return v - OFFSET;
  }
  return BINS - 1 - OFFSET;
}

// The upright line across `box` that splits its paper into the two most
// differently coloured sides, each at least `margin` pixels thick and the
// box at least `minExtent` long across the line, or null
// when no line parts them by `HUE_SEAM_MIN_STEP`. `paperFloor`: a pixel
// darker than this is ink, not paper.
//
// The sides are compared by the median colour of their paper, which keeps
// writing out. A median, though, is as far apart anywhere that leaves a
// majority of each pad on its own side, so WHERE the seam runs is told by
// the lines: each line across the axis read as its median colour, the seam
// goes where the mean of those lines differs most from one side to the other.
export function findHueSeam(
  lum: Luminance,
  box: Box,
  margin: number,
  minExtent: number,
  paperFloor: number,
  mask?: PaperMask,
): HueSeam | null {
  const { redGreen, yellowBlue } = lum;
  if (!redGreen || !yellowBlue) return null;
  let best: HueSeam | null = null;
  for (const vertical of [true, false]) {
    const extent = vertical ? box.w : box.h;
    if (extent < Math.max(minExtent, 2 * margin)) continue;
    const channels = [redGreen, yellowBlue];
    const hists = channels.map(() => new Int32Array(extent * BINS));
    const counts = new Int32Array(extent);
    for (let y = box.y; y < box.y + box.h; y += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        if (mask && mask.classes[y * mask.width + x] !== box.classId) continue;
        const p = y * lum.width + x;
        if (lum.data[p]! < paperFloor) continue;
        const k = vertical ? x - box.x : y - box.y;
        for (let c = 0; c < 2; c += 1) hists[c]![k * BINS + channels[c]![p]! + OFFSET]! += 1;
        counts[k]! += 1;
      }
    }
    // Running sums of count × line median, per channel, and of counts.
    const sums = channels.map(() => new Float64Array(extent + 1));
    const weights = new Float64Array(extent + 1);
    for (let k = 0; k < extent; k += 1) {
      const n = counts[k]!;
      weights[k + 1] = weights[k]! + n;
      for (let c = 0; c < 2; c += 1)
        sums[c]![k + 1] = sums[c]![k]! + (n > 0 ? n * medianOf(hists[c]!, k * BINS, n) : 0);
    }
    const all = weights[extent]!;
    const totals = hists.map((h) => {
      const t = new Int32Array(BINS);
      for (let k = 0; k < extent; k += 1)
        for (let v = 0; v < BINS; v += 1) t[v]! += h[k * BINS + v]!;
      return t;
    });
    const before = hists.map(() => new Int32Array(BINS));
    const after = hists.map(() => new Int32Array(BINS));
    let place = -1;
    let found: HueSeam | null = null;
    for (let at = 1; at <= extent - margin; at += 1) {
      for (let c = 0; c < 2; c += 1)
        for (let v = 0; v < BINS; v += 1) before[c]![v]! += hists[c]![(at - 1) * BINS + v]!;
      const left = weights[at]!;
      if (at < margin || left === 0 || left === all) continue;
      let step = 0;
      let lines = 0;
      for (let c = 0; c < 2; c += 1) {
        for (let v = 0; v < BINS; v += 1) after[c]![v] = totals[c]![v]! - before[c]![v]!;
        step = Math.max(
          step,
          Math.abs(medianOf(before[c]!, 0, left) - medianOf(after[c]!, 0, all - left)),
        );
        const mean = sums[c]![at]! / left;
        const rest = (sums[c]![extent]! - sums[c]![at]!) / (all - left);
        lines = Math.max(lines, Math.abs(mean - rest));
      }
      if (step < HUE_SEAM_MIN_STEP || lines <= place) continue;
      place = lines;
      // The last line of the first side: `cutAtSeam` keeps a line with the
      // side before it.
      found = { vertical, at: (vertical ? box.x : box.y) + at - 1, step };
    }
    if (found && (!best || found.step > best.step)) best = found;
  }
  return best;
}

export const PAPER_HUE_CALIBRATION = { HUE_SEAM_MIN_STEP } as const;
