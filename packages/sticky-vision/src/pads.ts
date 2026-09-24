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

function siblings(a: Box, b: Box): boolean {
  const sa = shortOf(a);
  const sb = shortOf(b);
  if (Math.max(sa, sb) / Math.max(1, Math.min(sa, sb)) > PAD_SIZE_RATIO) return false;
  const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
  return d <= PAD_REACH * Math.max(sa, sb);
}

// The boxes, of those the size and area floors `refused`, that sit in a pad.
// `kept` are the notes already found: a refused box over one is part of that
// note, and a SMALL kept note (a colour measured at its own size) is a pad
// note too, so it counts as a sibling.
export function findPads(
  refused: Box[],
  kept: Box[],
  frame: { width: number; height: number },
  noteSize: number,
): Box[] {
  const seeds: Box[] = [];
  for (const b of refused) {
    if (!isSquare(b) || !isSmall(b, noteSize)) continue;
    if (fillRatio(b) < PAD_MIN_FILL) continue;
    // A box the frame clips cannot be measured against its siblings.
    if (b.x <= 0 || b.y <= 0 || b.x + b.w >= frame.width || b.y + b.h >= frame.height) continue;
    if (kept.some((k) => intersection(b, k) > b.w * b.h * MAX_KEPT_OVERLAP)) continue;
    if (seeds.some((s) => iou(s, b) > SAME_BOX_IOU)) continue;
    seeds.push(b);
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
  return seeds.filter((_, i) => sizes.get(root(i))! >= PAD_MIN_NOTES);
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
} as const;
