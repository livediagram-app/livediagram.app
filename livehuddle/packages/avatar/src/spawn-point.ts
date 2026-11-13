// Where a new character appears (docs/specs/009-elements/fence.md "What does not walk", Work Tracker #610): never
// inside a footprint. The spot the mode would put it on (the view's centre, below a button, the remembered spot) is
// kept when it is free floor; one inside a piece that blocks (a pool's water, a pond, a plant's pot, a car) moves to the
// nearest free floor instead, and one just below water (a pool, a pond) a body's height clear of it, since the depth
// rule draws a body standing there over the water's lower edge (Work Tracker 706, #707). Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import {
  clearOfFences,
  FENCE_REACH,
  fencesNear,
  pointSegmentDistance,
  type FenceSegment,
} from './collision';
import type { FencePoint } from './fence';
import { AVATAR_SIZE_SCALE } from './size-scale';
import { AVATAR_HEIGHT, AVATAR_WIDTH } from './walk';

// How far from the spot the search looks for free floor, in canvas px: past the biggest piece's middle (a 600 px
// pool is 300 from its middle to its edge) with room to spare, and still a bounded search.
export const SPAWN_SEARCH_MAX = 1200;
// The rings the search walks out by, in canvas px: half a Regular character's feet, so no gap a character fits in
// is stepped over.
const SPAWN_SEARCH_STEP = 8;
/** A Regular character's height, the margin kept below water when no size is given. */
export const SPAWN_BODY = AVATAR_HEIGHT * AVATAR_SIZE_SCALE.regular;
// How far past the reach the spot keeps from every wall, so the first step from it is never refused.
const SPAWN_MARGIN = 0.5;

function inside(p: FencePoint, box: Rect): boolean {
  return p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height;
}

/** The footprint a point stands inside, if any. */
function solidAt(p: FencePoint, fences: readonly FenceSegment[]): Rect | null {
  for (const f of fences) if (f.solid && inside(p, f.solid)) return f.solid;
  return null;
}

/** Each water footprint once (a box's four edges share it). */
function waterOf(fences: readonly FenceSegment[]): Rect[] {
  const boxes = new Set<Rect>();
  for (const f of fences) if (f.water && f.solid) boxes.add(f.solid);
  return [...boxes];
}

/** Whether feet at `p` stand under water, closer below it than a body's height, the body's half-width either side. */
function underWater(p: FencePoint, water: readonly Rect[], body: number): boolean {
  return water.some(
    (w) =>
      p.y >= w.y + w.height &&
      p.y < w.y + w.height + body &&
      p.x > w.x - AVATAR_WIDTH / 2 &&
      p.x < w.x + w.width + AVATAR_WIDTH / 2,
  );
}

/**
 * Whether a character may appear at `p`: outside every footprint, further than its reach from every wall and not
 * within a body's height under water.
 */
function freeAt(
  p: FencePoint,
  fences: readonly FenceSegment[],
  clear: number,
  water: readonly Rect[],
  body: number,
): boolean {
  return (
    !underWater(p, water, body) &&
    !fencesNear(p, clear, fences).some(
      (f) => (f.solid !== undefined && inside(p, f.solid)) || pointSegmentDistance(p, f) < clear,
    )
  );
}

/**
 * Where a new character put down at `p` appears. Free of every footprint and of water's margin, it is
 * `clearOfFences`'s spot (nudged off a wall it lands beside, left in a wall it lands in). Inside one (or within `body`
 * under water), it is the nearest point outside every footprint, clear of every wall's reach and at least `body`
 * (the character's height, SPAWN_BODY at Regular) below any water, searched ring by ring out to
 * SPAWN_SEARCH_MAX, each ring from straight below (the front of a piece, where its drawing faces you) round both ways
 * at once; `p` itself when no ring has one.
 */
export function freeSpawnPoint(
  p: FencePoint,
  fences: readonly FenceSegment[],
  reach = FENCE_REACH,
  body = SPAWN_BODY,
): FencePoint {
  const allWater = waterOf(fences);
  if (!solidAt(p, fences) && !underWater(p, allWater, body)) return clearOfFences(p, fences, reach);
  const clear = reach + SPAWN_MARGIN;
  // Only the walls within the search's reach can refuse a spot; each spot then reads the few beside it (fencesNear
  // indexes a long list once).
  const near = fencesNear(p, SPAWN_SEARCH_MAX + clear, fences);
  const water = waterOf(near);
  // Straight below the water a body clear, where its drawing faces you: taken unless the rings find free floor nearer
  // than the water's bottom edge, so a margin below never sends a spot centred on a pool round to its far bank.
  let below: FencePoint | null = null;
  let edge = SPAWN_SEARCH_MAX;
  for (const w of water) {
    if (p.x <= w.x - AVATAR_WIDTH / 2 || p.x >= w.x + w.width + AVATAR_WIDTH / 2) continue;
    if (p.y < w.y || p.y >= w.y + w.height + body) continue;
    const at = { x: p.x, y: w.y + w.height + body };
    const d = Math.max(0, w.y + w.height - p.y) + clear;
    if (d < edge && at.y - p.y <= SPAWN_SEARCH_MAX && freeAt(at, near, clear, water, body)) {
      below = at;
      edge = d;
    }
  }
  return ringSearch(p, near, clear, water, body, below ? edge : SPAWN_SEARCH_MAX) ?? below ?? p;
}

/** The rings' nearest free spot round `p`, or null with none nearer than `max` (rings below it only). */
function ringSearch(
  p: FencePoint,
  near: readonly FenceSegment[],
  clear: number,
  water: readonly Rect[],
  body: number,
  max: number,
): FencePoint | null {
  for (let r = SPAWN_SEARCH_STEP; r <= max; r += SPAWN_SEARCH_STEP) {
    // Points about SPAWN_SEARCH_STEP apart round the ring, an even number so the two ways round meet at the top.
    const half = Math.max(4, Math.ceil((Math.PI * r) / SPAWN_SEARCH_STEP));
    for (let k = 0; k <= half; k++) {
      const turn = (k / half) * Math.PI;
      for (const sign of k === 0 || k === half ? [1] : [1, -1]) {
        // Angle 0 is straight down the canvas.
        const at = { x: p.x + Math.sin(turn * sign) * r, y: p.y + Math.cos(turn) * r };
        if (freeAt(at, near, clear, water, body)) return at;
      }
    }
  }
  return null;
}
