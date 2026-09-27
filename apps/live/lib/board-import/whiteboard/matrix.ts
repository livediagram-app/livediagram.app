// 2D affine matrices for placing Whiteboard board items
// (docs/specs/020-import-export/blueprints/whiteboard-import.md "Placement"):
// CSS `transform` and SVG `transform` lists, composed down the markup tree.
// Same layout as CSS `matrix(a, b, c, d, e, f)`: x' = a·x + c·y + e, y' = b·x + d·y + f.

export type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
export type Point = { x: number; y: number };

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const translate = (x: number, y: number): Matrix => ({ ...IDENTITY, e: x, f: y });
const scale = (x: number, y: number): Matrix => ({ ...IDENTITY, a: x, d: y });
const rotate = (rad: number): Matrix => {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
};

/** `m · n`: n applies first, then m. */
export function compose(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export const apply = (m: Matrix, p: Point): Point => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

/** The rotation a matrix carries, in degrees, in (-180, 180]. */
export function matrixRotationDeg(m: Matrix): number {
  const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  return deg <= -180 + 1e-9 ? 180 : deg;
}

export const matrixScale = (m: Matrix): Point => ({
  x: Math.hypot(m.a, m.b),
  y: Math.hypot(m.c, m.d),
});

export type ParsedTransform = { matrix: Matrix; unknown: string[] };

const FUNCTION = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
const ANGLE = /^(-?[\d.]+(?:e-?\d+)?)(deg|rad|turn|grad)?$/i;

function angleRad(raw: string | undefined): number | null {
  const m = ANGLE.exec((raw ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  switch ((m[2] ?? 'deg').toLowerCase()) {
    case 'rad':
      return n;
    case 'turn':
      return n * 2 * Math.PI;
    case 'grad':
      return (n * Math.PI) / 200;
    default:
      return (n * Math.PI) / 180;
  }
}

// A length in px (the unit Whiteboard writes) or unitless (SVG).
function length(raw: string | undefined): number | null {
  const text = (raw ?? '').trim().replace(/px$/i, '');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function functionMatrix(name: string, args: string[], svg: boolean): Matrix | null {
  const nums = args.map(length);
  switch (name) {
    case 'matrix':
      if (nums.length !== 6 || nums.some((n) => n === null)) return null;
      return { a: nums[0]!, b: nums[1]!, c: nums[2]!, d: nums[3]!, e: nums[4]!, f: nums[5]! };
    case 'translate': {
      const [x, y = 0] = nums;
      return x === null || x === undefined || y === null ? null : translate(x, y);
    }
    case 'translateX':
      return nums[0] == null ? null : translate(nums[0], 0);
    case 'translateY':
      return nums[0] == null ? null : translate(0, nums[0]);
    case 'scale': {
      const [x, y = x] = nums;
      return x == null || y == null ? null : scale(x, y);
    }
    case 'scaleX':
      return nums[0] == null ? null : scale(nums[0], 1);
    case 'scaleY':
      return nums[0] == null ? null : scale(1, nums[0]);
    case 'rotate': {
      // SVG angles are unitless degrees and may carry a centre.
      const rad = angleRad(args[0]);
      if (rad === null) return null;
      if (svg && nums.length === 3 && nums[1] != null && nums[2] != null) {
        const [cx, cy] = [nums[1], nums[2]];
        return compose(translate(cx, cy), compose(rotate(rad), translate(-cx, -cy)));
      }
      return rotate(rad);
    }
    default:
      return null;
  }
}

function parseTransform(text: string, svg: boolean): ParsedTransform {
  let matrix = IDENTITY;
  const unknown: string[] = [];
  for (const m of text.matchAll(FUNCTION)) {
    const name = m[1]!;
    const args = m[2]!.split(svg ? /[\s,]+/ : /\s*,\s*/).filter((a) => a.trim() !== '');
    const next = functionMatrix(name, args, svg);
    if (next) matrix = compose(matrix, next);
    else unknown.push(name);
  }
  return { matrix, unknown };
}

/** A CSS `transform` value, functions composed left to right. */
export const parseCssTransform = (text: string): ParsedTransform => parseTransform(text, false);

/** An SVG `transform` attribute (space or comma separated, unitless angles). */
export const parseSvgTransform = (text: string): ParsedTransform => parseTransform(text, true);
