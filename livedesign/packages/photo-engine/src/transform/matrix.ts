// 3 x 3 matrices for transforms (docs/specs/031-photo/photo-tools.md "Moving and transforming"):
// affine moves, scales, rotations and skews, and the projective homographies Perspective and Distort
// make, row-major, mapping a column (x, y, 1).

export type Matrix = [number, number, number, number, number, number, number, number, number];
export type Pt = { x: number; y: number };

const SNAP = 1e-6;

export const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array(9).fill(0) as Matrix;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[r * 3 + k]! * b[k * 3 + c]!;
      out[r * 3 + c] = s;
    }
  return out;
}

/** The matrices applied in order (the first applied first). */
export function chain(...ms: Matrix[]): Matrix {
  return ms.reduce((acc, m) => multiply(m, acc), IDENTITY);
}

export const translate = (x: number, y: number): Matrix => [1, 0, x, 0, 1, y, 0, 0, 1];
export const scale = (sx: number, sy = sx): Matrix => [sx, 0, 0, 0, sy, 0, 0, 0, 1];
export function rotate(rad: number): Matrix {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
export const skew = (kx: number, ky: number): Matrix => [
  1,
  Math.tan(kx),
  0,
  Math.tan(ky),
  1,
  0,
  0,
  0,
  1,
];

export function apply(m: Matrix, p: Pt): Pt {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w };
}

export function invert(m: Matrix): Matrix | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

export function isAffine(m: Matrix): boolean {
  return Math.abs(m[6]) < 1e-12 && Math.abs(m[7]) < 1e-12 && Math.abs(m[8] - 1) < 1e-12;
}

function solve8(A: number[][], bvec: number[]): number[] | null {
  const n = 8;
  const M = A.map((row, i) => [...row, bvec[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    if (Math.abs(M[piv]![col]!) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / M[col]![col]!;
      for (let k = col; k <= n; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** The homography taking the four `from` corners to the four `to` corners (in order). */
export function quadToQuad(from: readonly Pt[], to: readonly Pt[]): Matrix | null {
  const A: number[][] = [];
  const bvec: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    bvec.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    bvec.push(v);
  }
  const h = solve8(A, bvec);
  return h ? ([...h, 1] as Matrix) : null;
}

/** The rect of the four corners of a w x h box under `m`. */
export function transformedBounds(
  m: Matrix,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  const pts = [
    apply(m, { x: 0, y: 0 }),
    apply(m, { x: w, y: 0 }),
    apply(m, { x: w, y: h }),
    apply(m, { x: 0, y: h }),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  // Within a hair of a whole pixel is that pixel: a quarter turn's sine is not quite zero.
  const x = Math.floor(Math.min(...xs) + SNAP);
  const y = Math.floor(Math.min(...ys) + SNAP);
  return {
    x,
    y,
    width: Math.ceil(Math.max(...xs) - SNAP) - x,
    height: Math.ceil(Math.max(...ys) - SNAP) - y,
  };
}
