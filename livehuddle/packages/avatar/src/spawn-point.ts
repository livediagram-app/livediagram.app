// Where a new character appears (docs/specs/009-elements/fence.md "What does not walk", Work Tracker #610): never
// inside a footprint. The spot the mode would put it on (the view's centre, below a button, the remembered spot) is
// kept when it is free floor; one inside a piece that blocks (a pool's water, a pond, a plant's pot, a car) moves to the
// nearest free floor instead. Pure: no React, no DOM.

import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import {
  clearOfFences,
  FENCE_REACH,
  fencesNear,
  pointSegmentDistance,
  type FenceSegment,
} from './collision';
import type { FencePoint } from './fence';

// How far from the spot the search looks for free floor, in canvas px: past the biggest piece's middle (a 600 px
// pool is 300 from its middle to its edge) with room to spare, and still a bounded search.
export const SPAWN_SEARCH_MAX = 1200;
// The rings the search walks out by, in canvas px: half a Regular character's feet, so no gap a character fits in
// is stepped over.
const SPAWN_SEARCH_STEP = 8;
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

/** Whether a character may appear at `p`: outside every footprint and further than its reach from every wall. */
function freeAt(p: FencePoint, fences: readonly FenceSegment[], clear: number): boolean {
  return !fencesNear(p, clear, fences).some(
    (f) => (f.solid !== undefined && inside(p, f.solid)) || pointSegmentDistance(p, f) < clear,
  );
}

/**
 * Where a new character put down at `p` appears. Free of every footprint, it is `clearOfFences`'s spot (nudged off a
 * wall it lands beside, left in a wall it lands in). Inside one, it is the nearest point outside every footprint and
 * clear of every wall's reach, searched ring by ring out to SPAWN_SEARCH_MAX, each ring from straight below (the front
 * of a piece, where its drawing faces you) round both ways at once; `p` itself when no ring has one.
 */
export function freeSpawnPoint(
  p: FencePoint,
  fences: readonly FenceSegment[],
  reach = FENCE_REACH,
): FencePoint {
  if (!solidAt(p, fences)) return clearOfFences(p, fences, reach);
  const clear = reach + SPAWN_MARGIN;
  // Only the walls within the search's reach can refuse a spot; each spot then reads the few beside it (fencesNear
  // indexes a long list once).
  const near = fencesNear(p, SPAWN_SEARCH_MAX + clear, fences);
  for (let r = SPAWN_SEARCH_STEP; r <= SPAWN_SEARCH_MAX; r += SPAWN_SEARCH_STEP) {
    // Points about SPAWN_SEARCH_STEP apart round the ring, an even number so the two ways round meet at the top.
    const half = Math.max(4, Math.ceil((Math.PI * r) / SPAWN_SEARCH_STEP));
    for (let k = 0; k <= half; k++) {
      const turn = (k / half) * Math.PI;
      for (const sign of k === 0 || k === half ? [1] : [1, -1]) {
        // Angle 0 is straight down the canvas.
        const at = { x: p.x + Math.sin(turn * sign) * r, y: p.y + Math.cos(turn) * r };
        if (freeAt(at, near, clear)) return at;
      }
    }
  }
  return p;
}
