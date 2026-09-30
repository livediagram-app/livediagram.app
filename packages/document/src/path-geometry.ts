// The curve maths behind the path element (docs/specs/023-whiteboard/path-tool.md "The path
// element"): pure functions over anchors in canvas px. A segment is the cubic Bézier between two
// consecutive nodes through their facing handles; with neither handle it is a straight line.
import type { PathHandleMode } from './element-types';
import type { Point } from './geometry-primitives';

/** A node in canvas px (unrotated): its position, its handle mode and its optional handles. */
export type PathAnchor = {
  x: number;
  y: number;
  mode: PathHandleMode;
  handleIn?: Point;
  handleOut?: Point;
};

/** The cubic between node `from` and node `to`. `straight` when neither facing handle exists. */
export type PathSegment = {
  from: number;
  to: number;
  p0: Point;
  c1: Point;
  c2: Point;
  p3: Point;
  straight: boolean;
};

export type PathBox = { x: number; y: number; width: number; height: number };

export type PathNearest = { segment: number; t: number; point: Point; distance: number };

// The nearest-point search: coarse samples per segment, then interval halvings about the best.
const NEAREST_SAMPLES = 24;
const NEAREST_HALVINGS = 12;
// A bend never pulls from a segment's very ends, where a cubic has no leverage.
const BEND_T_MIN = 0.05;
const BEND_T_MAX = 0.95;

const at = (a: PathAnchor): Point => ({ x: a.x, y: a.y });

export function pathSegments(anchors: readonly PathAnchor[], closed: boolean): PathSegment[] {
  const n = anchors.length;
  if (n < 2) return [];
  const segments: PathSegment[] = [];
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const a = anchors[i]!;
    const b = anchors[j]!;
    segments.push({
      from: i,
      to: j,
      p0: at(a),
      c1: a.handleOut ?? at(a),
      c2: b.handleIn ?? at(b),
      p3: at(b),
      straight: !a.handleOut && !b.handleIn,
    });
  }
  return segments;
}

const identity = (n: number) => n;

/** The SVG path data: `M` then `L` per straight segment and `C` per curve, `Z` when closed. */
export function pathD(
  anchors: readonly PathAnchor[],
  closed: boolean,
  fmt: (n: number) => number = identity,
): string {
  if (anchors.length === 0) return '';
  const p = (pt: Point) => `${fmt(pt.x)} ${fmt(pt.y)}`;
  const parts = [`M ${p(anchors[0]!)}`];
  for (const seg of pathSegments(anchors, closed)) {
    parts.push(seg.straight ? `L ${p(seg.p3)}` : `C ${p(seg.c1)} ${p(seg.c2)} ${p(seg.p3)}`);
  }
  if (closed && anchors.length > 1) parts.push('Z');
  return parts.join(' ');
}

export function cubicAt(seg: Pick<PathSegment, 'p0' | 'c1' | 'c2' | 'p3'>, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.p3.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.p3.y,
  };
}

// The parameters in (0, 1) where one axis of the cubic turns: the roots of its derivative,
// a quadratic a·t² + b·t + c.
function turningTs(p0: number, c1: number, c2: number, p3: number): number[] {
  const a = -p0 + 3 * c1 - 3 * c2 + p3;
  const b = 2 * (p0 - 2 * c1 + c2);
  const c = c1 - p0;
  const inside = (t: number) => t > 0 && t < 1;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    const t = -c / b;
    return inside(t) ? [t] : [];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)].filter(inside);
}

/** The box of the drawn curve: its ends and every turning point, never the handles. */
export function pathBounds(anchors: readonly PathAnchor[], closed: boolean): PathBox {
  if (anchors.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = anchors[0]!.x;
  let maxX = minX;
  let minY = anchors[0]!.y;
  let maxY = minY;
  const take = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  for (const a of anchors) take(a);
  for (const seg of pathSegments(anchors, closed)) {
    if (seg.straight) continue;
    const ts = [
      ...turningTs(seg.p0.x, seg.c1.x, seg.c2.x, seg.p3.x),
      ...turningTs(seg.p0.y, seg.c1.y, seg.c2.y, seg.p3.y),
    ];
    for (const t of ts) take(cubicAt(seg, t));
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** De Casteljau: the two halves of a segment at `t`, which trace exactly the same curve. */
export function splitSegment(seg: PathSegment, t: number): [PathSegment, PathSegment] {
  const a = lerp(seg.p0, seg.c1, t);
  const b = lerp(seg.c1, seg.c2, t);
  const c = lerp(seg.c2, seg.p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const m = lerp(d, e, t);
  return [
    { ...seg, c1: a, c2: d, p3: m },
    { ...seg, p0: m, c1: e, c2: c },
  ];
}

function nearestOnSegment(seg: PathSegment, p: Point): { t: number; point: Point; d: number } {
  const dist = (t: number) => {
    const q = cubicAt(seg, t);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= NEAREST_SAMPLES; i++) {
    const t = i / NEAREST_SAMPLES;
    const d = dist(t);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  let step = 1 / NEAREST_SAMPLES;
  for (let i = 0; i < NEAREST_HALVINGS; i++) {
    step /= 2;
    for (const t of [best - step, best + step]) {
      if (t < 0 || t > 1) continue;
      const d = dist(t);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
  }
  return { t: best, point: cubicAt(seg, best), d: bestD };
}

/** The point of the path nearest `p`: which segment, where on it, and how far. */
export function nearestOnPath(
  anchors: readonly PathAnchor[],
  closed: boolean,
  p: Point,
): PathNearest | null {
  let best: PathNearest | null = null;
  pathSegments(anchors, closed).forEach((seg, i) => {
    const hit = nearestOnSegment(seg, p);
    if (!best || hit.d < best.distance) {
      best = { segment: i, t: hit.t, point: hit.point, distance: hit.d };
    }
  });
  return best;
}

/**
 * The controls that make the segment pass through `target` at `t`: each moves along the pull,
 * weighted by its influence at `t`. A straight segment starts from controls on its ends.
 */
export function bendSegment(seg: PathSegment, t: number, target: Point): { c1: Point; c2: Point } {
  const tt = Math.min(BEND_T_MAX, Math.max(BEND_T_MIN, t));
  const on = cubicAt(seg, tt);
  const dx = target.x - on.x;
  const dy = target.y - on.y;
  const u = 1 - tt;
  const k = 3 * tt * u * (u * u + tt * tt);
  return {
    c1: { x: seg.c1.x + (dx * u) / k, y: seg.c1.y + (dy * u) / k },
    c2: { x: seg.c2.x + (dx * tt) / k, y: seg.c2.y + (dy * tt) / k },
  };
}

/**
 * Handles for a node turned smooth (docs/specs/023-whiteboard/path-tool.md "Editing"): along the
 * line between its neighbours, `(next − prev) / 6` either side (Catmull-Rom's tangent, equal
 * lengths); an open end points a third of the way to its one neighbour.
 */
export function smoothHandles(
  anchors: readonly PathAnchor[],
  i: number,
  closed: boolean,
): { handleIn?: Point; handleOut?: Point } {
  const n = anchors.length;
  const node = anchors[i]!;
  const prev = i > 0 ? anchors[i - 1] : closed ? anchors[n - 1] : undefined;
  const next = i < n - 1 ? anchors[i + 1] : closed ? anchors[0] : undefined;
  const off = (v: Point) => ({
    handleIn: { x: node.x - v.x, y: node.y - v.y },
    handleOut: { x: node.x + v.x, y: node.y + v.y },
  });
  if (prev && next && prev !== node && next !== node) {
    return off({ x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 });
  }
  if (next && next !== node) return off({ x: (next.x - node.x) / 3, y: (next.y - node.y) / 3 });
  if (prev && prev !== node) return off({ x: (node.x - prev.x) / 3, y: (node.y - prev.y) / 3 });
  return {};
}

/** `to`, turned about `from` to the nearest multiple of 45°, at the same distance. */
export function constrain45(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { ...to };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + len * Math.cos(angle), y: from.y + len * Math.sin(angle) };
}

/** Where a node's other handle goes when one moves, by the node's mode. */
export function partnerHandle(
  node: Point,
  moved: Point,
  partner: Point | undefined,
  mode: PathHandleMode,
): Point | undefined {
  if (mode === 'corner') return partner;
  const dx = moved.x - node.x;
  const dy = moved.y - node.y;
  if (mode === 'mirrored') return { x: node.x - dx, y: node.y - dy };
  const len = Math.hypot(dx, dy);
  if (!partner || len === 0) return partner;
  const own = Math.hypot(partner.x - node.x, partner.y - node.y);
  return { x: node.x - (dx / len) * own, y: node.y - (dy / len) * own };
}

/** Two nodes at least; a closed path three, or two with a handle to bend them apart. */
export function isCommittablePath(anchors: readonly PathAnchor[], closed: boolean): boolean {
  if (anchors.length < 2) return false;
  if (!closed || anchors.length >= 3) return true;
  return anchors.some((a) => a.handleIn || a.handleOut);
}

/** A polyline along the path: `perSegment` steps per curve, a straight segment its two ends. */
export function samplePath(
  anchors: readonly PathAnchor[],
  closed: boolean,
  perSegment = 16,
): Point[] {
  if (anchors.length === 0) return [];
  const points: Point[] = [at(anchors[0]!)];
  for (const seg of pathSegments(anchors, closed)) {
    if (seg.straight) {
      points.push({ ...seg.p3 });
      continue;
    }
    for (let i = 1; i <= perSegment; i++) points.push(cubicAt(seg, i / perSegment));
  }
  return points;
}
