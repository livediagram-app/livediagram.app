// Nonzero fills as livedesign's even-odd paths (docs/specs/020-import-export/svg-import.md "Geometry"). Most files
// draw contours that alternate direction as they nest, where the two rules paint the same, and the curves are kept.
// Where they differ, the element's area is resolved through Combine's boolean engine (lib/combine): each contour,
// largest first, is added where the winding just inside it is nonzero and cut where it is zero.
import type { Ring } from '@/lib/combine/outline';
import { simplifyRing } from '@/lib/combine/simplify';
import {
  SVG_NONZERO_MAX_POINTS,
  SVG_NONZERO_SAMPLES_PER_RING,
  SVG_TRACE_TOLERANCE_PX,
} from './constants';
import type { Contour, Pt, Segment } from './geometry';

// The most pieces one cubic is traced into.
const MAX_PIECES = 256;

/** The points inside one cubic from `p0`, traced uniformly within `tol` px (its ends left out). */
export function cubicInterior(
  p0: Pt,
  s: Segment,
  tol: number,
  push: (x: number, y: number) => void,
): void {
  // Uniform pieces: their error is at most 3/4 of the control polygon's largest second difference over n².
  const ddx = Math.max(
    Math.abs(p0.x - 2 * s.c1.x + s.c2.x),
    Math.abs(s.c1.x - 2 * s.c2.x + s.to.x),
  );
  const ddy = Math.max(
    Math.abs(p0.y - 2 * s.c1.y + s.c2.y),
    Math.abs(s.c1.y - 2 * s.c2.y + s.to.y),
  );
  const n = Math.min(
    MAX_PIECES,
    Math.max(1, Math.ceil(Math.sqrt((0.75 * Math.hypot(ddx, ddy)) / tol))),
  );
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const d = 3 * u * t * t;
    const e = t * t * t;
    push(
      a * p0.x + b * s.c1.x + d * s.c2.x + e * s.to.x,
      a * p0.y + b * s.c1.y + d * s.c2.y + e * s.to.y,
    );
  }
}

/** A contour traced to a closed ring within `tol` px (a straight segment adds its end only). */
export function traceContour(c: Contour, tol = SVG_TRACE_TOLERANCE_PX): Ring {
  const ring: Ring = [[c.start.x, c.start.y]];
  const push = (x: number, y: number) => ring.push([x, y]);
  let p0 = c.start;
  for (const s of c.segments) {
    if (!s.line) cubicInterior(p0, s, tol, push);
    ring.push([s.to.x, s.to.y]);
    p0 = s.to;
  }
  return ring;
}

/** Twice the ring's signed area (positive when its inside lies to the left of each edge). */
export function signedArea2(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i]!;
    const [x1, y1] = r[(i + 1) % r.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return a;
}

type Boxed = { ring: Ring; box: [number, number, number, number] };

function boxed(r: Ring): Boxed {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of r) {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return { ring: r, box };
}

// The winding number and the crossing count of a horizontal ray from `p` over every ring.
function windingAt(
  rings: readonly Boxed[],
  x: number,
  y: number,
): { winding: number; crossings: number } {
  let winding = 0;
  let crossings = 0;
  for (const { ring, box } of rings) {
    if (y < box[1] || y > box[3] || x > box[2]) continue;
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i]!;
      const [x1, y1] = ring[(i + 1) % ring.length]!;
      if (y0 <= y === y1 <= y) continue;
      const cx = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
      if (cx <= x) continue;
      crossings++;
      winding += y1 > y0 ? 1 : -1;
    }
  }
  return { winding, crossings };
}

// Points just either side of the ring, `count` of them spread evenly along its length: [inside, outside] by its
// orientation. Spread by length rather than by edge, so a long straight side is sampled along its run, where another
// contour may cross it.
function samples(r: Ring, count: number): [number, number][][] {
  const out: [number, number][][] = [];
  const sign = signedArea2(r) >= 0 ? 1 : -1;
  let perimeter = 0;
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i]!;
    const [x1, y1] = r[(i + 1) % r.length]!;
    perimeter += Math.hypot(x1 - x0, y1 - y0);
  }
  if (perimeter < 1e-6) return out;
  const spacing = perimeter / count;
  // The first sample's distance along the ring: an odd share of a spacing in, so samples miss the corners a ring of
  // equal sides puts at whole and half spacings (a point at a corner sits on two edges and tests neither side).
  let next = spacing * 0.382;
  let walked = 0;
  for (let i = 0; i < r.length && out.length < count; i++) {
    const [x0, y0] = r[i]!;
    const [x1, y1] = r[(i + 1) % r.length]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) continue;
    const eps = Math.min(0.05, len / 100);
    // The left normal: the inside of a positively wound ring.
    const nx = (-(y1 - y0) / len) * eps * sign;
    const ny = ((x1 - x0) / len) * eps * sign;
    while (next <= walked + len && out.length < count) {
      const t = (next - walked) / len;
      const mx = x0 + (x1 - x0) * t;
      const my = y0 + (y1 - y0) * t;
      out.push([
        [mx + nx, my + ny],
        [mx - nx, my - ny],
      ]);
      next += spacing;
    }
    walked += len;
  }
  return out;
}

/** Whether even-odd paints these rings as nonzero would; also true past the point cap, where the check is skipped. */
export function evenOddMatchesNonzero(rings: readonly Ring[]): boolean {
  const total = rings.reduce((n, r) => n + r.length, 0);
  if (total > SVG_NONZERO_MAX_POINTS) return true;
  const all = rings.map(boxed);
  for (const r of rings) {
    for (const pair of samples(r, SVG_NONZERO_SAMPLES_PER_RING)) {
      for (const [x, y] of pair) {
        const { winding, crossings } = windingAt(all, x, y);
        if ((winding !== 0) !== (crossings % 2 === 1)) return false;
      }
    }
  }
  return true;
}

type Polygon = Ring[];
type MultiPolygon = Polygon[];
/** The boolean engine's two operations this needs (polygon-clipping's). */
export type BooleanEngine = {
  union: (a: MultiPolygon, ...b: MultiPolygon[]) => MultiPolygon;
  difference: (a: MultiPolygon, ...b: MultiPolygon[]) => MultiPolygon;
};

/** The nonzero area of these rings as even-odd rings (simplified), resolved with `engine`. */
export function resolveNonzero(engine: BooleanEngine, rings: readonly Ring[]): Ring[] {
  const all = rings.map(boxed);
  const ordered = [...rings]
    .filter((r) => r.length >= 3)
    .sort((a, b) => Math.abs(signedArea2(b)) - Math.abs(signedArea2(a)));
  let acc: MultiPolygon = [];
  for (const r of ordered) {
    const inside = samples(r, 1)[0]?.[0];
    if (!inside) continue;
    const filled = windingAt(all, inside[0], inside[1]).winding !== 0;
    if (filled) acc = acc.length ? engine.union(acc, [[r]]) : engine.union([[r]]);
    else if (acc.length) acc = engine.difference(acc, [[r]]);
  }
  return acc.flatMap((poly) => poly.map((r) => simplifyRing(r))).filter((r) => r.length >= 3);
}
