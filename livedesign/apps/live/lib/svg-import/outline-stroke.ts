// A stroke as the filled area it paints (docs/specs/020-import-export/svg-import.md "Bold strokes become filled
// shapes"; blueprint "Stroke outlining"). Each contour becomes one ring whose nonzero area is exactly the stroke's:
// the left side forward, the end cap, the right side backward, the start cap, the join on the side away from each
// turn and the inner side passing through the vertex. That ring is the sum of every segment's quad and every join's
// wedge, all wound one way, so it may cross itself but never winds negative. The boolean engine (which reads a
// self-crossing ring nonzero) resolves the rings into clean even-odd rings. Works in landed px.
import type { Ring } from '@/lib/combine/outline';
import { simplifyRing } from '@/lib/combine/simplify';
import { SVG_NONZERO_MAX_POINTS, SVG_OUTLINE_TOLERANCE_PX } from './constants';
import type { Contour } from './geometry';
import { cubicInterior, type BooleanEngine } from './nonzero';
import type { LineStyle } from './walk';

type P = [number, number];

// Two traced points closer than this (px) are one.
const SAME_PX = 1e-9;
// Directions closer to parallel than this (as the sine between them) make no corner.
const STRAIGHT_SINE = 1e-9;

/** One traced contour: its points, which of them are corners (where two source segments meet, taking the declared
 *  join; a point inside a traced curve takes a round join), and whether it closes. */
export type Trace = { pts: P[]; corner: boolean[]; closed: boolean };

/** A contour traced within `tol`, repeated points dropped (a closed contour's return to its start too). */
export function traceStroke(c: Contour, tol: number): Trace {
  const pts: P[] = [[c.start.x, c.start.y]];
  const corner: boolean[] = [true];
  const push = (x: number, y: number, isCorner: boolean) => {
    const last = pts[pts.length - 1]!;
    if (Math.abs(last[0] - x) <= SAME_PX && Math.abs(last[1] - y) <= SAME_PX) {
      if (isCorner) corner[corner.length - 1] = true;
      return;
    }
    pts.push([x, y]);
    corner.push(isCorner);
  };
  let p0 = c.start;
  for (const s of c.segments) {
    if (!s.line) cubicInterior(p0, s, tol, (x, y) => push(x, y, false));
    push(s.to.x, s.to.y, true);
    p0 = s.to;
  }
  if (c.closed && pts.length > 1) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (Math.abs(last[0] - first[0]) <= SAME_PX && Math.abs(last[1] - first[1]) <= SAME_PX) {
      pts.pop();
      corner.pop();
    }
  }
  return { pts, corner, closed: c.closed };
}

// The unit direction from a to b.
function dir(a: P, b: P): P {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return [dx / len, dy / len];
}

// Points on the circle of radius h about p, from the unit vector u turned through `sweep` radians, the ends left out:
// within `tol` of the circle (each chord's sag at most tol).
function arc(out: P[], p: P, h: number, u: P, sweep: number, tol: number): void {
  const step = h > tol ? 2 * Math.acos(1 - tol / h) : Math.PI;
  const n = Math.ceil(Math.abs(sweep) / step);
  for (let i = 1; i < n; i++) {
    const a = (sweep * i) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push([p[0] + h * (u[0] * c - u[1] * s), p[1] + h * (u[0] * s + u[1] * c)]);
  }
}

const at = (p: P, h: number, v: P): P => [p[0] + h * v[0], p[1] + h * v[1]];

// The join at p between directions a and b (the segments either side `la` and `lb` long), onto the left and right
// sides (both in forward order).
function join(
  left: P[],
  right: P[],
  p: P,
  a: P,
  b: P,
  la: number,
  lb: number,
  h: number,
  kind: LineStyle['join'],
  miterLimit: number,
  tol: number,
): void {
  const na: P = [-a[1], a[0]];
  const nb: P = [-b[1], b[0]];
  const cross = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1];
  if (Math.abs(cross) <= STRAIGHT_SINE && dot > 0) {
    left.push(at(p, h, nb));
    right.push(at(p, -h, nb));
    return;
  }
  // The turn's signed angle; a reversal turns right, so its join goes on the left.
  const turn = Math.abs(cross) <= STRAIGHT_SINE ? -Math.PI : Math.atan2(cross, dot);
  // Turning right (negative), the left side is outside the turn.
  const s = turn < 0 ? 1 : -1;
  const outer = s > 0 ? left : right;
  const inner = s > 0 ? right : left;
  outer.push(at(p, s * h, na));
  if (kind === 'round') arc(outer, p, h, [s * na[0], s * na[1]], turn, tol);
  else if (kind === 'miter' && 1 / Math.sqrt((1 + dot) / 2) <= miterLimit) {
    const k = (s * h) / (1 + dot);
    outer.push([p[0] + k * (na[0] + nb[0]), p[1] + k * (na[1] + nb[1])]);
  }
  outer.push(at(p, s * h, nb));
  // The inner side passes through the vertex, closing each segment's quad: it may cross itself but never winds
  // negative. Where the corner the two quads share (a kite reaching h sin φ back along each segment) fits within half
  // of each segment, no two kites meet, so a point in k kites lies in more than k quads and the kite can be cut: the
  // inner side then takes the one point where the offset lines meet, with no crossing to resolve.
  if (dot > 0 && h * Math.abs(cross) <= Math.min(la, lb) / 2) {
    const k = (-s * h) / (1 + dot);
    inner.push([p[0] + k * (na[0] + nb[0]), p[1] + k * (na[1] + nb[1])]);
  } else inner.push(at(p, -s * h, na), p, at(p, -s * h, nb));
}

// A cap at p facing d, from p + h n round to p - h n (n the left normal of d).
function cap(out: P[], p: P, d: P, h: number, kind: LineStyle['cap'], tol: number): void {
  const n: P = [-d[1], d[0]];
  if (kind === 'square') {
    out.push([p[0] + h * (n[0] + d[0]), p[1] + h * (n[1] + d[1])]);
    out.push([p[0] + h * (d[0] - n[0]), p[1] + h * (d[1] - n[1])]);
  } else if (kind === 'round') arc(out, p, h, n, -Math.PI, tol);
}

// A contour of one point: a round cap paints a circle, a square cap a square along the x-axis, butt nothing.
function dot(p: P, h: number, kind: LineStyle['cap'], tol: number): P[] | null {
  if (kind === 'butt') return null;
  if (kind === 'square')
    return [
      [p[0] - h, p[1] - h],
      [p[0] + h, p[1] - h],
      [p[0] + h, p[1] + h],
      [p[0] - h, p[1] + h],
    ];
  const out: P[] = [[p[0] + h, p[1]]];
  arc(out, p, h, [1, 0], 2 * Math.PI, tol);
  return out;
}

/** The ring whose nonzero area is the stroke of `t` at width `width`, or null when it paints nothing. */
export function strokeRing(t: Trace, width: number, line: LineStyle, tol: number): P[] | null {
  const h = width / 2;
  const { pts } = t;
  if (!(h > 0)) return null;
  if (pts.length === 1) return dot(pts[0]!, h, line.cap, tol);
  const closed = t.closed && pts.length > 1;
  const n = pts.length;
  const edges = closed ? n : n - 1;
  const d: P[] = [];
  const len: number[] = [];
  for (let i = 0; i < edges; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    d.push(dir(a, b));
    len.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const left: P[] = [];
  const right: P[] = [];
  // The join at vertex i, between edge i - 1 (wrapping when closed) and edge i.
  const joinAt = (i: number) => {
    const prev = (i - 1 + edges) % edges;
    join(
      left,
      right,
      pts[i]!,
      d[prev]!,
      d[i]!,
      len[prev]!,
      len[i]!,
      h,
      t.corner[i] ? line.join : 'round',
      line.miterLimit,
      tol,
    );
  };
  if (closed) {
    for (let i = 0; i < n; i++) joinAt(i);
    // The two loops joined through the start point: the bridge there and back cancels.
    const p0 = pts[0]!;
    return [...left, left[0]!, p0, right[0]!, ...right.slice(1).reverse(), right[0]!, p0];
  }
  const first = d[0]!;
  const last = d[edges - 1]!;
  left.push(at(pts[0]!, h, [-first[1], first[0]]));
  right.push(at(pts[0]!, -h, [-first[1], first[0]]));
  for (let i = 1; i < n - 1; i++) joinAt(i);
  const end = pts[n - 1]!;
  left.push(at(end, h, [-last[1], last[0]]));
  right.push(at(end, -h, [-last[1], last[0]]));
  const ring: P[] = [...left];
  cap(ring, end, last, h, line.cap, tol);
  ring.push(...right.reverse());
  // The start cap faces back along the first direction, from the right side round to the left.
  cap(ring, pts[0]!, [-first[0], -first[1]], h, line.cap, tol);
  return ring;
}

/** The stroke of `contours` at `width` (landed px) as even-odd rings; null when it is too detailed to resolve (past
 *  `SVG_NONZERO_MAX_POINTS` traced points) or the engine fails, so the caller keeps the stroke a stroke. */
export function outlineStroke(
  engine: BooleanEngine,
  contours: readonly Contour[],
  width: number,
  line: LineStyle,
  tol = SVG_OUTLINE_TOLERANCE_PX,
): Ring[] | null {
  const rings: P[][] = [];
  let points = 0;
  for (const c of contours) {
    const ring = strokeRing(traceStroke(c, tol), width, line, tol);
    if (!ring) continue;
    points += ring.length;
    if (points > SVG_NONZERO_MAX_POINTS) return null;
    rings.push(ring);
  }
  if (rings.length === 0) return [];
  try {
    const [head, ...rest] = rings.map((r) => [[r]]);
    const area = engine.union(head!, ...rest);
    return area.flatMap((poly) => poly.map((r) => simplifyRing(r))).filter((r) => r.length >= 3);
  } catch {
    return null;
  }
}
