import { fillRatio, type Box } from './boxes';

// Pads of small notes (spec/139 Phase 9). A wall's size floor throws away
// what is much smaller than its notes, and that is right for a scrap of tape
// or a corner of cardboard: scraps come alone and in every size. A second,
// smaller board in the photograph, or a pad of smaller stationery, comes as a
// CLUSTER of like-sized, square, solid boxes, and that is what is kept here.
// Every constant below sits in a plateau measured on the eight labelled walls
// (each neighbour tried scores within 0.3 of a point).

// How square and how solid a pad note is.
const PAD_MAX_ASPECT = 1.5;
const PAD_MIN_FILL = 0.6;
// Pad notes are smaller than the wall's: at this share of its note size a box
// already clears the size floor, or is something else.
const PAD_MAX_SIZE = 0.7;
// Two boxes are siblings when their short sides are within this ratio of each
// other and their centres within this many of the larger short side (a pad's
// notes sit a note or two apart).
const PAD_SIZE_RATIO = 1.3;
const PAD_REACH = 3;
// …and a pad is at least this many siblings, linked one to the next.
const PAD_MIN_NOTES = 3;
// A refused box at least this elongated, beside a pad, is pad notes the
// close fused into a row or a column, and is cut into squares to join it.
// Any value from 1.6 to 1.85 scores the same; below, a narrow note would be
// cut in half; above, a fused pair (about 2) is missed.
const FUSED_MIN_ASPECT = 1.75;
// …into at most this many.
const FUSED_MAX_NOTES = 4;
// A cut square joins a pad with a looser size match than a seed, because the
// seeds it is matched against are often partial notes. 1.3 to 1.9 all score
// within 0.2 of a point.
const FUSED_SIZE_RATIO = 1.5;
// Two reports of one box (a piece and a part of it) overlap this much.
const SAME_BOX_IOU = 0.5;
// A refused box lying this much over a kept note is part of that note.
const MAX_KEPT_OVERLAP = 0.25;

function intersection(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}

function iou(a: Box, b: Box): number {
  const i = intersection(a, b);
  return i / Math.max(1, a.w * a.h + b.w * b.h - i);
}

const shortOf = (b: Box) => Math.min(b.w, b.h);
const isSquare = (b: Box) => Math.max(b.w, b.h) / Math.max(1, shortOf(b)) <= PAD_MAX_ASPECT;
const isSmall = (b: Box, noteSize: number) => shortOf(b) <= noteSize * PAD_MAX_SIZE;

function siblings(a: Box, b: Box, sizeRatio = PAD_SIZE_RATIO): boolean {
  const sa = shortOf(a);
  const sb = shortOf(b);
  if (Math.max(sa, sb) / Math.max(1, Math.min(sa, sb)) > sizeRatio) return false;
  const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
  return d <= PAD_REACH * Math.max(sa, sb);
}

// Cut an elongated box into squares of its short side, along its long axis.
function squaresOf(b: Box): Box[] {
  const k = Math.round(Math.max(b.w, b.h) / Math.max(1, shortOf(b)));
  const along = b.w >= b.h ? b.w : b.h;
  const edge = (i: number) => Math.round((i * along) / k);
  return Array.from({ length: k }, (_, i) => {
    const from = edge(i);
    const extent = edge(i + 1) - from;
    return b.w >= b.h
      ? { classId: b.classId, x: b.x + from, y: b.y, w: extent, h: b.h, pixels: b.pixels / k }
      : { classId: b.classId, x: b.x, y: b.y + from, w: b.w, h: extent, pixels: b.pixels / k };
  });
}

// The boxes, of those the size, area and aspect gates `refused`, that sit in
// a pad. `kept` are the notes already found: a refused box over one is part
// of that note, and a SMALL kept note (a colour measured at its own size) is
// a pad note too, so it counts as a sibling.
export function findPads(
  refused: Box[],
  kept: Box[],
  frame: { width: number; height: number },
  noteSize: number,
): Box[] {
  // What any pad note has to be, seed or cut square: solid, small, whole in
  // the frame (a clipped box cannot be measured against its siblings), not
  // part of a kept note, and not a second report of one already taken.
  const taken: Box[] = [];
  const admissible = (b: Box) =>
    fillRatio(b) >= PAD_MIN_FILL &&
    isSmall(b, noteSize) &&
    b.x > 0 &&
    b.y > 0 &&
    b.x + b.w < frame.width &&
    b.y + b.h < frame.height &&
    !kept.some((k) => intersection(b, k) > b.w * b.h * MAX_KEPT_OVERLAP) &&
    !taken.some((t) => iou(t, b) > SAME_BOX_IOU);
  const seeds: Box[] = [];
  for (const b of refused) {
    if (!isSquare(b) || !admissible(b)) continue;
    seeds.push(b);
    taken.push(b);
  }
  if (seeds.length === 0) return [];
  const anchors = kept.filter((k) => isSquare(k) && isSmall(k, noteSize));
  const nodes = [...seeds, ...anchors];
  // Single linkage: a pad is every box reachable sibling to sibling.
  const group = nodes.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  for (let i = 0; i < nodes.length; i += 1)
    for (let j = i + 1; j < nodes.length; j += 1)
      if (siblings(nodes[i]!, nodes[j]!)) group[root(i)] = root(j);
  const sizes = new Map<number, number>();
  nodes.forEach((_, i) => sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1));
  const inPad = (i: number) => sizes.get(root(i))! >= PAD_MIN_NOTES;
  const pad = nodes.filter((_, i) => inPad(i));
  const found = seeds.filter((_, i) => inPad(i));
  if (pad.length === 0) return [];
  // Fused pad notes, cut into squares, join a pad found from clean seeds, one
  // square after another; never a pad of their own, which is what a strip of
  // tape cut into squares would make.
  const squares: Box[] = [];
  for (const b of refused) {
    const aspect = Math.max(b.w, b.h) / Math.max(1, shortOf(b));
    if (aspect < FUSED_MIN_ASPECT || Math.round(aspect) > FUSED_MAX_NOTES) continue;
    if (fillRatio(b) < PAD_MIN_FILL) continue;
    for (const square of squaresOf(b)) {
      if (!admissible(square)) continue;
      squares.push(square);
      taken.push(square);
    }
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const square of squares) {
      if (found.includes(square) || !pad.some((m) => siblings(m, square, FUSED_SIZE_RATIO)))
        continue;
      pad.push(square);
      found.push(square);
      grew = true;
    }
  }
  return found;
}

export const PAD_CALIBRATION = {
  PAD_MAX_ASPECT,
  PAD_MIN_FILL,
  PAD_MAX_SIZE,
  PAD_SIZE_RATIO,
  PAD_REACH,
  PAD_MIN_NOTES,
  SAME_BOX_IOU,
  MAX_KEPT_OVERLAP,
  FUSED_MIN_ASPECT,
  FUSED_MAX_NOTES,
  FUSED_SIZE_RATIO,
} as const;
