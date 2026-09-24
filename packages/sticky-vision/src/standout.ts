import { rgbToHsv, type ImageBuffer } from './colour';

// Does a box hold PAPER, or a patch of the wall that squeaked past the colour
// floor? (spec/139 Phase 9.)
//
// Its own module because it asks its own question, and asks it of the
// PICTURE rather than of the floors: every box reaching here already cleared
// the classifier somewhere inside it, and what is left to decide is whether
// the thing in the box is different from what surrounds it at all.

// How far above its own wall a note has to sit, in saturation, averaged over
// the box. See the filter in `detectStickies`.
const STANDOUT_SATURATION = 0.15;
// A note that is barely more saturated than its wall may still be much
// brighter, or a different hue; both count, at these exchange rates. A hue is
// converted at 60 degrees to a full unit of standing out. Brightness at 0.5:
// tuned on the eight hand-labelled walls, where 0.3 lost pale notes that are
// a third brighter than a darker wall and no more coloured; 0.45 to 0.6 all
// score the same, and 0.5 sits in that plateau.
const VALUE_STANDOUT_WEIGHT = 0.5;
// …and a wall this dark is measured as if it were this dark, so a shadow
// cannot divide by nearly nothing.
const MIN_WALL_VALUE = 0.15;
const HUE_STANDOUT_WEIGHT = 0.25;
// …and below this there is no hue to speak of, only noise.
const HUE_MIN_SATURATION = 0.2;
// How much of the ring around a box is taken to BE the wall. See `standsOut`.
const WALL_RING_QUANTILE = 0.25;
// Does this box hold paper, or a patch of the wall that squeaked past the
// colour floor? Asked of the picture rather than of the floors: a note is
// MORE COLOURED THAN WHAT IS AROUND IT. Masking tape, a shadow in a paper
// seam, a corner of cardboard and the strip of ceiling above the paper are
// all the same colour as their surroundings, whatever a floor made of them.
//
// The ring outside the box is read at its QUARTILE rather than its median,
// because on a dense wall a note's neighbours are other notes: the duller
// quarter of the ring is the wall showing between them.
export function standsOut(
  image: ImageBuffer,
  box: { x: number; y: number; w: number; h: number },
): boolean {
  return standoutOf(image, box) >= STANDOUT_SATURATION;
}

// HOW FAR a box stands out from its wall, in units of saturation: the
// strongest of its three ways of standing out (see below). `standsOut` asks
// whether it clears the bar; a caller weighing a doubtful box — one smaller
// than stationery should be — asks how far over it is.
export function standoutOf(
  image: ImageBuffer,
  box: { x: number; y: number; w: number; h: number },
): number {
  const short = Math.min(box.w, box.h);
  const inset = Math.max(1, Math.round(short * 0.15));
  const reach = Math.max(2, Math.round(short * 0.3));
  const inside: { h: number; s: number; v: number }[] = [];
  const around: { h: number; s: number; v: number }[] = [];
  const satAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
    const i = (y * image.width + x) * 4;
    return rgbToHsv({ r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]! });
  };
  for (let y = box.y + inset; y < box.y + box.h - inset; y += 2) {
    for (let x = box.x + inset; x < box.x + box.w - inset; x += 2) {
      const s = satAt(x, y);
      if (s !== null) inside.push(s);
    }
  }
  for (let y = box.y - reach; y < box.y + box.h + reach; y += 2) {
    for (let x = box.x - reach; x < box.x + box.w + reach; x += 2) {
      if (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h) continue;
      const s = satAt(x, y);
      if (s !== null) around.push(s);
    }
  }
  // Nothing to compare: not a reason to throw paper away.
  if (inside.length === 0 || around.length === 0) return Number.POSITIVE_INFINITY;
  const pick = (values: number[], at: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * at))]!;
  };
  // THE WALL IS THE DULLEST QUARTER OF THE RING. On a dense wall a note's
  // neighbours are other notes, so the ring as a whole is paper and every
  // comparison against it says "this note is unremarkable"; the wall is what
  // shows between them, and it is the dull end of that distribution.
  const bySat = [...around].sort((a, b) => a.s - b.s);
  const wall = bySat.slice(0, Math.max(1, Math.round(bySat.length * WALL_RING_QUANTILE)));
  const wallS = pick(
    wall.map((p) => p.s),
    0.5,
  );
  const wallV = pick(
    wall.map((p) => p.v),
    0.5,
  );
  const wallH = pick(
    wall.map((p) => p.h),
    0.5,
  );
  // Three ways of standing out, and any ONE of them is enough, because the
  // eight papers stand out from a wall differently: an orange event is more
  // SATURATED than kraft, a pale yellow aggregate is barely more saturated but
  // much BRIGHTER, and a lilac policy on a brown wall is neither — it is a
  // different HUE. Junk has none of the three: tape, cardboard, a seam in the
  // paper and the strip of ceiling above it are all the same colour as what
  // surrounds them.
  const satIn = pick(
    inside.map((p) => p.s),
    0.5,
  );
  const dS = satIn - wallS;
  // Brightness is compared RELATIVELY, because half the light halves the
  // difference: a pale note is 50% brighter than the wall behind it whether
  // the window is on this end of the room or the other. An absolute margin
  // finds it in the sun and loses it in the shade, which is the same mistake
  // the frame-wide floors used to make.
  const dV =
    (pick(
      inside.map((p) => p.v),
      0.5,
    ) -
      wallV) /
    Math.max(MIN_WALL_VALUE, wallV);
  const hIn = pick(
    inside.map((p) => p.h),
    0.5,
  );
  // Hue only counts when there is enough colour for a hue to MEAN anything.
  // A white strip of ceiling reports whatever hue its sensor noise felt like,
  // and that is not a note being a different colour from its wall.
  const dH =
    satIn < HUE_MIN_SATURATION ? 0 : Math.min(Math.abs(hIn - wallH), 360 - Math.abs(hIn - wallH));
  // No "paper is brighter than its wall" veto. It is true on brown kraft and
  // FALSE on a whiteboard, where a blue sticky is much darker than the wall:
  // measured on a real one it cost two thirds of the blue notes, and on the
  // kraft walls — where it was added for the navy side of a cardboard box —
  // the fill floor already refuses that cardboard, so it bought nothing.
  return Math.max(dS, dV * VALUE_STANDOUT_WEIGHT, (dH / 60) * HUE_STANDOUT_WEIGHT);
}

export const STANDOUT_CALIBRATION = {
  STANDOUT_SATURATION,
  VALUE_STANDOUT_WEIGHT,
  MIN_WALL_VALUE,
  HUE_STANDOUT_WEIGHT,
  HUE_MIN_SATURATION,
  WALL_RING_QUANTILE,
} as const;
