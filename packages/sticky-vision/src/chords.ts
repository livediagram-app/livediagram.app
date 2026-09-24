import type { Box, PaperMask } from './boxes';
import { convexityDefects, largestRegion, traceOuterContour, type Notch } from './contour';

// Cutting a blob at the NOTCHES where two notes meet (spec/139 Phase 9,
// experiment B2).
//
// Two notes lapped over each other, offset by a few pixels, leave an outline
// that turns inwards on both sides of the seam. The straight line between two
// such notches is the seam, and cutting along it hands each note back its own
// pixels — including when the pair is too short for the splitter's length
// rule, which only cuts a blob much longer than a note.

// How deep a notch has to be, as a fraction of the note, to count: shallower
// ones are the ragged edge of a curled corner or a pen stroke at the border.
const NOTCH_MIN_DEPTH = 0.12;
// The longest seam, in notes: two notes meet along at most one side each.
const CHORD_MAX_LENGTH = 1.3;
// Both sides of a cut must be a note: at least this thick in notes, and at
// least this much of a note's area. A tab of paper is not a note.
const PIECE_MIN_SIDE = 0.5;
const PIECE_MIN_AREA = 0.35;
// A block of lapped notes is cut again piece by piece; past this depth it is
// not a block of notes.
const CHORD_MAX_DEPTH = 3;

type Piece = { minX: number; minY: number; maxX: number; maxY: number; pixels: number };

function emptyPiece(): Piece {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, pixels: 0 };
}

function grow(p: Piece, x: number, y: number) {
  if (x < p.minX) p.minX = x;
  if (x > p.maxX) p.maxX = x;
  if (y < p.minY) p.minY = y;
  if (y > p.maxY) p.maxY = y;
  p.pixels += 1;
}

function isNote(p: Piece, noteSize: number): boolean {
  if (p.pixels === 0) return false;
  const side = Math.min(p.maxX - p.minX + 1, p.maxY - p.minY + 1);
  return side >= noteSize * PIECE_MIN_SIDE && p.pixels >= noteSize * noteSize * PIECE_MIN_AREA;
}

// The box's own paper, as a local binary mask of its largest region.
function regionOf(box: Box, mask: PaperMask): Uint8Array {
  const bin = new Uint8Array(box.w * box.h);
  for (let y = 0; y < box.h; y += 1) {
    const row = (y + box.y) * mask.width + box.x;
    for (let x = 0; x < box.w; x += 1) {
      if (mask.classes[row + x] === box.classId) bin[y * box.w + x] = 1;
    }
  }
  return largestRegion(bin, box.w, box.h);
}

// Which side of the line a→b each pixel of the region falls on.
function splitBy(
  region: Uint8Array,
  width: number,
  height: number,
  a: Notch,
  b: Notch,
): [Piece, Piece] {
  const left = emptyPiece();
  const right = emptyPiece();
  const dx = b.at.x - a.at.x;
  const dy = b.at.y - a.at.y;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (region[y * width + x] === 0) continue;
      const side = dx * (y - a.at.y) - dy * (x - a.at.x);
      grow(side < 0 ? left : right, x, y);
    }
  }
  return [left, right];
}

// Cut `box` along the best chord between two of its notches, and each piece
// again, while both sides of a cut are note-sized. A box with no such chord
// comes back as it was.
export function cutAtNotches(box: Box, mask: PaperMask, noteSize: number, depth = 0): Box[] {
  if (noteSize <= 0 || depth >= CHORD_MAX_DEPTH) return [box];
  if (box.w <= 0 || box.h <= 0) return [box];
  const region = regionOf(box, mask);
  const contour = traceOuterContour(region, box.w, box.h);
  const notches = convexityDefects(contour, noteSize * NOTCH_MIN_DEPTH);
  if (notches.length < 2) return [box];
  let best: [Piece, Piece] | null = null;
  let bestScore = 0;
  for (let i = 0; i < notches.length; i += 1) {
    for (let j = i + 1; j < notches.length; j += 1) {
      const a = notches[i]!;
      const b = notches[j]!;
      const length = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y);
      if (length > noteSize * CHORD_MAX_LENGTH) continue;
      const score = a.depth + b.depth;
      if (score <= bestScore) continue;
      const pieces = splitBy(region, box.w, box.h, a, b);
      if (!isNote(pieces[0], noteSize) || !isNote(pieces[1], noteSize)) continue;
      best = pieces;
      bestScore = score;
    }
  }
  if (!best) return [box];
  return best.flatMap((p) =>
    cutAtNotches(
      {
        classId: box.classId,
        x: box.x + p.minX,
        y: box.y + p.minY,
        w: p.maxX - p.minX + 1,
        h: p.maxY - p.minY + 1,
        pixels: p.pixels,
      },
      mask,
      noteSize,
      depth + 1,
    ),
  );
}

export const CHORD_CALIBRATION = {
  NOTCH_MIN_DEPTH,
  CHORD_MAX_LENGTH,
  PIECE_MIN_SIDE,
  PIECE_MIN_AREA,
  CHORD_MAX_DEPTH,
} as const;
