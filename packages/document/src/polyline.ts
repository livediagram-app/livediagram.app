// Pure polyline / curve geometry used by freehand rendering: Ramer-Douglas-
// Peucker simplification of raw pointer samples, and Catmull-Rom -> cubic
// Bezier SVG path conversion for smooth strokes. No element-model deps.
// Split out of factories.ts; re-exported through the package barrel.

// Ramer-Douglas-Peucker polyline simplification. Drops samples that
// sit close to the straight line between their neighbours; the
// `tolerance` is the max allowed perpendicular distance in canvas
// pixels. Returns a new array (input untouched). Pure: no
// randomness, no time-dependence.
//
// Caller passes the raw pointer samples + a tolerance scaled to
// viewport zoom so the visible jitter is what gets smoothed, not
// absolute canvas pixels. A short polyline (< 3 points) is returned
// as-is, the algorithm is a no-op there.
export function simplifyPolyline(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length < 3) return points.slice();
  const tol2 = tolerance * tolerance;
  // Iterative RDP via an explicit stack so deep recursion can't blow
  // the call stack on a several-thousand-sample gesture.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;
    let maxDist2 = 0;
    let maxIdx = start;
    const a = points[start]!;
    const b = points[end]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lineLen2 = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      let d2: number;
      if (lineLen2 === 0) {
        // start == end (degenerate). Distance is just to the point.
        const ex = p.x - a.x;
        const ey = p.y - a.y;
        d2 = ex * ex + ey * ey;
      } else {
        // Perpendicular distance from p to line a..b, squared.
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lineLen2;
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const ex = p.x - projX;
        const ey = p.y - projY;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > maxDist2) {
        maxDist2 = d2;
        maxIdx = i;
      }
    }
    if (maxDist2 > tol2) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]!);
  return out;
}

// A turn at least this sharp (degrees between the incoming and the outgoing
// chord) is a corner: the curve breaks its tangent there instead of rounding
// it. Above the turning of a small handwriting loop at the simplifier's
// tolerance (about 66 degrees at 3 px radius), below a retrace cusp (150 to
// 180). One value for every stroke: the renderer draws stored strokes, which
// record no pointer (docs/research/stroke-smoothing.md "Parameters").
export const CORNER_TURN_DEG = 100;
const CORNER_COS = Math.cos((CORNER_TURN_DEG * Math.PI) / 180);

type Point = { x: number; y: number };

/** Whether `p` turns by at least `CORNER_TURN_DEG` between `prev` and `next`. */
export function isStrokeCorner(prev: Point, p: Point, next: Point): boolean {
  const ax = p.x - prev.x;
  const ay = p.y - prev.y;
  const bx = next.x - p.x;
  const by = next.y - p.y;
  const la = ax * ax + ay * ay;
  const lb = bx * bx + by * by;
  if (la === 0 || lb === 0) return false;
  return (ax * bx + ay * by) / Math.sqrt(la * lb) <= CORNER_COS;
}

// A point's smooth neighbour for the segment beside it, or null for the
// phantom end point: no neighbour (a stroke end), a zero chord, or a corner.
function neighbour(
  at: (i: number) => Point | undefined,
  i: number,
  away: number,
  toward: number,
): Point | null {
  const p = at(i);
  const n = at(away);
  const other = at(toward);
  if (!p || !n || !other) return null;
  if (n.x === p.x && n.y === p.y) return null;
  return isStrokeCorner(n, p, other) ? null : n;
}

/**
 * One cubic Bezier of the centripetal Catmull-Rom: segment `i`, from point `i`
 * to `i + 1`, as `C c1x c1y, c2x c2y, x y`. `at` returns the point at an index
 * or undefined past an end (a closed path wraps instead). Knots are spaced by
 * the square root of the chord (Yuksel et al.), so the curve cannot cusp or
 * loop within a segment. A missing neighbour or a corner uses the phantom point
 * `2 p1 - p2`, which leaves along the chord.
 */
export function catmullRomSegment(
  at: (i: number) => Point | undefined,
  i: number,
  fmt: (n: number) => number = (n) => n,
): string {
  return segmentString(at, i, fmt, fmt);
}

function segmentString(
  at: (i: number) => Point | undefined,
  i: number,
  fx: (n: number) => number,
  fy: (n: number) => number,
): string {
  const p1 = at(i)!;
  const p2 = at(i + 1)!;
  const d2 = Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  let c1x = p1.x;
  let c1y = p1.y;
  let c2x = p2.x;
  let c2y = p2.y;
  if (d2 > 0) {
    // Tangents scaled to the segment's knot interval (m * d2), phantom = chord.
    let m1x = p2.x - p1.x;
    let m1y = p2.y - p1.y;
    let m2x = m1x;
    let m2y = m1y;
    const p0 = neighbour(at, i, i - 1, i + 1);
    if (p0) {
      const d1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y));
      m1x = d2 * ((p1.x - p0.x) / d1 - (p2.x - p0.x) / (d1 + d2) + (p2.x - p1.x) / d2);
      m1y = d2 * ((p1.y - p0.y) / d1 - (p2.y - p0.y) / (d1 + d2) + (p2.y - p1.y) / d2);
    }
    const p3 = neighbour(at, i + 1, i + 2, i);
    if (p3) {
      const d3 = Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y));
      m2x = d2 * ((p2.x - p1.x) / d2 - (p3.x - p1.x) / (d2 + d3) + (p3.x - p2.x) / d3);
      m2y = d2 * ((p2.y - p1.y) / d2 - (p3.y - p1.y) / (d2 + d3) + (p3.y - p2.y) / d3);
    }
    c1x = p1.x + m1x / 3;
    c1y = p1.y + m1y / 3;
    c2x = p2.x - m2x / 3;
    c2y = p2.y - m2y / 3;
  }
  return `C ${fx(c1x)} ${fy(c1y)}, ${fx(c2x)} ${fy(c2y)}, ${fx(p2.x)} ${fy(p2.y)}`;
}

export type CatmullRomPathOptions = {
  /** Shapes every number written (the SVG export rounds to keep files small). */
  fmt?: (n: number) => number;
  /** Scale the finished curve, built in the points' true proportions, per axis. */
  scaleX?: number;
  scaleY?: number;
};

// A smooth SVG path (`M`, then one cubic `C` per span) through every point:
// the centripetal Catmull-Rom above, broken at corners. `closed` wraps the
// neighbours, adds the closing span and a `Z`, so a filled freehand reads as a
// continuous outline. Every freehand stroke draws through this, on the canvas
// and in every export (docs/specs/023-whiteboard/whiteboard.md "Pens").
export function catmullRomToBezierPath(
  points: Point[],
  closed: boolean,
  options: CatmullRomPathOptions = {},
): string {
  const fmt = options.fmt ?? ((n: number) => n);
  const sx = options.scaleX ?? 1;
  const sy = options.scaleY ?? 1;
  const fx = sx === 1 ? fmt : (n: number) => fmt(n * sx);
  const fy = sy === 1 ? fmt : (n: number) => fmt(n * sy);
  if (points.length === 0) return '';
  const n = points.length;
  const out: string[] = [`M ${fx(points[0]!.x)} ${fy(points[0]!.y)}`];
  if (n === 1) return out[0]!;
  const at = closed
    ? (i: number) => points[((i % n) + n) % n]
    : (i: number) => (i < 0 || i >= n ? undefined : points[i]);
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) out.push(segmentString(at, i, fx, fy));
  if (closed) out.push('Z');
  return out.join(' ');
}
