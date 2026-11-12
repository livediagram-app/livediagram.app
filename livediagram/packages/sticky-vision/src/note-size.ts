// The note size a photo is working at (docs/specs/021-event-storming/event-storming.md Phase 8): the median short
// side of the blobs solid and square enough to count as notes, for the whole wall or per colour. boxes.ts measures,
// merges and filters against it.

import { fillRatio, type Box } from './boxes';
import { median } from './stats';

// The note size this photo is working at: the median blob's SHORT side.
//
// The short side, not the long one, and not the area: a sticky lapped over
// another is twice as long as it should be but exactly as tall, and two notes
// side by side are one blob whose height is still one note. The short side is
// the dimension overlap does not inflate.
export function medianNoteSize(boxes: Box[]): number {
  return median(boxes.map((b) => Math.min(b.w, b.h)));
}

// How solid, and how square, a blob has to be before it is allowed to have an
// opinion about how big a note is on this wall. A note is a filled rectangle;
// a strip of masking tape, a shadow line along a seam and the web left by a
// patch of sunlit kraft are none of those, and they outnumber the notes.
const SIZE_SAMPLE_MIN_FILL = 0.5;
const SIZE_SAMPLE_MAX_ASPECT = 2.4;
// Below this many note-shaped blobs there is no population to take a median
// of, only a coincidence.
const MIN_SIZE_SAMPLE = 3;
// …and before ONE COLOUR gets a size of its own, eight of them. A scarce
// colour on a wall is as likely to be junk as notes, pale masking tape reads
// as a yellow note, a cardboard corner as an orange one, and measured from
// three or four of those scraps it came out a third of a real note, which let
// every scrap of its colour through. Measured on the hand-labelled walls: the
// colours that were really a smaller pad had 21 whole notes behind them; the
// ones that were tape had 3 to 7. Any value from 8 to 20 scores the same on
// all eight walls; 10 sits in that plateau rather than on its edge.
const MIN_CLASS_SIZE_SAMPLE = 10;

// The note size, measured BEFORE anything is fused.
//
// This is the number every threshold below divides by, and it was being taken
// after the morphological close, which is exactly where it cannot be trusted,
// because a close that welds four notes into a bar has already destroyed the
// population it would be measured from. Measured here instead, on the raw
// blobs, with the obvious non-notes dropped first: on the operator's six walls
// that lands within a few pixels of the hand-labelled median (50 vs 52, 49 vs
// 55, 36 vs 38), where the old number was less than half of it (24 vs 55) and
// every rule that divides by it, the close radius, the split, the too-big
// filter, was wrong by the same factor.
// A raw blob that could be a whole note: bigger than noise, not a strip, and
// mostly paper. What the note size is measured from.
export function isPlausibleNote(b: Box, noiseFloor: number): boolean {
  const short = Math.max(1, Math.min(b.w, b.h));
  if (short < noiseFloor) return false;
  if (Math.max(b.w, b.h) / short > SIZE_SAMPLE_MAX_ASPECT) return false;
  return fillRatio(b) >= SIZE_SAMPLE_MIN_FILL;
}

export function estimateNoteSize(boxes: Box[], noiseFloor: number): number {
  const plausible = boxes.filter((b) => isPlausibleNote(b, noiseFloor));
  // Nothing on this wall looks like a whole note, every blob is a strip of a
  // note the handwriting cut up, or a scrap. Say so (0) rather than answer
  // with the median of the scraps: the caller then falls back to what it can
  // know without the wall, which is the frame's own pen stroke.
  if (plausible.length < MIN_SIZE_SAMPLE) return 0;
  return medianNoteSize(plausible);
}

// The note size of each paper colour, measured the same way as the wall's
// (see `estimateNoteSize`), for every colour with enough whole notes to
// measure. Colours too scarce to measure are absent: the wall's size stands.
export function estimateNoteSizes(
  boxes: Box[],
  noiseFloor: number,
  minSample = MIN_CLASS_SIZE_SAMPLE,
): Map<number, number> {
  const byClass = new Map<number, Box[]>();
  for (const b of boxes) byClass.set(b.classId, [...(byClass.get(b.classId) ?? []), b]);
  const sizes = new Map<number, number>();
  for (const [classId, group] of byClass) {
    const plausible = group.filter((g) => isPlausibleNote(g, noiseFloor));
    if (plausible.length < minSample) continue;
    sizes.set(classId, medianNoteSize(plausible));
  }
  return sizes;
}
