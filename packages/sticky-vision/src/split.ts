import { fillRatio, MIN_SOLID_FILL, type Box, type PaperMask } from './boxes';

// Cutting a blob that is more than one note into notes (spec/139 Phase 9).
//
// Its own module because it is its own question: everything here is about
// WHERE the boundary between two pieces of paper is, given the mask and how
// big a note is on this wall, and nothing here decides what is a note.

// How elongated a blob has to be before it is more than one note.
//
// The notation's own widest stationery is 300×180 — a ratio of 1.67 — so the
// threshold has to sit above that or every policy would be sawn in half. Two
// squares lapped over each other reach 1.9 even at a generous overlap, which
// is where the line goes.
const SPLIT_RATIO = 1.8;

// …and below this an over-long axis is one note, not two. The gap between the
// two is the dead band: see `splitOversized`.
const SPLIT_KEEP_RATIO = 1.4;

// A blob no thicker than this (in notes) is a BAND — a row or a column of
// notes lapped over each other — and a band gets cut even when it is not
// solid, because a row that sags across a wall leaves half its bounding box
// empty and would otherwise be thrown away whole. A patch of wall that
// squeaked past the colour floor is thick in BOTH directions and is not a
// band, so it is still never diced into notes that were never there.
const SPLIT_BAND_THICKNESS = 2.6;

// How far a cut may wander from the even step to land in a gap, as a fraction
// of the step. Far enough to find the seam between two lapped notes, near
// enough that it cannot walk into the next note.
const CUT_SNAP_FRACTION = 0.3;

// How full the emptiest line near a proposed cut may be, as a fraction of the
// blob's mean density along that axis, before the cut is refused for want of
// a seam. See `cutLines`. Tuned on the eight hand-labelled walls: 0.85 let
// a note photographed close up be cut at a mere dip in its handwriting; 0.7
// helped two walls and cost none, and 0.95 cost two.
const VALLEY_MAX_FILL = 0.7;

// Split a box that is plainly more than one note along its long axis. Two
// overlapping orange events are one blob and two stickies, and a wall has
// plenty of those — so a blob longer than any real silhouette gets cut into
// the number of notes its length implies.
//
// Cut at the even step, SNAPPED to the emptiest line near it when the mask is
// on hand: the valley between two lapped stickies is often only a paper edge,
// so an even cut is the right starting guess, but a few pixels of search finds
// the real seam where there is one. Each cut cell is then tightened back onto
// its own pixels, which is what makes a sagging row of notes come out as
// notes rather than as tall slices of mostly wall.
export function splitOversized(
  box: Box,
  noteSize: number,
  mask?: PaperMask,
  seams?: PaperMask,
): Box[] {
  if (noteSize <= 0) return [box];
  // ONE AXIS AT A TIME, and tighten between cuts.
  //
  // A blob can be several notes wide AND several deep, so a whole field of
  // touching notes has to come apart in both directions — but cutting both at
  // once, as a grid over the bounding box, gets a SAGGING ROW wrong: six notes
  // lapped along a line that drops across the paper have a bounding box two
  // notes tall, and the grid then halves every note in the row. Cutting the
  // longer axis first and tightening each piece onto its own paper answers
  // that: a column of the row tightens back to one note and is not cut again,
  // while a real 2x2 block tightens to a column of two and is.
  //
  // The guard against dicing a patch of wall that squeaked past the colour
  // floor is the same as it was: without a mask to tighten against, a blob is
  // only cut if it is SOLID, or is a thin BAND (a sagging row is neither
  // solid nor square, and only its thickness says it is a single file of
  // paper).
  const band = Math.min(box.w, box.h) <= noteSize * SPLIT_BAND_THICKNESS;
  if (!mask && fillRatio(box) < MIN_SOLID_FILL && !band) return [box];
  return splitAxis(box, noteSize, mask, seams, 0);
}

// How many times a piece may be cut again after being cut. Four is past any
// real block on a wall; it only stops a pathological loop.
const SPLIT_MAX_DEPTH = 4;

function splitAxis(
  box: Box,
  noteSize: number,
  mask: PaperMask | undefined,
  seams: PaperMask | undefined,
  depth: number,
): Box[] {
  // An axis is cut on its length against the NOTE, with a dead band so the
  // two failure modes cannot trade places. Under `SPLIT_KEEP_RATIO` an
  // over-long axis is one note photographed nearer than its neighbours, or
  // the notation's own wide silhouette (1.67 of its height), and is left
  // alone. Over `SPLIT_RATIO` it is as many notes as it is long — the
  // operator's own rule: a box four times the area of a note is not a note.
  //
  // The cut lands on the SEAM between two notes when the paper shows one, and
  // on the even step when it does not. Requiring a seam was tried and cost
  // fifteen points of recall on the operator's walls: two notes of the same
  // colour flush against each other genuinely have no boundary in the mask,
  // and refusing to cut them leaves two notes wearing one box, which is the
  // complaint this work started from.
  const ratioW = box.w / noteSize;
  const ratioH = box.h / noteSize;
  const horizontal = ratioW >= ratioH;
  const ratio = horizontal ? ratioW : ratioH;
  if (depth >= SPLIT_MAX_DEPTH || ratio < SPLIT_RATIO) return [box];
  const pieces = Math.max(2, Math.round(ratio));
  const lines = cutLines(box, pieces, mask, horizontal, seams);
  if (lines.length < 3) return [box];
  const out: Box[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    const cell: Box = {
      classId: box.classId,
      x: horizontal ? lines[i]! : box.x,
      y: horizontal ? box.y : lines[i]!,
      w: horizontal ? lines[i + 1]! - lines[i]! : box.w,
      h: horizontal ? box.h : lines[i + 1]! - lines[i]!,
      pixels: Math.round(box.pixels / (lines.length - 1)),
    };
    const tight = mask ? tightenTo(cell, mask) : cell;
    if (!tight) continue;
    out.push(...splitAxis(tight, noteSize, mask, seams, depth + 1));
  }
  return out.length > 0 ? out : [box];
}

// The boundaries of the cuts across one axis of a box: the even steps, each
// nudged to the emptiest line within reach of it.
//
// The nudge is worth the pixels it costs: two notes lapped over each other
// leave a seam of shadow and paper edge, and a cut that lands ON it puts both
// notes where they really are instead of a few pixels either side. Where
// there is no seam at all — two flush rectangles of identical paper — the
// even step is the honest answer and the nudge changes nothing.
function cutLines(
  box: Box,
  pieces: number,
  mask: PaperMask | undefined,
  horizontal: boolean,
  seams: PaperMask | undefined,
): number[] {
  const from = horizontal ? box.x : box.y;
  const extent = horizontal ? box.w : box.h;
  if (pieces < 2) return [from, from + extent];
  const step = extent / pieces;
  const lines = [from];
  if (!mask) {
    for (let i = 1; i < pieces; i += 1) lines.push(Math.round(from + i * step));
    lines.push(from + extent);
    return lines;
  }
  const reach = Math.round(step * CUT_SNAP_FRACTION);
  // How full a line may be and still be a seam. Mean density along the axis is
  // what a line through the middle of solid paper looks like; a seam between
  // two lapped notes — a paper edge, its shadow — reads a good deal emptier.
  const across = horizontal ? box.h : box.w;
  const mean = Math.min(across, box.pixels / Math.max(1, extent));
  const seamBar = mean * VALLEY_MAX_FILL;
  for (let i = 1; i < pieces; i += 1) {
    const found = emptiestLine(box, Math.round(from + i * step), reach, seams ?? mask, horizontal);
    // NO SEAM, NO CUT. Size alone cannot tell four notes lapped into a square
    // from one note photographed nearer than its neighbours — they are the
    // same rectangle of the same colour at the same fill, and guessing from
    // the size is precisely how the detector came to cut single stickies in
    // half while leaving a 2x2 cluster whole. The paper itself says which:
    // four notes have edges between them and one note does not.
    const cutAt = found.count > seamBar ? Math.round(from + i * step) : found.at;
    if (cutAt > lines[lines.length - 1]!) lines.push(cutAt);
  }
  lines.push(from + extent);
  return lines;
}

function emptiestLine(
  box: Box,
  at: number,
  reach: number,
  mask: PaperMask,
  horizontal: boolean,
): { at: number; count: number } {
  let best = at;
  let bestCount = Infinity;
  for (let offset = -reach; offset <= reach; offset += 1) {
    const line = at + offset;
    let count = 0;
    if (horizontal) {
      if (line <= box.x || line >= box.x + box.w) continue;
      for (let y = box.y; y < box.y + box.h; y += 1) {
        if (mask.classes[y * mask.width + line] === box.classId) count += 1;
      }
    } else {
      if (line <= box.y || line >= box.y + box.h) continue;
      for (let x = box.x; x < box.x + box.w; x += 1) {
        if (mask.classes[line * mask.width + x] === box.classId) count += 1;
      }
    }
    // Ties go to the line nearest the even step, which is why this walks out
    // from the middle and keeps only a STRICT improvement.
    if (count < bestCount) {
      bestCount = count;
      best = line;
    }
  }
  return { at: best, count: bestCount };
}

// Shrink a cut cell back onto the paper actually inside it. Without this a row
// of notes that sags leaves every cell half full of wall, and the shape
// filters reject the lot.
function tightenTo(cell: Box, mask: PaperMask): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pixels = 0;
  const x1 = Math.min(mask.width, cell.x + cell.w);
  const y1 = Math.min(mask.height, cell.y + cell.h);
  for (let y = Math.max(0, cell.y); y < y1; y += 1) {
    for (let x = Math.max(0, cell.x); x < x1; x += 1) {
      if (mask.classes[y * mask.width + x] !== cell.classId) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      pixels += 1;
    }
  }
  if (pixels === 0) return null;
  return {
    classId: cell.classId,
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    pixels,
  };
}

export const SPLIT_CALIBRATION = {
  SPLIT_RATIO,
  SPLIT_KEEP_RATIO,
  SPLIT_BAND_THICKNESS,
  CUT_SNAP_FRACTION,
  VALLEY_MAX_FILL,
} as const;
