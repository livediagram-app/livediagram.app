// draw.io's route as an arrow's path (docs/specs/020-import-export/blueprints/drawio-import.md step
// 12.7-12.9): each pinned end takes the anchor nearest where draw.io's path meets its shape, on the
// side the path leaves through; the route's end segments follow the anchors and stay on their axis;
// the corners in between become the arrow's bend points, or points on draw.io's curve.

import {
  anchorPosition,
  anchorPrimarySide,
  offeredAnchors,
  type Anchor,
  type ArrowStyle,
  type BoxedElement,
  type Side,
} from '@livediagram/document';
import type { Pt } from './cells';

/** How far a segment may lean and still read as horizontal or vertical: draw.io paints a corner
 *  less than a pixel off its neighbour as a slight lean (mxShape.getWaypoints). */
export const DRAWIO_AXIS_TOLERANCE_PX = 1;

type Axis = 'h' | 'v' | null;

/** The axis a segment runs along, within the tolerance; null for a slanted one. */
export function axisOf(a: Pt, b: Pt): Axis {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dy <= DRAWIO_AXIS_TOLERANCE_PX && dx > dy) return 'h';
  if (dx <= DRAWIO_AXIS_TOLERANCE_PX && dy > dx) return 'v';
  return null;
}

/** The side an end segment leaves its shape through: towards `next` along the segment's axis;
 *  null for a slanted segment. */
export function exitSide(end: Pt, next: Pt): Side | null {
  const axis = axisOf(end, next);
  if (axis === 'h') return next.x > end.x ? 'e' : 'w';
  if (axis === 'v') return next.y > end.y ? 's' : 'n';
  return null;
}

const vertical = (side: Side) => side === 'n' || side === 's';

/** The offered anchor nearest `point` on the side the route leaves through (blueprint step 12.7).
 *  An anchor's primary side decides the axis the renderer squares its leg to (corners leave
 *  vertically), so a side with none of its own falls back to any anchor on the same axis, then
 *  to any anchor. */
export function nearestAnchor(el: BoxedElement, point: Pt, side: Side | null): Anchor {
  const offered = offeredAnchors(el);
  const onSide = side ? offered.filter((a) => anchorPrimarySide(a) === side) : offered;
  const onAxis = side
    ? offered.filter((a) => vertical(anchorPrimarySide(a)) === vertical(side))
    : offered;
  const candidates = onSide.length > 0 ? onSide : onAxis.length > 0 ? onAxis : offered;
  let best: Anchor = candidates[0] ?? 'e';
  let bestD = Infinity;
  for (const anchor of candidates) {
    const at = anchorPosition(el, anchor);
    const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = anchor;
    }
  }
  return best;
}

const same = (a: Pt, b: Pt) =>
  Math.abs(a.x - b.x) < DRAWIO_AXIS_TOLERANCE_PX / 2 &&
  Math.abs(a.y - b.y) < DRAWIO_AXIS_TOLERANCE_PX / 2;

// Whether b lies on the line through a and c, going on in the same direction.
function collinear(a: Pt, b: Pt, c: Pt): boolean {
  const ab = axisOf(a, b);
  if (ab && ab === axisOf(b, c)) return true;
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
  return Math.abs(cross) < 1e-6 * Math.max(1, Math.hypot(c.x - a.x, c.y - a.y)) && dot > 0;
}

/** The route with repeated points and points in the middle of a straight run left out. */
export function simplifyRoute(points: Pt[]): Pt[] {
  const unique = points.filter((p, i) => i === 0 || !same(p, points[i - 1]!));
  const out: Pt[] = [];
  for (const p of unique) {
    while (out.length >= 2 && collinear(out[out.length - 2]!, out[out.length - 1]!, p)) out.pop();
    out.push(p);
  }
  // A route folded onto one point keeps its last point too, so the arrow has two ends.
  const last = points[points.length - 1] ?? { x: 0, y: 0 };
  while (out.length < 2) out.push({ ...last });
  return out;
}

/** The ends of a simplified route moved onto `from` / `to` (blueprint step 12.8): the corner next to
 *  a moved end follows it on the end segment's axis, so a horizontal or vertical end stays one. A
 *  straight orthogonal route whose ends no longer line up gains two corners halfway along. */
export function snapRouteEnds(route: Pt[], from: Pt, to: Pt, orthogonal: boolean): Pt[] {
  const pts = route.map((p) => ({ ...p }));
  const n = pts.length;
  if (n === 2) {
    const axis = axisOf(pts[0]!, pts[1]!);
    if (orthogonal && axis === 'h' && Math.abs(from.y - to.y) > DRAWIO_AXIS_TOLERANCE_PX / 2) {
      const mx = (from.x + to.x) / 2;
      return [from, { x: mx, y: from.y }, { x: mx, y: to.y }, to];
    }
    if (orthogonal && axis === 'v' && Math.abs(from.x - to.x) > DRAWIO_AXIS_TOLERANCE_PX / 2) {
      const my = (from.y + to.y) / 2;
      return [from, { x: from.x, y: my }, { x: to.x, y: my }, to];
    }
    return [from, to];
  }
  const firstAxis = axisOf(pts[0]!, pts[1]!);
  const lastAxis = axisOf(pts[n - 2]!, pts[n - 1]!);
  if (firstAxis === 'h') pts[1]!.y = from.y;
  else if (firstAxis === 'v') pts[1]!.x = from.x;
  if (lastAxis === 'h') pts[n - 2]!.y = to.y;
  else if (lastAxis === 'v') pts[n - 2]!.x = to.x;
  pts[0] = from;
  pts[n - 1] = to;
  return simplifyRoute(pts);
}

/** How far a sampled curve may stray from draw.io's (operator decision: about 2 px). */
export const DRAWIO_CURVE_TOLERANCE_PX = 2;
/** How finely draw.io's curve is sampled before the samples are thinned (D44). Safe range: 8 to 32. */
export const DRAWIO_CURVE_SAMPLES_PER_PIECE = 16;

const quad = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

/** draw.io's curve through a route (mxPolyline.paintCurvedLine): a quadratic from each segment's
 *  middle to the next, the corner between them its control point, the ends the route's own;
 *  `perPiece` points on each quadratic, both ends of the route included. */
export function drawioCurve(points: Pt[], perPiece: number): Pt[] {
  const out: Pt[] = [points[0]!];
  let start = points[0]!;
  const piece = (control: Pt, end: Pt) => {
    for (let i = 1; i <= perPiece; i++) out.push(quad(start, control, end, i / perPiece));
    start = end;
  };
  for (let i = 1; i < points.length - 2; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    piece(p0, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 });
  }
  piece(points[points.length - 2]!, points[points.length - 1]!);
  return out;
}

// The renderer's curve through points (a uniform Catmull-Rom spline, catmullRomPathD), sampled.
function catmullRom(points: Pt[], perSegment = 16): Pt[] {
  const out: Pt[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    for (let s = 1; s <= perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

const segmentDistance = (p: Pt, a: Pt, b: Pt) => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
  return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t);
};

// How far `p` lies from the polyline `line`.
const offLine = (p: Pt, line: Pt[]) =>
  Math.min(...line.slice(1).map((q, i) => segmentDistance(p, line[i]!, q)));

/** The fewest points on draw.io's curve that the renderer's curve through them keeps within
 *  `DRAWIO_CURVE_TOLERANCE_PX` of draw.io's (blueprint step 12.9), both ends included: starting
 *  from the ends, the sample of draw.io's curve farthest from the renderer's joins the points until
 *  none is farther than the tolerance, and no point of the renderer's curve strays farther either. */
export function curveThrough(points: Pt[]): Pt[] {
  const truth = drawioCurve(points, DRAWIO_CURVE_SAMPLES_PER_PIECE);
  const kept = new Set([0, truth.length - 1]);
  for (;;) {
    const through = [...kept].sort((x, y) => x - y).map((i) => truth[i]!);
    const drawn = catmullRom(through);
    let worst = -1;
    let worstD = 0;
    truth.forEach((p, i) => {
      const d = offLine(p, drawn);
      if (!kept.has(i) && d > worstD) {
        worstD = d;
        worst = i;
      }
    });
    const strays = Math.max(...drawn.map((p) => offLine(p, truth)));
    if (worst < 0 || (worstD <= DRAWIO_CURVE_TOLERANCE_PX && strays <= DRAWIO_CURVE_TOLERANCE_PX)) {
      return through;
    }
    kept.add(worst);
  }
}

/** How the arrow draws its route (blueprint step 12.9). */
export type RouteShape = {
  arrowStyle: ArrowStyle;
  curvePoints?: { dx: number; dy: number }[];
  curveOffset?: { dx: number; dy: number };
};

/** `curved=1` with one corner is draw.io's own quadratic, the corner its control point; with more,
 *  a curve through points sampled on draw.io's curve; any other route is angled through its corners
 *  (a router's, or an edge's waypoints as a polyline); a route without corners is straight. */
export function routeShape(points: Pt[], curved: boolean): RouteShape {
  const from = points[0]!;
  const to = points[points.length - 1]!;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const inner = points.slice(1, -1).map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y }));
  if (inner.length === 0) return { arrowStyle: 'straight' };
  if (curved && inner.length === 1) return { arrowStyle: 'curved', curveOffset: inner[0]! };
  const delta = (p: Pt) => ({ dx: p.x - mid.x, dy: p.y - mid.y });
  if (curved) {
    // A curve that draws as its chord is a straight line: an empty curve would bow.
    const through = curveThrough(points).slice(1, -1);
    return through.length > 0
      ? { arrowStyle: 'curved', curvePoints: through.map(delta) }
      : { arrowStyle: 'straight' };
  }
  return { arrowStyle: 'angled', curvePoints: inner };
}
