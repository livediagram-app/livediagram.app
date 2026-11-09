// The hub-of-a-ring test `node-isolated` skips a box by (docs/specs/024-agents/blueprints/diagram-lint.md
// "Performance and limits"): three or more connected boxes around the box's centre, every one within
// LINT_RING_SPREAD of their mean distance from it (a cycle's theme at its centre, by design).
//
// The test reads only boxes' rectangles, so both products' checks share it. Asked of every isolated labelled box,
// the plain test costs isolated x connected distances; this one answers the same in near-constant time for every
// box that cannot be a hub, and runs the plain test only on the boxes that might be:
//
// - Around: some connected centre lies right, left, below and above the box's centre, which is the centre lying
//   strictly inside the connected centres' bounding box.
// - Spread: every distance d within mean x (1 ± S) means the farthest is at most mean x (1 + S) and the nearest at
//   least mean x (1 - S), so farthest x (1 - S) <= nearest x (1 + S). Any connected centre bounds the farthest from
//   below (the bounding box's four extreme centres are taken) and the nearest from above (the centres in the box's
//   neighbourhood of a grid over them), so a pair breaking that bound by more than rounding rejects the box.
//
// A rejection is only ever a box the plain test would reject too, and every other box gets the plain test, so the
// answers are the same. Coordinates outside SAFE_MAGNITUDE (or not finite) take the plain test throughout, where
// overflow and NaN would make the shortcuts disagree with it.

import { LINT_RING_SPREAD } from './constants';

export interface RingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Far beyond any canvas, and far below where a difference of two centres could overflow.
const SAFE_MAGNITUDE = 1e15;
// Rounding in the plain test's mean is about n x 2^-53 relative; this leaves many orders of magnitude to spare.
const REJECT_MARGIN = 1e-6;
// At most this many grid rings searched, and centres read, for a near neighbour.
const NEAR_RINGS_MAX = 2;
const NEAR_CENTRES_MAX = 32;

const centreX = (b: RingBox) => b.x + b.width / 2;
const centreY = (b: RingBox) => b.y + b.height / 2;
const safe = (v: number) => Math.abs(v) <= SAFE_MAGNITUDE;

/** The plain test, as `node-isolated` always ran it: every connected box's distance, per asked box. */
export function plainRingTest(connected: readonly RingBox[]): (box: RingBox) => boolean {
  return (box) => {
    if (connected.length < 3) return false;
    const c = { x: centreX(box), y: centreY(box) };
    const d = connected.map((b) => Math.hypot(centreX(b) - c.x, centreY(b) - c.y));
    const mean = d.reduce((s, x) => s + x, 0) / d.length;
    if (mean <= 0 || d.some((x) => Math.abs(x - mean) > mean * LINT_RING_SPREAD)) return false;
    const around = (sx: number, sy: number) =>
      connected.some((b) => (centreX(b) - c.x) * sx + (centreY(b) - c.y) * sy > 0);
    return around(1, 0) && around(-1, 0) && around(0, 1) && around(0, -1);
  };
}

/** Whether a box is the hub of a ring of `connected` boxes: the plain test's answers, without its cost per box. */
export function createRingTest(connected: readonly RingBox[]): (box: RingBox) => boolean {
  const plain = plainRingTest(connected);
  const n = connected.length;
  if (n < 3) return () => false;
  const xs = connected.map(centreX);
  const ys = connected.map(centreY);
  if (!xs.every(safe) || !ys.every(safe)) return plain;

  // The extreme centres, by index.
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  for (let i = 1; i < n; i++) {
    if (xs[i]! < xs[left]!) left = i;
    if (xs[i]! > xs[right]!) right = i;
    if (ys[i]! < ys[top]!) top = i;
    if (ys[i]! > ys[bottom]!) bottom = i;
  }
  const minX = xs[left]!;
  const minY = ys[top]!;
  const extremes = [left, right, top, bottom];

  // A grid of about one centre per cell over their bounding box.
  const cols = Math.ceil(Math.sqrt(n));
  const cellW = (xs[right]! - minX) / cols || 1;
  const cellH = (ys[bottom]! - minY) / cols || 1;
  const cellOf = (v: number, min: number, size: number) =>
    Math.min(cols - 1, Math.max(0, Math.floor((v - min) / size)));
  const cells = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const key = cellOf(ys[i]!, minY, cellH) * cols + cellOf(xs[i]!, minX, cellW);
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  }

  return (box) => {
    const cx = centreX(box);
    const cy = centreY(box);
    if (!safe(cx) || !safe(cy)) return plain(box);
    if (!(minX < cx && cx < xs[right]! && minY < cy && cy < ys[bottom]!)) return false;
    const dist = (i: number) => Math.hypot(xs[i]! - cx, ys[i]! - cy);
    const farthest = Math.max(...extremes.map(dist));
    let nearest = Math.min(...extremes.map(dist));
    const col = cellOf(cx, minX, cellW);
    const row = cellOf(cy, minY, cellH);
    let read = 0;
    for (let r = 0; r <= NEAR_RINGS_MAX && read === 0; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const i of cells.get((row + dy) * cols + (col + dx)) ?? []) {
            if (read >= NEAR_CENTRES_MAX) break;
            nearest = Math.min(nearest, dist(i));
            read++;
          }
        }
    if (farthest * (1 - LINT_RING_SPREAD) > nearest * (1 + LINT_RING_SPREAD) * (1 + REJECT_MARGIN))
      return false;
    return plain(box);
  };
}
