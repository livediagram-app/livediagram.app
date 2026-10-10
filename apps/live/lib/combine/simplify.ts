// A combined outline's rings tidied (docs/specs/007-editor/logo-pages.md "Combine"): the closing
// repeat dropped, and points that sit on the straight run between their neighbours (within
// COMBINE_MERGE_PX) merged away, so a combined square keeps four corners while a circle keeps the
// points its curve needs.
import type { Ring } from './outline';

// Points closer than this to the line through their neighbours are merged away, in canvas px.
export const COMBINE_MERGE_PX = 0.05;

// How far `p` lies from the segment a-b (not the infinite line): a point that folds back past an
// end (a needle-thin spike) is far from the segment, so it is kept.
function offLine(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** The ring without its closing repeat, its repeated and collinear points merged; empty when
 *  fewer than three points are left. */
export function simplifyRing(ring: Ring, tolerance = COMBINE_MERGE_PX): Ring {
  const pts: Ring = [];
  for (const p of ring) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > tolerance) pts.push(p);
  }
  const first = pts[0];
  const end = pts[pts.length - 1];
  if (
    first &&
    end &&
    pts.length > 1 &&
    Math.hypot(first[0] - end[0], first[1] - end[1]) <= tolerance
  )
    pts.pop();
  // Merge each point that sits on the line between its neighbours; stepping back after a merge,
  // since the neighbour before may now sit on a straight run too.
  let i = 0;
  while (pts.length > 3 && i < pts.length) {
    const prev = pts[(i - 1 + pts.length) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    if (offLine(pts[i]!, prev, next) <= tolerance) {
      pts.splice(i, 1);
      i = Math.max(0, i - 1);
    } else {
      i += 1;
    }
  }
  // Three points in a line enclose nothing.
  if (pts.length === 3 && offLine(pts[1]!, pts[0]!, pts[2]!) <= tolerance) return [];
  return pts.length >= 3 ? pts : [];
}
