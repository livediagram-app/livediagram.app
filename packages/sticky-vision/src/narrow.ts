import type { Box, PaperMask } from './boxes';

// Narrow notes (spec/139 Phase 9): a box a note long but thinner than the
// wall's notes. Most are real: an actor (narrower stationery), a note half
// covered by its neighbour, a note photographed at a slant. Some are two small
// square notes stacked, fused by the close; the RAW mask, read before the
// close, still shows the line of wall between them.

// The middle share of the long axis searched for a seam: two stacked notes
// meet near the middle, while a gap near an end is a curled corner or the
// edge of the note's own writing.
const SEAM_SEARCH_FROM = 0.3;
const SEAM_SEARCH_TO = 0.7;

// How full the emptiest line across the middle of a box is, against the mean
// line: near 1 for one note, near 0 where two notes meet. Lines run across
// the SHORT axis and count only paper of the box's own colour.
export function seamAcross(box: Box, raw: PaperMask): number {
  const horizontal = box.w > box.h;
  const along = horizontal ? box.w : box.h;
  const across = horizontal ? box.h : box.w;
  const fills: number[] = [];
  for (let i = 0; i < along; i += 1) {
    let count = 0;
    for (let j = 0; j < across; j += 1) {
      const x = horizontal ? box.x + i : box.x + j;
      const y = horizontal ? box.y + j : box.y + i;
      if (x < 0 || y < 0 || x >= raw.width || y >= raw.height) continue;
      if (raw.classes[y * raw.width + x] === box.classId) count += 1;
    }
    fills.push(count);
  }
  const mean = fills.reduce((a, b) => a + b, 0) / Math.max(1, along);
  if (mean === 0) return 0;
  const middle = fills.slice(
    Math.floor(along * SEAM_SEARCH_FROM),
    Math.max(Math.floor(along * SEAM_SEARCH_FROM) + 1, Math.ceil(along * SEAM_SEARCH_TO)),
  );
  return Math.min(...middle) / mean;
}

// A narrow note is at least this thick and this long, in notes of its
// colour. Measured on the eight labelled walls: every short side from 0.45 to
// 0.55 and long side from 0.85 to 0.95 scores within 0.3 of a point of the
// best; thinner lets tape and seam shadow in, longer loses the actors.
const NARROW_SHORT_RATIO = 0.5;
const NARROW_LONG_RATIO = 0.9;
// …and one note, not two: the emptiest line across its middle keeps at least
// this share of the mean line. The labelled narrow notes keep 0.6 or more;
// fused pairs and the junk this rule would let in keep 0.25 or less, and any
// bar from 0.3 to 0.6 scores the same.
const NARROW_MIN_SEAM = 0.5;

// Is `box` one narrow note, on a wall whose notes of its colour are
// `noteSize`? Without the raw mask there is no seam to read, and the size
// alone decides.
export function isNarrowNote(box: Box, noteSize: number, raw?: PaperMask): boolean {
  const short = Math.min(box.w, box.h);
  const long = Math.max(box.w, box.h);
  if (short < noteSize * NARROW_SHORT_RATIO || long < noteSize * NARROW_LONG_RATIO) return false;
  return raw === undefined || seamAcross(box, raw) >= NARROW_MIN_SEAM;
}

// A narrow note is about twice as long as it is thick: the labelled ones are
// 1.8 to 2.1. A run of them end to end is counted by that, its own
// proportion, and not by the wall's note, which is what cuts a column of two
// slanted notes into three slivers.
const NARROW_RUN_ASPECT = 2;
// …and a run is at most this many notes: longer is a strip of tape.
const NARROW_RUN_MAX = 4;

// A whole box that is a run of narrow notes end to end, cut into them: each
// piece must be a narrow note in its own right, seam test and all, or the run
// is not one and nothing is returned.
export function cutNarrowRun(box: Box, noteSize: number, mask?: PaperMask, raw?: PaperMask): Box[] {
  const short = Math.min(box.w, box.h);
  const long = Math.max(box.w, box.h);
  const count = Math.round(long / (short * NARROW_RUN_ASPECT));
  if (count < 2 || count > NARROW_RUN_MAX) return [];
  const horizontal = box.w > box.h;
  const pieces: Box[] = [];
  for (let i = 0; i < count; i += 1) {
    const from = Math.round((i * long) / count);
    const to = Math.round(((i + 1) * long) / count);
    const piece = horizontal
      ? { ...box, x: box.x + from, w: to - from }
      : { ...box, y: box.y + from, h: to - from };
    pieces.push({ ...piece, parts: undefined, pixels: paperIn(piece, box, mask) });
  }
  return pieces.every((p) => isNarrowNote(p, noteSize, raw)) ? pieces : [];
}

// The paper of the box's colour inside a piece, from the mask where there is
// one; without it the box's own density, pro rata.
function paperIn(piece: Box, box: Box, mask?: PaperMask): number {
  if (!mask) return Math.round((box.pixels * piece.w * piece.h) / Math.max(1, box.w * box.h));
  let count = 0;
  for (let y = piece.y; y < piece.y + piece.h; y += 1)
    for (let x = piece.x; x < piece.x + piece.w; x += 1)
      if (mask.classes[y * mask.width + x] === box.classId) count += 1;
  return count;
}

export const NARROW_CALIBRATION = {
  SEAM_SEARCH_FROM,
  SEAM_SEARCH_TO,
  NARROW_SHORT_RATIO,
  NARROW_LONG_RATIO,
  NARROW_MIN_SEAM,
  NARROW_RUN_ASPECT,
  NARROW_RUN_MAX,
} as const;
