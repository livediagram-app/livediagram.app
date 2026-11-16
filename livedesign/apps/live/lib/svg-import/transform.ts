// The SVG `transform` attribute as one matrix (docs/specs/020-import-export/svg-import.md "Geometry"): matrix,
// translate, scale, rotate (about a point too), skewX and skewY, in a list applied left to right. Read by a
// left-to-right scan; a malformed list is ignored whole, as the browser ignores it.
import { IDENTITY, multiply, type Matrix } from './geometry';
import { NumberScanner } from './number-scan';

const rad = (deg: number) => (deg * Math.PI) / 180;

function one(name: string, a: number[]): Matrix | null {
  switch (name) {
    case 'matrix':
      return a.length === 6 ? [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!] : null;
    case 'translate':
      return a.length === 1 || a.length === 2 ? [1, 0, 0, 1, a[0]!, a[1] ?? 0] : null;
    case 'scale':
      return a.length === 1 || a.length === 2 ? [a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0] : null;
    case 'rotate': {
      if (a.length !== 1 && a.length !== 3) return null;
      const r = rad(a[0]!);
      const m: Matrix = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      if (a.length === 1) return m;
      const [cx, cy] = [a[1]!, a[2]!];
      return multiply(multiply([1, 0, 0, 1, cx, cy], m), [1, 0, 0, 1, -cx, -cy]);
    }
    case 'skewX':
      return a.length === 1 ? [1, 0, Math.tan(rad(a[0]!)), 1, 0, 0] : null;
    case 'skewY':
      return a.length === 1 ? [1, Math.tan(rad(a[0]!)), 0, 1, 0, 0] : null;
  }
  return null;
}

const isNameChar = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

/** The transform list as one matrix; the identity for an empty or unreadable one. */
export function parseTransform(s: string | null): Matrix {
  if (!s) return IDENTITY;
  const scan = new NumberScanner(s);
  let m: Matrix = IDENTITY;
  for (;;) {
    scan.skipSeparators();
    if (scan.done) break;
    let name = '';
    while (isNameChar(scan.peek()) && name.length < 16) name += scan.take();
    scan.skipSpaces();
    if (!name || scan.take() !== '(') return IDENTITY;
    const args: number[] = [];
    for (;;) {
      scan.skipSeparators();
      if (scan.peek() === ')' || scan.done) break;
      const n = scan.number();
      if (n === null || args.length >= 6) return IDENTITY;
      args.push(n);
    }
    if (scan.take() !== ')') return IDENTITY;
    const t = one(name, args);
    if (!t) return IDENTITY;
    m = multiply(m, t);
  }
  return m;
}
