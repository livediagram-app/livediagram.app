// SVG's coordinate systems as matrices (liveworkspace/docs/specs/013-export/vector-pdf.md "Shapes and lines"): the `transform` attribute's
// list, read by a left-to-right scanner, and a viewport's viewBox with its preserveAspectRatio (a nested <svg>, an
// <image>'s picture).
import { IDENTITY, multiply, type Matrix } from './matrix';

const DEG = Math.PI / 180;

function fnMatrix(name: string, a: number[]): Matrix | null {
  switch (name) {
    case 'matrix':
      return a.length === 6 ? [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!] : null;
    case 'translate':
      return a.length >= 1 ? [1, 0, 0, 1, a[0]!, a[1] ?? 0] : null;
    case 'scale':
      return a.length >= 1 ? [a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0] : null;
    case 'rotate': {
      if (a.length < 1) return null;
      const r = a[0]! * DEG;
      const rot: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      if (a.length < 3) return rot;
      const [cx, cy] = [a[1]!, a[2]!];
      return multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
    }
    case 'skewx':
      return a.length >= 1 ? [1, 0, Math.tan(a[0]! * DEG), 1, 0, 0] : null;
    case 'skewy':
      return a.length >= 1 ? [1, Math.tan(a[0]! * DEG), 0, 1, 0, 0] : null;
    default:
      return null;
  }
}

/** A `transform` attribute as one matrix; an unreadable list is the identity, as a browser ignores it. */
export function parseTransform(value: string | null): Matrix {
  if (!value) return IDENTITY;
  let m: Matrix = IDENTITY;
  let i = 0;
  const s = value;
  while (i < s.length) {
    const open = s.indexOf('(', i);
    if (open === -1) break;
    const close = s.indexOf(')', open);
    if (close === -1) return IDENTITY;
    const name = s.slice(i, open).replace(/[\s,]/g, '').toLowerCase();
    const args = s
      .slice(open + 1, close)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (args.some((n) => !Number.isFinite(n))) return IDENTITY;
    const f = fnMatrix(name, args);
    if (!f) return IDENTITY;
    m = multiply(m, f);
    i = close + 1;
  }
  return m;
}

export type Box = { x: number; y: number; w: number; h: number };

/** The matrix that fits `view` (a viewBox, or a picture's own size) into `port` as `par` (preserveAspectRatio) says,
 *  and whether the content can spill past the port (slice). */
export function viewBoxMatrix(view: Box, port: Box, par: string | null): Matrix {
  if (view.w <= 0 || view.h <= 0) return IDENTITY;
  const [align = 'xMidYMid', mode = 'meet'] = (par ?? '').trim().split(/\s+/).filter(Boolean);
  let sx = port.w / view.w;
  let sy = port.h / view.h;
  if (align !== 'none') {
    const s = mode === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
    sx = s;
    sy = s;
  }
  let tx = port.x - view.x * sx;
  let ty = port.y - view.y * sy;
  if (align !== 'none') {
    const freeX = port.w - view.w * sx;
    const freeY = port.h - view.h * sy;
    if (align.includes('xMid')) tx += freeX / 2;
    else if (align.includes('xMax')) tx += freeX;
    if (align.includes('YMid')) ty += freeY / 2;
    else if (align.includes('YMax')) ty += freeY;
  }
  return [sx, 0, 0, sy, tx, ty];
}

/** A viewBox attribute, or null when absent or unreadable. */
export function parseViewBox(value: string | null): Box | null {
  if (!value) return null;
  const n = value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[2]! <= 0 || n[3]! <= 0) return null;
  return { x: n[0]!, y: n[1]!, w: n[2]!, h: n[3]! };
}
