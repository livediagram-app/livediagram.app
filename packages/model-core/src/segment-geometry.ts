// The distance between two segments, for every product's hit tests, the whiteboard eraser and the Avatar-mode
// walk's collision (@liveworkspace/avatar/collision). Pure; canvas coords.
import type { Point } from './geometry-primitives';

// Distance from `p` to the segment a-b; a segment of no length measures to `a`. (Exact zero, unlike
// geometry-primitives' distToSegment, so this module measures as the copies it replaced did.)
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** The shortest distance between segments `p1 p2` and `q1 q2`: 0 when they cross. */
export function segmentDistance(p1: Point, p2: Point, q1: Point, q2: Point): number {
  if (segmentsIntersect(p1, p2, q1, q2)) return 0;
  return Math.min(
    distToSegment(p1, q1, q2),
    distToSegment(p2, q1, q2),
    distToSegment(q1, p1, p2),
    distToSegment(q2, p1, p2),
  );
}
