import type { ImageBuffer } from './colour';
import { labImageOf, type LabImage } from './lab';

// Does a box hold an OBJECT, or a piece cut out of a surface? (spec/139
// Phase 9.)
//
// A sticky note is an object: its paper stops at its edge. Grow the box's own
// colour outwards from its sides, through pixels close to it and not held by
// any other box, and a note's colour runs out at once, while a window pane at
// night runs on into the sky, a patch of bare wall into the wall, and the top
// of a cardboard box into the rest of the box. A missed neighbour of the same
// colour is at most a note's worth of spill; a surface is several.
//
// Paper held by another box does not count, so a row of flush notes of one
// colour, each found, spills nothing into its neighbours.

type Box = { x: number; y: number; w: number; h: number };

// How close (CIE76 ΔE) a pixel's colour must be to the box's paper to count
// as the same surface. Measured on the eight labelled walls: 12 to 16 keep
// every note and score within 0.3 of a point, 14 best; beyond 16 the palest
// notes on a white board start to leak into the board.
const SPILL_DELTA_E = 14;
// How far round the box the growth may reach, in box sizes each way: far
// enough to tell a note's worth of spill from a surface's, and a bound on
// the cost. 2 to 4 score the same.
const SPILL_REACH = 3;
// Spill beyond this many box areas is a surface, not a missed neighbour.
// Measured: the most any labelled note spills is 1.4 of its box (a note
// flush against an unfound one of its colour); window panes, bare kraft and
// the top of a cardboard box 1.6 to 25. 1.5 to 2.5 score the same.
const MAX_SPILL = 1.75;
// The box's paper colour is the median over its interior, inset from the rim
// where the box is only roughly fitted.
const PAPER_INSET = 0.15;

function coverageOf(width: number, height: number, boxes: readonly Box[]): Uint16Array {
  const covered = new Uint16Array(width * height);
  for (const b of boxes) {
    const x1 = Math.min(width, b.x + b.w);
    const y1 = Math.min(height, b.y + b.h);
    for (let y = Math.max(0, b.y); y < y1; y += 1) {
      for (let x = Math.max(0, b.x); x < x1; x += 1) covered[y * width + x]! += 1;
    }
  }
  return covered;
}

function paperOf(lab: LabImage, box: Box): [number, number, number] {
  const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * PAPER_INSET));
  const x0 = Math.max(0, box.x + inset);
  const y0 = Math.max(0, box.y + inset);
  const x1 = Math.min(lab.width, box.x + box.w - inset);
  const y1 = Math.min(lab.height, box.y + box.h - inset);
  const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const planes = [new Float32Array(n), new Float32Array(n), new Float32Array(n)] as const;
  let k = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1, k += 1) {
      const p = y * lab.width + x;
      planes[0][k] = lab.l[p]!;
      planes[1][k] = lab.a[p]!;
      planes[2][k] = lab.b[p]!;
    }
  }
  const median = (values: Float32Array) =>
    values.length === 0 ? 0 : values.sort()[values.length >> 1]!;
  return [median(planes[0]), median(planes[1]), median(planes[2])];
}

// Box areas of same-coloured, unheld paper connected to the box's sides,
// stopping once past `limit`. `covered` counts the boxes over each pixel,
// this one included.
function spillIn(lab: LabImage, covered: Uint16Array, box: Box, limit: number): number {
  const [pl, pa, pb] = paperOf(lab, box);
  const reach = SPILL_DELTA_E * SPILL_DELTA_E;
  const x0 = Math.max(0, box.x - SPILL_REACH * box.w);
  const y0 = Math.max(0, box.y - SPILL_REACH * box.h);
  const x1 = Math.min(lab.width, box.x + box.w + SPILL_REACH * box.w);
  const y1 = Math.min(lab.height, box.y + box.h + SPILL_REACH * box.h);
  const w = x1 - x0;
  const h = y1 - y0;
  const area = Math.max(1, box.w * box.h);
  const cap = limit * area;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < x0 || y < y0 || x >= x1 || y >= y1) return;
    const k = (y - y0) * w + (x - x0);
    if (seen[k]) return;
    seen[k] = 1;
    const p = y * lab.width + x;
    if (covered[p]! > 0) return;
    const dl = lab.l[p]! - pl;
    const da = lab.a[p]! - pa;
    const db = lab.b[p]! - pb;
    if (dl * dl + da * da + db * db < reach) stack.push(k);
  };
  for (let x = box.x; x < box.x + box.w; x += 1) {
    visit(x, box.y - 1);
    visit(x, box.y + box.h);
  }
  for (let y = box.y; y < box.y + box.h; y += 1) {
    visit(box.x - 1, y);
    visit(box.x + box.w, y);
  }
  let grown = 0;
  while (stack.length > 0 && grown <= cap) {
    const k = stack.pop()!;
    grown += 1;
    const x = x0 + (k % w);
    const y = y0 + ((k / w) | 0);
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }
  return grown / area;
}

// How many box areas of the box's own colour run on past its sides, not held
// by any of `others`.
export function spillOf(image: ImageBuffer, box: Box, others: readonly Box[] = []): number {
  const lab = labImageOf(image);
  return spillIn(lab, coverageOf(image.width, image.height, [box, ...others]), box, Infinity);
}

// Drops the boxes cut out of a surface: those whose colour spills more than
// MAX_SPILL of their own area past their sides (see `spillOf`), judged
// against every other box in the frame. Judged again after each drop,
// because a box cut from the same surface as its neighbour hides that
// surface from it: two window panes side by side each see the other as a
// note until one of them is known to be sky.
export function dropSurfaces<T extends Box>(
  image: ImageBuffer,
  boxes: T[],
  onDrop?: (box: T) => void,
): T[] {
  if (boxes.length === 0) return boxes;
  const lab = labImageOf(image);
  let kept = boxes;
  for (;;) {
    const covered = coverageOf(image.width, image.height, kept);
    const next = kept.filter((box) => {
      const surface = spillIn(lab, covered, box, MAX_SPILL) > MAX_SPILL;
      if (surface) onDrop?.(box);
      return !surface;
    });
    if (next.length === kept.length) return next;
    kept = next;
  }
}

export const SPILL_CALIBRATION = {
  SPILL_DELTA_E,
  SPILL_REACH,
  MAX_SPILL,
  PAPER_INSET,
} as const;
