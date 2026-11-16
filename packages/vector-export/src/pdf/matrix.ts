// 2D affine matrices as SVG and PDF both write them, [a b c d e f]: a point (x, y) maps to (a x + c y + e, b x + d y + f).

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` then `n`'s parent: the matrix that applies `n` first, then `m` (m × n). */
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

/** The inverse, or null for a matrix that flattens everything onto a line. */
export function invert(m: Matrix): Matrix | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scale = (x: number, y = x): Matrix => [x, 0, 0, y, 0, 0];

/** How much the matrix grows a length, on average over directions (the square root of its area scale). */
export function lengthScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

export const isIdentity = (m: Matrix): boolean => m.every((v, i) => v === IDENTITY[i]);

/** The box the four corners of `r` land in under `m`. */
export function mapRect(
  m: Matrix,
  r: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const pts = [
    apply(m, r.x, r.y),
    apply(m, r.x + r.w, r.y),
    apply(m, r.x, r.y + r.h),
    apply(m, r.x + r.w, r.y + r.h),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A number as a PDF operand: at most four decimals, no exponent, no negative zero. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10000) / 10000;
  if (r === 0) return '0';
  const s = String(r);
  if (!s.includes('e')) return s;
  return r.toFixed(4).replace(/\.?0+$/, '');
}

export const matrixOps = (m: Matrix): string => `${m.map(num).join(' ')} cm`;
