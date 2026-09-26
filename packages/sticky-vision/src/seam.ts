import type { Box, PaperMask } from './boxes';
import type { ImageBuffer } from './colour';
import { median } from './stats';

// The SEAM between two notes that touch (spec/139 Phase 9, experiment B3).
//
// Two notes of one colour lapped or butted together are one blob to the
// colour mask, and when they are flush their outline has no notch either. The
// photograph still shows where one ends: the upper note's edge and the thin
// shadow it casts, a line a little darker than the paper on both sides of it,
// running the whole way across. Handwriting is darker still — so dark pixels
// are left out rather than counted — and it never runs the whole way across,
// which is why a seam is scored by the MEDIAN along the line: a line through
// one note's writing has paper under most of it, and paper has no valley.
//
// Two flush notes need not show a shadow at all: one may simply be lit a
// little less than the other, so the paper's level STEPS at the seam. A step
// is weaker evidence than a valley (the edge of a line of writing and the
// light falling off across one note make steps too), so it is trusted only
// across a box long enough to be two notes (see `STEP_MIN_SPAN`).

export type Luminance = { width: number; height: number; data: Uint8Array };

// Rec. 601 luma, one byte per pixel: all a seam needs is how bright.
export function luminanceOf(image: ImageBuffer): Luminance {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < out.length; p += 1, i += 4) {
    out[p] = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
  }
  return { width, height, data: out };
}

// How much darker than the paper either side of it a line has to be, as the
// median over its length, to be a seam (luma levels, 0–255).
const SEAM_MIN_DEPTH = 12;
// A seam no nearer a side of the box than this, in notes: each side of it
// has to be a note.
const SEAM_MIN_PIECE = 0.55;
// …and the box at least this long across the seam, in notes. A note with a
// crease, a curl or a line of writing across it shows a line just like a seam,
// and in a box barely longer than a note that line is far likelier than two
// notes lapped nearly flush. Measured on the eight labelled walls: of 73
// seams found, 66 crossed a single note, most of them in boxes 1.05–1.25
// notes long; the ones between two notes that can be told apart were in
// boxes 1.3–1.75 long. With the note size read locally (see `size-field.ts`),
// 1.35 to 1.5 all score TOTAL 94.1 (merged 20–21); 1.3 finds one actor
// fewer on the panorama, 1.25 costs the whiteboard a note.
const SEAM_MIN_SPAN = 1.4;
// How far a seam may lean, as a fraction of its length: notes are stuck on
// by hand.
const SEAM_MAX_TILT = 0.08;
// …and a STEP in the paper's level counts as a seam, as deep as the valley
// has to be, only across a box at least this long (in notes). Measured on
// the eight labelled walls: from 1.4 to 1.65 it parts flush pairs on the
// whiteboard and the panorama's columns of actors (TOTAL 90.7 → 91.5–91.6,
// merged 29 → 28); at 1.7 the whiteboard's pairs, 1.68–1.74 notes long, are
// out of reach again, and a stricter step (16 levels) gives one back.
const STEP_MIN_SPAN = 1.6;
// A pixel this much darker than the box's paper is ink, not shadow.
const INK_BELOW_PAPER = 60;
// The ends of a line are left out: a note's own border shadow sits there.
const SEAM_INSET = 0.1;
// …and a line with ink under more than half of it says nothing.
const SEAM_MIN_PAPER = 0.5;
// A block of notes is cut again piece by piece, up to this depth.
const SEAM_MAX_DEPTH = 3;

export type Seam = {
  vertical: boolean;
  // Where the line crosses the middle of the box, in image pixels.
  at: number;
  // How far it moves over its length, in pixels.
  tilt: number;
  // The median valley depth along it.
  depth: number;
};

function paperLevel(lum: Luminance, box: Box): number {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y += 1)
    for (let x = box.x; x < box.x + box.w; x += 1) {
      hist[lum.data[y * lum.width + x]!]! += 1;
      n += 1;
    }
  // The brighter part of the box: most of a note is paper, the rest is ink
  // and shadow.
  let seen = 0;
  for (let v = 0; v < 256; v += 1) {
    seen += hist[v]!;
    if (seen >= n * 0.6) return v;
  }
  return 255;
}

// The x (vertical line) or y (horizontal line) of the line at step `t` of its
// length.
function lineAt(at: number, tilt: number, t: number, length: number): number {
  return Math.round(at + (tilt * (t - length / 2)) / length);
}

// How strongly a line reads as a seam: the median valley along it, or,
// where `steps` is set, the median step across it when that is larger.
function seamDepthAlong(
  lum: Luminance,
  box: Box,
  vertical: boolean,
  at: number,
  tilt: number,
  paper: number,
  steps: boolean,
): number | null {
  const length = vertical ? box.h : box.w;
  const start = vertical ? box.y : box.x;
  const inset = Math.round(length * SEAM_INSET);
  const { width, height, data } = lum;
  const dips: number[] = [];
  const rises: number[] = [];
  let samples = 0;
  for (let t = inset; t < length - inset; t += 1) {
    const across = lineAt(at, tilt, t, length);
    const along = start + t;
    const x = vertical ? across : along;
    const y = vertical ? along : across;
    if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) continue;
    samples += 1;
    const step = vertical ? 1 : width;
    const p = y * width + x;
    const centre = Math.min(data[p - step]!, data[p]!, data[p + step]!);
    if (centre < paper - INK_BELOW_PAPER) continue;
    const before = (data[p - 2 * step]! + data[p - 3 * step]! + data[p - 4 * step]!) / 3;
    const after = (data[p + 2 * step]! + data[p + 3 * step]! + data[p + 4 * step]!) / 3;
    dips.push(Math.min(before, after) - centre);
    rises.push(after - before);
  }
  if (samples === 0 || dips.length < samples * SEAM_MIN_PAPER) return null;
  const dip = median(dips);
  // Signed, so a step only counts when the paper changes the SAME way the
  // whole length of the line, as it does from one note to the next.
  return steps ? Math.max(dip, Math.abs(median(rises))) : dip;
}

// The deepest seam across the box that leaves a note either side of it, or
// null when there is none.
export function findSeam(lum: Luminance, box: Box, noteSize: number): Seam | null {
  if (noteSize <= 0) return null;
  const paper = paperLevel(lum, box);
  const margin = Math.round(noteSize * SEAM_MIN_PIECE);
  let best: Seam | null = null;
  for (const vertical of [true, false]) {
    const from = vertical ? box.x : box.y;
    const extent = vertical ? box.w : box.h;
    const length = vertical ? box.h : box.w;
    if (extent < noteSize * SEAM_MIN_SPAN) continue;
    const steps = extent >= noteSize * STEP_MIN_SPAN;
    const maxTilt = Math.round(length * SEAM_MAX_TILT);
    for (let at = from + margin; at <= from + extent - margin; at += 1) {
      // Upright first, leaning further each step: of two equally deep
      // lines the straighter one is the seam, the other only grazes it.
      for (let k = 0; k <= 2 * maxTilt; k += 1) {
        const tilt = k % 2 === 0 ? k / 2 : -(k + 1) / 2;
        const depth = seamDepthAlong(lum, box, vertical, at, tilt, paper, steps);
        if (depth === null || depth < SEAM_MIN_DEPTH) continue;
        if (!best || depth > best.depth) best = { vertical, at, tilt, depth };
      }
    }
  }
  return best;
}

// Cut a box at its seam, each side tightened onto its own paper, and each
// piece again while it has one. A box with no seam comes back as it was.
export function cutAtSeam(
  box: Box,
  lum: Luminance,
  mask: PaperMask,
  noteSize: number,
  depth = 0,
): Box[] {
  if (depth >= SEAM_MAX_DEPTH) return [box];
  const seam = findSeam(lum, box, noteSize);
  if (!seam) return [box];
  const sides = [
    { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, pixels: 0 },
    { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, pixels: 0 },
  ];
  const length = seam.vertical ? box.h : box.w;
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      if (mask.classes[y * mask.width + x] !== box.classId) continue;
      const t = seam.vertical ? y - box.y : x - box.x;
      const line = lineAt(seam.at, seam.tilt, t, length);
      const side = sides[(seam.vertical ? x : y) <= line ? 0 : 1]!;
      if (x < side.minX) side.minX = x;
      if (x > side.maxX) side.maxX = x;
      if (y < side.minY) side.minY = y;
      if (y > side.maxY) side.maxY = y;
      side.pixels += 1;
    }
  }
  if (sides.some((s) => s.pixels === 0)) return [box];
  return sides.flatMap((s) =>
    cutAtSeam(
      {
        classId: box.classId,
        x: s.minX,
        y: s.minY,
        w: s.maxX - s.minX + 1,
        h: s.maxY - s.minY + 1,
        pixels: s.pixels,
      },
      lum,
      mask,
      noteSize,
      depth + 1,
    ),
  );
}

export const SEAM_CALIBRATION = {
  SEAM_MIN_DEPTH,
  SEAM_MIN_PIECE,
  SEAM_MIN_SPAN,
  SEAM_MAX_TILT,
  STEP_MIN_SPAN,
  INK_BELOW_PAPER,
  SEAM_INSET,
  SEAM_MIN_PAPER,
  SEAM_MAX_DEPTH,
} as const;
