// The shapes SVG import works in (docs/specs/020-import-export/svg-import.md "Geometry"): contours of cubic segments,
// a straight segment marked so it lands as a node without handles. Plus the affine matrix every transform is.

export type Pt = { x: number; y: number };

/** One segment from the pen to `to`: a cubic through `c1` and `c2`, or a straight line (`line`). */
export type Segment = { c1: Pt; c2: Pt; to: Pt; line?: true };

/** One subpath: where it starts, its segments, and whether it ends in `Z`. */
export type Contour = { start: Pt; segments: Segment[]; closed: boolean };

/** An SVG matrix `[a b c d e f]`: x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` then `n`: the matrix that applies `n` first and `m` after (SVG's parent × child). */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Matrix, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** How much the matrix scales lengths, on average (the square root of its area scale). */
export function scaleOf(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** The largest factor the matrix stretches any length by. */
export function maxScaleOf(m: Matrix): number {
  // The largest singular value of the 2 by 2 part.
  const [a, b, c, d] = m;
  const s1 = a * a + b * b + c * c + d * d;
  const s2 = Math.sqrt((a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2);
  return Math.sqrt((s1 + s2) / 2);
}

/** A straight segment to `to`, its control points on the line so any code that reads it as a cubic is right. */
export function lineTo(from: Pt, to: Pt): Segment {
  return {
    c1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
    c2: { x: from.x + ((to.x - from.x) * 2) / 3, y: from.y + ((to.y - from.y) * 2) / 3 },
    to,
    line: true,
  };
}

/** A contour carried through a matrix: an affine map takes a cubic's control points to the mapped cubic's. */
export function transformContour(c: Contour, m: Matrix): Contour {
  return {
    start: apply(m, c.start),
    segments: c.segments.map((s) => {
      const out: Segment = { c1: apply(m, s.c1), c2: apply(m, s.c2), to: apply(m, s.to) };
      if (s.line) out.line = true;
      return out;
    }),
    closed: c.closed,
  };
}

/** The tight box of a cubic's own curve (its extremes), grown into `box`. */
function growCubic(box: number[], p0: Pt, c1: Pt, c2: Pt, p3: Pt): void {
  const at = (t: number, a: number, b: number, c: number, d: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const roots = (a: number, b: number, c: number, d: number): number[] => {
    // The derivative's coefficients: A t² + B t + C.
    const A = -a + 3 * b - 3 * c + d;
    const B = 2 * (a - 2 * b + c);
    const C = b - a;
    if (Math.abs(A) < 1e-12) return Math.abs(B) < 1e-12 ? [] : [-C / B];
    const disc = B * B - 4 * A * C;
    if (disc < 0) return [];
    const r = Math.sqrt(disc);
    return [(-B + r) / (2 * A), (-B - r) / (2 * A)];
  };
  const xs = [0, 1, ...roots(p0.x, c1.x, c2.x, p3.x)].filter((t) => t >= 0 && t <= 1);
  const ys = [0, 1, ...roots(p0.y, c1.y, c2.y, p3.y)].filter((t) => t >= 0 && t <= 1);
  for (const t of xs) {
    const x = at(t, p0.x, c1.x, c2.x, p3.x);
    box[0] = Math.min(box[0]!, x);
    box[2] = Math.max(box[2]!, x);
  }
  for (const t of ys) {
    const y = at(t, p0.y, c1.y, c2.y, p3.y);
    box[1] = Math.min(box[1]!, y);
    box[3] = Math.max(box[3]!, y);
  }
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** The box of the drawn curves (not their control points), or null for nothing. */
export function contoursBox(contours: readonly Contour[]): Box | null {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of contours) {
    let pen = c.start;
    box[0] = Math.min(box[0]!, pen.x);
    box[1] = Math.min(box[1]!, pen.y);
    box[2] = Math.max(box[2]!, pen.x);
    box[3] = Math.max(box[3]!, pen.y);
    for (const s of c.segments) {
      growCubic(box, pen, s.c1, s.c2, s.to);
      pen = s.to;
    }
  }
  if (!Number.isFinite(box[0]!)) return null;
  return { x0: box[0]!, y0: box[1]!, x1: box[2]!, y1: box[3]! };
}
