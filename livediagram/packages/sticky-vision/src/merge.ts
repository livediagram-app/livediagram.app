// Merging the fragments of one note (docs/specs/021-event-storming/event-storming.md Phase 8): handwriting cuts a
// sticky into several same-colour blobs, and this puts them back together while the result still looks like paper,
// keeping the pieces so fitBoxes can hand them back.

import { fillRatio, type Box } from './boxes';

// Two same-colour boxes this close (relative to the note size) are one note
// the handwriting split in half.
export const MERGE_GAP_FRACTION = 0.12;
// …and only while the result still looks like paper. The merge is
// TRANSITIVE, each union grows the box, which brings the next fragment
// within reach, so on a real wall a sprinkling of stray paper-coloured
// pixels chains every note in the frame into one blob (measured: 856×497 at
// fill 0.20, holding a dozen real notes, thrown away whole by the shape
// filters). A note's own fragments all live inside the note, so merging them
// keeps the box dense; two specks a hand's width apart do not. Too low and
// the chain comes back; too high and a note shattered by heavy handwriting is
// left in pieces.
const MERGE_MIN_FILL = 0.55;
// How far apart two pieces may be when the merge would leave them nearly
// solid, and how solid that has to be. See `mergeFragments`.
const MERGE_REACH_FRACTION = 0.3;
const MERGE_REACH_MIN_FILL = 0.7;
// Enough for a note shattered into a long chain of fragments; the loop exits
// as soon as a pass changes nothing.
const MAX_MERGE_PASSES = 12;
function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

export function partsOf(box: Box): Box[] {
  return box.parts ?? [box];
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    classId: a.classId,
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
    pixels: a.pixels + b.pixels,
    parts: [...partsOf(a), ...partsOf(b)],
  };
}

// A piece at least this thick (in notes) is a WHOLE note already, not a
// fragment of one: two such pieces are never merged. A line of handwriting or
// a shadow cuts a note into pieces thinner than half a note, while two narrow
// actors or two notes a pen stroke apart are each thicker, and their union is
// a solid rectangle the fill test happily accepts. Measured on the eight
// labelled walls, of 62 unions of several pieces 25 joined two labelled notes;
// any value from 0.4 to 0.5 scores the same (0.55 lets one pair back in).
const WHOLE_NOTE_SIDE = 0.45;

function isWholeNote(b: Box, noteSize: number): boolean {
  return Math.min(b.w, b.h) >= noteSize * WHOLE_NOTE_SIDE;
}

// Merge same-colour boxes that are touching or nearly so: one sticky with a
// word written across it arrives as two or three blobs of paper.
export function mergeFragments(boxes: Box[], noteSize: number): Box[] {
  const gap = noteSize * MERGE_GAP_FRACTION;
  // A merge that would turn two pieces of paper into a mostly-empty rectangle
  // is not a note being reassembled; it is two different notes, or two specks.
  // …and a SECOND reach, further out, for a merge that comes back nearly
  // solid. A shadow edge crossing a note leaves two pieces a quarter of a note
  // apart with nothing but wall-coloured paper between them, which no
  // pen-stroke reach will ever join; two scraps of junk that far apart
  // practically never make a solid rectangle together.
  const reach = noteSize * MERGE_REACH_FRACTION;
  const joins = (a: Box, b: Box) => {
    if (a.classId !== b.classId) return false;
    if (isWholeNote(a, noteSize) && isWholeNote(b, noteSize)) return false;
    const between = gapBetween(a, b);
    if (between > reach) return false;
    const fill = fillRatio(union(a, b));
    return between <= gap ? fill >= MERGE_MIN_FILL : fill >= MERGE_REACH_MIN_FILL;
  };
  let out: Box[] = boxes.map((b) => ({ ...b }));
  // To a FIXED POINT, not one pass. Merging a fragment into a box grows that
  // box, which brings the next fragment within reach, one pass leaves a note
  // as three boxes and the note size as a fragment's, which poisons every
  // threshold downstream. Bounded by the fact that each pass strictly reduces
  // the count.
  for (let pass = 0; pass < MAX_MERGE_PASSES; pass += 1) {
    const next: Box[] = [];
    for (const box of out) {
      const hit = next.findIndex((o) => joins(o, box));
      if (hit === -1) next.push({ ...box });
      else next[hit] = union(next[hit]!, box);
    }
    if (next.length === out.length) return next;
    out = next;
  }
  return out;
}

// How deep the rescue erodes, as a fraction of the note size, before counting
// the pieces of a block that no geometric rule could take apart. Deep enough
// to break the seam between two lapped notes, shallow enough that a note is
