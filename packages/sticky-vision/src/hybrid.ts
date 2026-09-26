import type { Box } from './boxes';
import type { ComponentMask } from './components';
import type { CueRect, ModelCues, ModelNote } from './model-cues';
import { median } from './stats';

// The classical boxes, corrected by what a boundary model saw (docs/specs/021-event-storming/event-storming.md
// Phase 9, experiment group J).
//
// The two see different things. The classical pipeline reads COLOUR, exactly:
// which paper, and where it is, even pale paper on white. The model reads
// BOUNDARIES: it leaves a seam between two notes that touch, where one colour
// blob runs straight across. So the classical boxes stay the answer, and the
// model only speaks where it sees something the colour cannot:
//
// - split: a box holding two or more notes the model is sure of (J1);
// - add: a note the model is sure of, on paper, where no box is (J2): no
//   box holds its centre and it holds no box's, so a neighbour that overlaps
//   it (lapped notes do) does not hide it;
// - pad: a note too small for add, among boxes of its own size (N2): a far
//   board of small notes comes as a cluster, junk that small comes alone;
// - drop: a box the model sees as background, with no note in it (J3).
//
// Pure, and ML-free: the model runs elsewhere, lazily, and hands over plain
// arrays (`model-cues.ts`). Every rule is off unless its settings are given.

export type HybridRules = {
  split?: {
    // Every note inside the box must be at least this sure...
    minConfidence: number;
    // ...and at least this fraction of the wall's median box area: a speck of
    // core is not a second note.
    minAreaOfMedian: number;
  };
  add?: {
    minConfidence: number;
    minAreaOfMedian: number;
    // The fraction of the note's box the class mask calls paper: the model
    // finds notes, the colour says they are paper of the notation.
    minPaper: number;
  };
  // A note too small for `add`'s size floor, taken when it sits among boxes
  // of its own size: a far board or a pad of small stationery comes as a
  // cluster of like-sized notes, while junk that small comes alone.
  pad?: {
    minConfidence: number;
    minPaper: number;
    // A sibling's side (square root of its area) within this ratio of the
    // note's, either way...
    sizeRatio: number;
    // ...its centre within this many of the larger side...
    reach: number;
    // ...and at least this many siblings.
    minSiblings: number;
  };
  drop?: {
    // The model's mean background probability over the box's middle.
    minBackground: number;
  };
};

const centreIn = (r: CueRect, b: CueRect) => {
  const x = r.x + r.w / 2;
  const y = r.y + r.h / 2;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
};

const clip = (r: CueRect, to: CueRect): CueRect => {
  const x = Math.max(r.x, to.x);
  const y = Math.max(r.y, to.y);
  return {
    x,
    y,
    w: Math.min(r.x + r.w, to.x + to.w) - x,
    h: Math.min(r.y + r.h, to.y + to.h) - y,
  };
};

const medianArea = (boxes: readonly CueRect[]): number => median(boxes.map((b) => b.w * b.h));

// The paper under a rectangle: its most common class and how many pixels
// carry it, and the fraction that is paper of any class.
function paperUnder(mask: ComponentMask, r: CueRect) {
  const counts = new Map<number, number>();
  let paper = 0;
  let total = 0;
  const x0 = Math.max(0, Math.round(r.x));
  const y0 = Math.max(0, Math.round(r.y));
  const x1 = Math.min(mask.width, Math.round(r.x + r.w));
  const y1 = Math.min(mask.height, Math.round(r.y + r.h));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      const c = mask.classes[y * mask.width + x]!;
      if (c === 0) continue;
      paper += 1;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  let classId = 0;
  let pixels = 0;
  for (const [c, n] of counts) {
    if (n > pixels) [classId, pixels] = [c, n];
  }
  return { classId, pixels, fraction: total ? paper / total : 0 };
}

function boxOn(mask: ComponentMask, r: CueRect, fallbackClass: number): Box {
  const under = paperUnder(mask, r);
  return {
    classId: under.classId || fallbackClass,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    pixels: under.pixels,
  };
}

function meanBackground(cues: ModelCues, b: CueRect): number {
  let sum = 0;
  let n = 0;
  const x1 = Math.min(cues.width, b.x + b.w * 0.75);
  const y1 = Math.min(cues.height, b.y + b.h * 0.75);
  for (let y = Math.max(0, Math.round(b.y + b.h * 0.25)); y < y1; y += 1) {
    for (let x = Math.max(0, Math.round(b.x + b.w * 0.25)); x < x1; x += 1) {
      sum += cues.background[y * cues.width + x]!;
      n += 1;
    }
  }
  return n ? sum / n / 255 : 0;
}

export function combineWithModel(
  boxes: readonly Box[],
  cues: ModelCues,
  mask: ComponentMask,
  rules: HybridRules,
  // Told of every box the model's background drops.
  onDrop: (box: Box) => void = () => {},
): Box[] {
  if (cues.width !== mask.width || cues.height !== mask.height) {
    throw new Error(
      `model cues are ${cues.width}x${cues.height}, the image is ${mask.width}x${mask.height}`,
    );
  }
  const medianBox = medianArea(boxes.length ? boxes : cues.notes);
  const sure = (n: ModelNote, r: { minConfidence: number; minAreaOfMedian: number }) =>
    n.confidence >= r.minConfidence && n.w * n.h >= r.minAreaOfMedian * medianBox;

  let out = [...boxes];
  const { drop, split, add, pad } = rules;
  if (drop) {
    out = out.filter((b) => {
      const keep =
        cues.notes.some((n) => centreIn(n.core, b)) || meanBackground(cues, b) < drop.minBackground;
      if (!keep) onDrop(b);
      return keep;
    });
  }
  if (split) {
    out = out.flatMap((b) => {
      const inside = cues.notes.filter((n) => centreIn(n.core, b) && sure(n, split));
      if (inside.length < 2) return [b];
      return inside.map((n) => boxOn(mask, clip(n, b), b.classId));
    });
  }
  if (add) {
    for (const n of cues.notes) {
      if (!sure(n, add)) continue;
      if (out.some((b) => centreIn(n, b) || centreIn(b, n))) continue;
      const under = paperUnder(mask, n);
      if (under.fraction < add.minPaper) continue;
      out.push(boxOn(mask, n, under.classId));
    }
  }
  if (pad) {
    for (const n of cues.notes) {
      if (n.confidence < pad.minConfidence) continue;
      if (out.some((b) => centreIn(n, b) || centreIn(b, n))) continue;
      const side = Math.sqrt(n.w * n.h);
      const siblings = out.filter((b) => {
        const s = Math.sqrt(b.w * b.h);
        if (s > side * pad.sizeRatio || s * pad.sizeRatio < side) return false;
        const d = Math.hypot(b.x + b.w / 2 - (n.x + n.w / 2), b.y + b.h / 2 - (n.y + n.h / 2));
        return d <= pad.reach * Math.max(s, side);
      });
      if (siblings.length < pad.minSiblings) continue;
      const under = paperUnder(mask, n);
      if (under.fraction < pad.minPaper) continue;
      out.push(boxOn(mask, n, under.classId));
    }
  }
  return out;
}

// The rules that won the sweep on the eight labelled walls, with group E's
// synthetic-only boundary model (docs/vision/experiments/j-hybrid.md).
//
// ADD: a note the model is sure of (mean core probability 0.75; the plateau
// runs 0.7-0.8), at least 0.3 of the median box (0.2-0.4), half on paper
// (0.4-0.6). Where a box is is told by centres, not by overlap: an area cap
// of 0.3 hid notes lapped by a neighbour, and 0.4 let in a real merge.
//
// SPLIT: only where BOTH notes are near certain. On these walls every real
// merge's weaker core reads 0.87 or more, and every single note the model
// sees as two (a line drawn across it) 0.84 or less; 0.84-0.87 score alike,
// 0.83 splits a note. Nothing else measured tells the two apart: the gap
// between the cores is paper, and no darker, in both. Pieces from 0.2 to 0.3
// of the median box; at 0.1 a speck beside a note splits it.
//
// PAD: a note under ADD's size floor, taken when at least three boxes of its
// own size (a side within 1.5 either way) stand within three sides of it:
// the night wall's far board, seen through the window at a tenth of the
// median box. Confidence 0.55-0.7, paper 0.4-0.5, size ratio 1.3-1.7, reach
// 2-4 and two or three siblings all score alike; at confidence 0.72 or paper
// 0.6 a panorama note is lost.
//
// DROP: a box with no model core in it whose middle the model calls
// background at 0.97 on average: the night wall's window panes and a lit
// ceiling strip. 0.95-0.98 drop the same boxes; from 0.93 down a real note
// goes with them.
export const HYBRID_RULES: HybridRules = {
  add: { minConfidence: 0.75, minAreaOfMedian: 0.3, minPaper: 0.5 },
  split: { minConfidence: 0.86, minAreaOfMedian: 0.25 },
  pad: { minConfidence: 0.65, minPaper: 0.45, sizeRatio: 1.5, reach: 3, minSiblings: 3 },
  drop: { minBackground: 0.97 },
};
