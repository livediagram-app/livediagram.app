import type { Box } from './boxes';
import type { ComponentMask } from './components';
import type { CueRect, ModelCues, ModelNote } from './model-cues';

// The classical boxes, corrected by what a boundary model saw (spec/139
// Phase 9, experiment group J).
//
// The two see different things. The classical pipeline reads COLOUR, exactly:
// which paper, and where it is, even pale paper on white. The model reads
// BOUNDARIES: it leaves a seam between two notes that touch, where one colour
// blob runs straight across. So the classical boxes stay the answer, and the
// model only speaks where it sees something the colour cannot:
//
// - split: a box holding two or more notes the model is sure of (J1);
// - add: a note the model is sure of, on paper, where no box is (J2);
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
    // A note already this covered by a box is that box's business.
    maxCover: number;
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

// How much of `r` lies under `b`, as a fraction of `r`.
const coverOf = (r: CueRect, b: CueRect) => {
  const c = clip(r, b);
  return c.w > 0 && c.h > 0 ? (c.w * c.h) / (r.w * r.h) : 0;
};

function medianArea(boxes: readonly CueRect[]): number {
  const areas = boxes.map((b) => b.w * b.h).sort((a, b) => a - b);
  return areas[Math.floor(areas.length / 2)] ?? 0;
}

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
  const median = medianArea(boxes.length ? boxes : cues.notes);
  const sure = (n: ModelNote, r: { minConfidence: number; minAreaOfMedian: number }) =>
    n.confidence >= r.minConfidence && n.w * n.h >= r.minAreaOfMedian * median;

  let out = [...boxes];
  const { drop, split, add } = rules;
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
      if (out.some((b) => coverOf(n, b) >= add.maxCover)) continue;
      const under = paperUnder(mask, n);
      if (under.fraction < add.minPaper) continue;
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
// (0.4-0.6), and under 0.3 of any box (0.4 adds a note beside a neighbour
// that is a real merge).
//
// SPLIT: only where BOTH notes are near certain. On these walls every real
// merge's weaker core reads 0.87 or more, and every single note the model
// sees as two (a line drawn across it) 0.84 or less; 0.84-0.87 score alike,
// 0.83 splits a note. Nothing else measured tells the two apart: the gap
// between the cores is paper, and no darker, in both. Pieces from 0.2 to 0.3
// of the median box; at 0.1 a speck beside a note splits it.
export const HYBRID_RULES: HybridRules = {
  add: { minConfidence: 0.75, minAreaOfMedian: 0.3, minPaper: 0.5, maxCover: 0.3 },
  split: { minConfidence: 0.86, minAreaOfMedian: 0.25 },
};
