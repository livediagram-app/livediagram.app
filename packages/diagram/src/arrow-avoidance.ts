// Collision-avoiding curve for freshly drawn arrows (spec/77).
//
// When the user finishes drawing an arrow, a straight chord can cut through
// an unrelated element, or run flush along the boxes it connects (both ends
// pinned on the same side of two stacked elements). Either way a gentle bow
// reads better, so the creation gesture asks this module for a curve offset
// and applies it as an ordinary `arrowStyle: 'curved'` + `curveOffset`,
// which the user can then adjust or straighten with the existing handles.
// One-shot at creation: nothing here reroutes arrows afterwards.
//
// The check samples the REAL rendered geometry: a quadratic bezier whose
// control point is `chord midpoint + offset`, exactly what arrowPathD draws
// for a single-bow curve, so "clears the obstacle" here means the drawn
// line clears it too.

import { curveControlPoint } from './arrow-path';

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

// An obstacle rect plus its relationship to the arrow being drawn. The
// arrow's own endpoint elements are obstacles too (that's what makes the
// flush-along-the-edge case bow), but the curve necessarily starts and ends
// on their boundary, so samples near that end are exempt.
export type AvoidanceObstacle = Rect & { role: 'from' | 'to' | 'other' };

const MARGIN = 14; // clearance ring around every obstacle
// A quadratic's deviation from the chord is only HALF its control offset,
// so the search ceiling is 2x the largest visual bow we accept (~140px).
const MAX_OFFSET = 280;
const STEP = 8; // offset search granularity
const SAMPLES = 32; // bezier sampling resolution
// Samples this close to an endpoint may touch that endpoint's own box: the
// curve necessarily starts on its boundary (inside the clearance ring).
// Distance-based, not a t fraction, so a long chord that runs flush along
// its own element's edge past the anchor still counts as blocked (the
// stacked-boxes case that reads wrong as a straight line).
const END_EXEMPT_PX = 26;
const MIN_CHORD = 24; // don't bother curving stub arrows

function inflated(r: Rect): Rect {
  return {
    x: r.x - MARGIN,
    y: r.y - MARGIN,
    width: r.width + 2 * MARGIN,
    height: r.height + 2 * MARGIN,
  };
}

function contains(r: Rect, p: Pt): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

// Quadratic bezier point for control C.
function bezier(from: Pt, c: Pt, to: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
  };
}

// True when the curve through control `c` hits any obstacle's clearance
// ring, honouring the endpoint exemption windows.
function blocked(from: Pt, to: Pt, c: Pt, obstacles: AvoidanceObstacle[]): boolean {
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = bezier(from, c, to, t);
    for (const o of obstacles) {
      if (o.role === 'from' && Math.hypot(p.x - from.x, p.y - from.y) <= END_EXEMPT_PX) continue;
      if (o.role === 'to' && Math.hypot(p.x - to.x, p.y - to.y) <= END_EXEMPT_PX) continue;
      if (contains(inflated(o), p)) return true;
    }
  }
  return false;
}

// --- Corner-anchor grazing (the collinear-edge rule) -----------------------
//
// A chord pinned at a CORNER anchor can run straight down the extension of
// its own element's edge line (two stacked boxes joined ne to se): it never
// enters the clearance ring beyond the anchor exemption, yet the straight
// line retraces the boxes' silhouette and reads wrong. Detect it for
// axis-aligned chords: when the chord is collinear with an endpoint
// element's vertical/horizontal edge line and extends past the element,
// synthesize a thin virtual obstacle strip on the ELEMENT'S side of that
// line along the chord. The normal search then bows away from the element
// (the strip is one-sided, so the outward bow is always cheaper) and sizes
// the bow via the ordinary clearance margin. The strip carries the
// element's role so the anchor exemption still trims its ends.

const AXIS_TOL = 4; // chord counts as vertical/horizontal within this many px
const EDGE_TOL = 6; // chord-to-edge-line collinearity tolerance
const STRIP_W = 16; // virtual strip thickness, extruded toward the element
const MIN_RUN = 60; // chord must extend at least this far past the element
// Strips stop this far short of BOTH chord endpoints: the curve returns to
// the chord at its ends whatever the offset, so a strip reaching an
// endpoint would be unclearable at every offset and poison the search.
const STRIP_END_CLIP = 32;

function collinearEdgeStrips(
  from: Pt,
  to: Pt,
  obstacles: AvoidanceObstacle[],
): AvoidanceObstacle[] {
  const strips: AvoidanceObstacle[] = [];
  const vertical = Math.abs(to.x - from.x) <= AXIS_TOL;
  const horizontal = Math.abs(to.y - from.y) <= AXIS_TOL;
  if (!vertical && !horizontal) return strips;
  for (const o of obstacles) {
    if (o.role === 'other') continue;
    if (vertical) {
      const cx = (from.x + to.x) / 2;
      const spanTop = Math.min(from.y, to.y) + STRIP_END_CLIP;
      const spanBottom = Math.max(from.y, to.y) - STRIP_END_CLIP;
      if (spanBottom - spanTop < STRIP_W) continue;
      // How far the chord runs OUTSIDE the element's own vertical extent.
      const runBeyond = Math.max(0, o.y - spanTop) + Math.max(0, spanBottom - (o.y + o.height));
      if (runBeyond < MIN_RUN) continue;
      if (Math.abs(o.x + o.width - cx) <= EDGE_TOL) {
        // Collinear with the RIGHT edge line: element lies to the left.
        strips.push({
          x: cx - STRIP_W,
          y: spanTop,
          width: STRIP_W,
          height: spanBottom - spanTop,
          role: o.role,
        });
      } else if (Math.abs(o.x - cx) <= EDGE_TOL) {
        strips.push({
          x: cx,
          y: spanTop,
          width: STRIP_W,
          height: spanBottom - spanTop,
          role: o.role,
        });
      }
    } else {
      const cy = (from.y + to.y) / 2;
      const spanLeft = Math.min(from.x, to.x) + STRIP_END_CLIP;
      const spanRight = Math.max(from.x, to.x) - STRIP_END_CLIP;
      if (spanRight - spanLeft < STRIP_W) continue;
      const runBeyond = Math.max(0, o.x - spanLeft) + Math.max(0, spanRight - (o.x + o.width));
      if (runBeyond < MIN_RUN) continue;
      if (Math.abs(o.y + o.height - cy) <= EDGE_TOL) {
        // Collinear with the BOTTOM edge line: element lies above.
        strips.push({
          x: spanLeft,
          y: cy - STRIP_W,
          width: spanRight - spanLeft,
          height: STRIP_W,
          role: o.role,
        });
      } else if (Math.abs(o.y - cy) <= EDGE_TOL) {
        strips.push({
          x: spanLeft,
          y: cy,
          width: spanRight - spanLeft,
          height: STRIP_W,
          role: o.role,
        });
      }
    }
  }
  return strips;
}

// The curve offset (delta from the chord midpoint, the `curveOffset` wire
// format) that makes a fresh arrow clear every obstacle by the margin, or
// null when the straight line is already clear (or nothing within
// MAX_OFFSET clears it, in which case straight is the honest default).
export function collisionAvoidingCurveOffset(
  from: Pt,
  to: Pt,
  obstacles: AvoidanceObstacle[],
): { dx: number; dy: number } | null {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < MIN_CHORD) return null;
  // Obstacles that already contain an endpoint can never be cleared (the
  // curve must touch that point); drop them rather than searching forever.
  const withStrips = [...obstacles, ...collinearEdgeStrips(from, to, obstacles)];
  const relevant = withStrips.filter(
    (o) => !(o.role === 'other' && (contains(inflated(o), from) || contains(inflated(o), to))),
  );
  if (relevant.length === 0) return null;

  const mid: Pt = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (!blocked(from, to, mid, relevant)) return null;

  // Unit perpendicular of the chord; both signs are candidate bow sides.
  const nx = -(to.y - from.y) / len;
  const ny = (to.x - from.x) / len;
  const required = (side: 1 | -1): number | null => {
    for (let off = STEP; off <= MAX_OFFSET; off += STEP) {
      const c: Pt = { x: mid.x + nx * off * side, y: mid.y + ny * off * side };
      if (!blocked(from, to, c, relevant)) return off;
    }
    return null;
  };
  const right = required(1);
  const left = required(-1);
  if (right === null && left === null) return null;
  const side: 1 | -1 = left === null || (right !== null && right <= left) ? 1 : -1;
  const off = side === 1 ? right! : left!;
  return { dx: nx * off * side, dy: ny * off * side };
}

// Convenience: the control point the chosen offset produces, matching what
// the renderer will draw (exported for tests).
export function avoidanceControlPoint(from: Pt, to: Pt, offset: { dx: number; dy: number }): Pt {
  return curveControlPoint(from, to, offset);
}
