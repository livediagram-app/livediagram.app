// Where a walk to a piece's front ends when somebody already stands there (docs/specs/009-elements/social-pieces.md
// "A crowded machine stays reachable", Work Tracker 635): the nearest free spot along the front, out to its sides as
// far as the piece's reach goes, so a popular Arcade Machine or a busy Reception Desk can still be used. Nobody's reach
// widens; the walk only ends somewhere else inside it. Pure: no React, no DOM.

import {
  FENCE_REACH,
  fencesNear,
  pointSegmentDistance,
  segmentsIntersect,
  type FenceSegment,
} from './collision';
import type { FencePoint } from './fence';

/** How far apart two characters' feet stand at a piece's front, in canvas px: shoulder to shoulder. */
export const FRONT_SPOT_GAP = 24;
// The search's steps along the front, and how far either way it looks: past the widest front's ends (a 64 px Arcade
// Machine's reach runs 24 px past each side of it).
const FRONT_SPOT_STEP = 8;
const FRONT_SPOT_RANGE = 96;

type Point = FencePoint;

export type FrontSpotSearch = {
  /** Where the walk would end with nobody in the way (walkPointFor). */
  want: Point;
  /** The front's direction: across the canvas for a piece facing down or up, down it for one facing a side. */
  axis: 'x' | 'y';
  /** The other standing characters' feet. */
  others: readonly Point[];
  /** Whether feet at a point stand at this piece's front (its bubble shows), and not a neighbour's. */
  inReach: (p: Point) => boolean;
  /** The walls and footprints: a spot is on open floor, clear of a wall's reach and not across one from `want`. */
  fences?: readonly FenceSegment[];
};

/**
 * Where a walk to a piece's front ends: `want` while no other character's feet stand within FRONT_SPOT_GAP of it;
 * otherwise the nearest spot along the front, FRONT_SPOT_STEP at a time up to FRONT_SPOT_RANGE either way (the right or the
 * lower side first at each step), that is still in reach, on open floor and FRONT_SPOT_GAP from everyone. With none, the spot in
 * reach with the most room (the nearest of equals), so the piece is always usable from where the walk ends.
 */
export function freeFrontSpot({
  want,
  axis,
  others,
  inReach,
  fences = [],
}: FrontSpotSearch): Point {
  // Only the characters the search could come near count (a crowd elsewhere on the tab costs one distance each).
  const near = others.filter(
    (o) => Math.hypot(o.x - want.x, o.y - want.y) <= FRONT_SPOT_RANGE + FRONT_SPOT_GAP,
  );
  const room = (p: Point) =>
    near.reduce((m, o) => Math.min(m, Math.hypot(o.x - p.x, o.y - p.y)), Infinity);
  if (room(want) >= FRONT_SPOT_GAP) return want;
  const walls =
    fences.length === 0 ? fences : fencesNear(want, FRONT_SPOT_RANGE + FENCE_REACH, fences);
  const open = (p: Point) =>
    walls.every(
      (f) =>
        !(
          f.solid &&
          p.x > f.solid.x &&
          p.x < f.solid.x + f.solid.width &&
          p.y > f.solid.y &&
          p.y < f.solid.y + f.solid.height
        ) &&
        pointSegmentDistance(p, f) >= FENCE_REACH &&
        !segmentsIntersect({ a: want, b: p }, f),
    );
  let best = want;
  let bestRoom = room(want);
  for (let d = FRONT_SPOT_STEP; d <= FRONT_SPOT_RANGE; d += FRONT_SPOT_STEP) {
    for (const sign of [1, -1]) {
      const at =
        axis === 'x' ? { x: want.x + d * sign, y: want.y } : { x: want.x, y: want.y + d * sign };
      if (!inReach(at) || !open(at)) continue;
      const r = room(at);
      if (r >= FRONT_SPOT_GAP) return at;
      if (r > bestRoom) {
        best = at;
        bestRoom = r;
      }
    }
  }
  return best;
}
