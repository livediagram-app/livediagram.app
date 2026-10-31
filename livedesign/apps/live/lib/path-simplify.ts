// Simplify (docs/specs/023-draw-mode/path-tool.md "Combined paths"): a contour of many plain
// corners, as Combine and Tidy trace them, cut to the points its outline needs, the curves between
// them given back as smooth nodes. Sharp turns stay corners; every other kept point gets aligned
// handles along its neighbours (Catmull-Rom), and a segment that strays more than SIMPLIFY_TOLERANCE_PX
// from the traced outline takes back the traced point it strays furthest at. Pure, and linear in
// the points per pass, with a bounded number of passes.
import { cubicAt, type PathAnchor } from '@livedesign/design';
import { simplifyLine } from './simplify-line';

type Point = { x: number; y: number };

/** No part of the simplified outline is further than this from the traced one, in canvas px. */
export const SIMPLIFY_TOLERANCE_PX = 0.5;
/** Simplify is offered for a contour of at least this many plain corners. */
export const SIMPLIFY_MIN_NODES = 12;
// A turn sharper than this, in degrees, is a corner of the shape and stays one.
const SHARP_TURN_DEGREES = 50;
const SHARP_COS = Math.cos((SHARP_TURN_DEGREES * Math.PI) / 180);
// The first cut keeps points within this share of the contour's size (a smooth curve passes close
// to far fewer points than a straight run needs); refinement adds back what the curves miss.
const FIRST_CUT_SHARE = 0.01;
// Refinement passes before what still strays is kept as traced.
const MAX_PASSES = 12;
// Samples a segment is checked at.
const SAMPLES = 16;

/** Whether `anchors` is a run of plain corners long enough to simplify. */
export function isSimplifiable(anchors: readonly PathAnchor[]): boolean {
  return (
    anchors.length >= SIMPLIFY_MIN_NODES &&
    anchors.every((a) => a.mode === 'corner' && !a.handleIn && !a.handleOut)
  );
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Point) => Math.hypot(v.x, v.y);

function segDistance(p: Point, a: Point, b: Point): number {
  const d = sub(b, a);
  const l2 = d.x * d.x + d.y * d.y;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / l2));
  return Math.hypot(p.x - (a.x + t * d.x), p.y - (a.y + t * d.y));
}

function polylineDistance(p: Point, line: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++)
    best = Math.min(best, segDistance(p, line[i - 1]!, line[i]!));
  return best;
}

// Whether the outline turns sharply at point i (its neighbours given).
function isSharp(prev: Point, p: Point, next: Point): boolean {
  const a = sub(p, prev);
  const b = sub(next, p);
  const la = len(a);
  const lb = len(b);
  if (la === 0 || lb === 0) return false;
  return (a.x * b.x + a.y * b.y) / (la * lb) < SHARP_COS;
}

/**
 * The contour with fewer points and its curves smooth, within SIMPLIFY_TOLERANCE_PX of where it
 * was; null when it is not a run of plain corners or no point would go.
 */
export function simplifyContour(
  anchors: readonly PathAnchor[],
  closed: boolean,
  tolerance = SIMPLIFY_TOLERANCE_PX,
): PathAnchor[] | null {
  if (!isSimplifiable(anchors)) return null;
  const pts: Point[] = anchors.map((a) => ({ x: a.x, y: a.y }));
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n]!;

  // The shape's corners, which stay: sharp turns, and an open contour's ends.
  const sharp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) sharp[i] = 1;
    else if (isSharp(at(i - 1), pts[i]!, at(i + 1))) sharp[i] = 1;
  }
  const keep = new Uint8Array(n);
  const corners: number[] = [];
  for (let i = 0; i < n; i++) if (sharp[i]) corners.push(i);
  if (corners.length === 0) {
    // A closed curve with no corner: cut at its first point and the point furthest from it.
    let far = 0;
    let farD = -1;
    for (let i = 1; i < n; i++) {
      const d = len(sub(pts[i]!, pts[0]!));
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    corners.push(0, far);
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const firstCut = Math.max(4 * tolerance, Math.max(x1 - x0, y1 - y0) * FIRST_CUT_SHARE);

  // Each run between corners cut to the points its line needs at the first cut.
  const runs = closed ? corners.length : corners.length - 1;
  for (let r = 0; r < runs; r++) {
    const a = corners[r]!;
    const b = r + 1 < corners.length ? corners[r + 1]! : corners[0]! + n;
    const idx: number[] = [];
    for (let i = a; i <= b; i++) idx.push(i % n);
    // simplifyLine keeps the very points it is given, so each carries its index through.
    const picked = simplifyLine(
      idx.map((i) => ({ x: pts[i]!.x, y: pts[i]!.y, i })),
      firstCut,
    );
    for (const p of picked) keep[(p as Point & { i: number }).i] = 1;
  }

  const build = (): PathAnchor[] => {
    const kept: number[] = [];
    for (let i = 0; i < n; i++) if (keep[i]) kept.push(i);
    const m = kept.length;
    return kept.map((i, k) => {
      const p = pts[i]!;
      const hasPrev = closed || k > 0;
      const hasNext = closed || k < m - 1;
      if (sharp[i] || !hasPrev || !hasNext) return { ...p, mode: 'corner' };
      const prev = pts[kept[(k - 1 + m) % m]!]!;
      const next = pts[kept[(k + 1) % m]!]!;
      const dir = sub(next, prev);
      const l = len(dir);
      if (l === 0) return { ...p, mode: 'corner' };
      const ux = dir.x / l;
      const uy = dir.y / l;
      const back = len(sub(p, prev)) / 3;
      const fwd = len(sub(next, p)) / 3;
      return {
        ...p,
        mode: 'aligned',
        handleIn: { x: p.x - ux * back, y: p.y - uy * back },
        handleOut: { x: p.x + ux * fwd, y: p.y + uy * fwd },
      };
    });
  };
  // The kept points' segments, each with the traced points it stands for; for each one that
  // strays, the traced point it strays furthest at (or -1 when none is between).
  const strays = (): { from: number; to: number; worst: number }[] => {
    const out: { from: number; to: number; worst: number }[] = [];
    const kept: number[] = [];
    for (let i = 0; i < n; i++) if (keep[i]) kept.push(i);
    const shaped = build();
    const m = kept.length;
    const segs = closed ? m : m - 1;
    for (let k = 0; k < segs; k++) {
      const from = kept[k]!;
      const to = k + 1 < m ? kept[k + 1]! : kept[0]! + n;
      const s = shaped[k]!;
      const e = shaped[(k + 1) % m]!;
      const curve: Point[] = [];
      const seg = { p0: s, c1: s.handleOut ?? s, c2: e.handleIn ?? e, p3: e };
      for (let j = 0; j <= SAMPLES; j++) curve.push(cubicAt(seg, j / SAMPLES));
      const traced: Point[] = [];
      for (let i = from; i <= to; i++) traced.push(at(i));
      let worst = -1;
      let worstD = tolerance;
      for (let i = from + 1; i < to; i++) {
        const d = polylineDistance(at(i), curve);
        if (d > worstD) {
          worstD = d;
          worst = i % n;
        }
      }
      let bulges = false;
      for (const c of curve) if (polylineDistance(c, traced) > tolerance) bulges = true;
      if (worst >= 0 || bulges) {
        // A bulge with no traced point straying: the middle one between them goes back in.
        const mid = to - from > 1 ? ((from + to) >> 1) % n : -1;
        out.push({ from, to, worst: worst >= 0 ? worst : mid });
      }
    }
    return out;
  };

  // Each pass takes back, for every segment that strays, the traced point it strays furthest at.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const bad = strays();
    if (bad.length === 0) {
      const out = build();
      return out.length < n ? out : null;
    }
    for (const b of bad) {
      if (b.worst >= 0) keep[b.worst] = 1;
      else {
        // Nothing traced between them to take back: the segment runs straight instead.
        sharp[b.from % n] = 1;
        sharp[b.to % n] = 1;
      }
    }
  }
  // Still straying after every pass: left as it is rather than moved further than promised.
  return null;
}
