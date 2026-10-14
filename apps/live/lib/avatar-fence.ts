// Fences in Avatar mode (docs/specs/009-elements/fence.md "Blocking"): the pure maths that stops a
// walking character at a fence. No React, no DOM, so the rule is unit-testable without a canvas.
//
// Each fence blocks a CAPSULE: every point within FENCE_REACH of its line. A step that would enter
// a capsule from outside is refused, tested against the whole step rather than where it lands, so
// a fast step cannot tunnel through, and two fences whose ends are closer than twice the reach leave
// no gap to squeeze through. A refused step slides along the fence instead, the way people walk
// along a wall.

import {
  boxEdges,
  fenceLine,
  officeFootprint,
  roomWalls,
  type Element,
  type FencePoint,
} from '@livediagram/document';

// How close a character's feet may come to a fence's line, in canvas px: about the feet's own
// half-width, so a character stops AT a fence rather than standing in it.
export const FENCE_REACH = 12;

// A step shorter than this (canvas px) is no progress: a click-walk pressed against a fence stops.
export const FENCE_STALL = 0.25;

export type FenceSegment = { a: FencePoint; b: FencePoint };

/**
 * Every line on the tab a character cannot cross, in paint order: each fence's run, each room's walls (broken
 * at its doorway), and the outline of each piece of scenery's footprint (docs/specs/009-elements/office.md), all
 * blocked the same way.
 */
export function fenceSegments(elements: readonly Element[]): FenceSegment[] {
  const out: FenceSegment[] = [];
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    if (el.shape === 'fence') out.push(fenceLine(el));
    else if (el.shape === 'room') out.push(...roomWalls(el));
    else {
      const footprint = officeFootprint(el);
      if (footprint) out.push(...boxEdges(footprint));
    }
  }
  return out;
}

const cross = (o: FencePoint, a: FencePoint, b: FencePoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Distance from a point to a segment. */
export function pointSegmentDistance(p: FencePoint, s: FenceSegment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2));
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/** Whether two segments cross or touch. */
export function segmentsIntersect(p: FenceSegment, q: FenceSegment): boolean {
  const d1 = cross(q.a, q.b, p.a);
  const d2 = cross(q.a, q.b, p.b);
  const d3 = cross(p.a, p.b, q.a);
  const d4 = cross(p.a, p.b, q.b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  // Collinear or touching cases: an end lying on the other segment.
  const onSegment = (s: FenceSegment, r: FencePoint, d: number) =>
    d === 0 &&
    Math.min(s.a.x, s.b.x) <= r.x &&
    r.x <= Math.max(s.a.x, s.b.x) &&
    Math.min(s.a.y, s.b.y) <= r.y &&
    r.y <= Math.max(s.a.y, s.b.y);
  return (
    onSegment(q, p.a, d1) || onSegment(q, p.b, d2) || onSegment(p, q.a, d3) || onSegment(p, q.b, d4)
  );
}

/** The closest two segments come to each other (0 when they cross). */
export function segmentDistance(p: FenceSegment, q: FenceSegment): number {
  if (segmentsIntersect(p, q)) return 0;
  return Math.min(
    pointSegmentDistance(p.a, q),
    pointSegmentDistance(p.b, q),
    pointSegmentDistance(q.a, p),
    pointSegmentDistance(q.b, p),
  );
}

/**
 * Whether one fence refuses a step. From outside its reach: any step that comes within the reach.
 * From inside it (a fence dropped on top of a character): only a step that crosses the line or
 * closes in on it, so the character can always step away.
 */
export function fenceRefuses(
  from: FencePoint,
  to: FencePoint,
  fence: FenceSegment,
  reach = FENCE_REACH,
): boolean {
  const before = pointSegmentDistance(from, fence);
  if (before >= reach) return segmentDistance({ a: from, b: to }, fence) < reach;
  return segmentsIntersect({ a: from, b: to }, fence) || pointSegmentDistance(to, fence) < before;
}

function firstRefusal(
  from: FencePoint,
  to: FencePoint,
  fences: readonly FenceSegment[],
  reach: number,
): FenceSegment | null {
  for (const fence of fences) if (fenceRefuses(from, to, fence, reach)) return fence;
  return null;
}

/**
 * One step of walking with fences in the way: the step itself when nothing refuses it, else the
 * part of it that runs along the refusing fence when that is clear, else no step at all.
 */
export function fenceStep(
  from: FencePoint,
  to: FencePoint,
  fences: readonly FenceSegment[],
  reach = FENCE_REACH,
): { pos: FencePoint; blocked: boolean } {
  if (fences.length === 0) return { pos: to, blocked: false };
  const fence = firstRefusal(from, to, fences, reach);
  if (!fence) return { pos: to, blocked: false };
  const fx = fence.b.x - fence.a.x;
  const fy = fence.b.y - fence.a.y;
  const len = Math.hypot(fx, fy);
  if (len > 0) {
    const ux = fx / len;
    const uy = fy / len;
    const along = (to.x - from.x) * ux + (to.y - from.y) * uy;
    const slid = { x: from.x + ux * along, y: from.y + uy * along };
    if (Math.abs(along) >= FENCE_STALL && !firstRefusal(from, slid, fences, reach)) {
      return { pos: slid, blocked: true };
    }
  }
  // Nothing to slide along: close in on the fence as far as the step allows, so a character walking
  // straight at it stops at the reach rather than a step short of it.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < FENCE_APPROACH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const at = { x: from.x + (to.x - from.x) * mid, y: from.y + (to.y - from.y) * mid };
    if (firstRefusal(from, at, fences, reach)) hi = mid;
    else lo = mid;
  }
  return {
    pos: { x: from.x + (to.x - from.x) * lo, y: from.y + (to.y - from.y) * lo },
    blocked: true,
  };
}

// How many halvings the approach takes: a 13 px step (the longest a frame walks) to within 0.1 px.
const FENCE_APPROACH_STEPS = 7;
