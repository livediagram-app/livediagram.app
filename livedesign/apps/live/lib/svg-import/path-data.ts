// SVG path data (`d`) as contours of cubic segments (docs/specs/020-import-export/svg-import.md "Geometry"). Read
// left to right by NumberScanner, one command at a time, never backtracking. Every command is supported (M L H V C
// S Q T A Z, absolute and relative); as the SVG spec asks, an error stops the parse and what came before it is kept.
import { arcToCubics } from './arc';
import { lineTo, type Contour, type Pt, type Segment } from './geometry';
import { NumberScanner } from './number-scan';

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

// A quadratic raised to the cubic that draws it exactly.
function quadratic(p0: Pt, q: Pt, p1: Pt): Segment {
  return {
    c1: { x: p0.x + ((q.x - p0.x) * 2) / 3, y: p0.y + ((q.y - p0.y) * 2) / 3 },
    c2: { x: p1.x + ((q.x - p1.x) * 2) / 3, y: p1.y + ((q.y - p1.y) * 2) / 3 },
    to: p1,
  };
}

// One command's arguments; null when the data ends or breaks before they are all there. An arc's flags are read as
// flags, so `a1 1 0 00 1 1` parses.
function readArgs(scan: NumberScanner, cmd: string): number[] | null {
  const n = ARGS[cmd]!;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    scan.skipSeparators();
    if (cmd === 'A' && (i === 3 || i === 4)) {
      const f = scan.flag();
      if (f === null) return null;
      out.push(f ? 1 : 0);
    } else {
      const v = scan.number();
      if (v === null) return null;
      out.push(v);
    }
  }
  return out;
}

/**
 * Parses path data into contours. `pxPerUnit` (landed px per unit) sets how finely arcs are split. A contour that
 * is only a move draws nothing and is left out.
 */
export function parsePathData(d: string, pxPerUnit = 1): Contour[] {
  const scan = new NumberScanner(d);
  const contours: Contour[] = [];
  let current: Contour | null = null;
  let pen: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  // The previous segment's second control point (for S) and quadratic control (for T).
  let lastCubic: Pt | null = null;
  let lastQuad: Pt | null = null;
  let cmd = '';
  let relative = false;

  const open = () => {
    if (!current) {
      current = { start: pen, segments: [], closed: false };
      contours.push(current);
    }
    return current;
  };

  for (;;) {
    scan.skipSpaces();
    if (scan.done) break;
    const ch = scan.peek();
    const upper = ch.toUpperCase();
    if (Object.hasOwn(ARGS, upper)) {
      scan.take();
      cmd = upper;
      relative = ch !== upper;
      if (cmd === 'Z') {
        if (current) {
          const c: Contour = current;
          if (pen.x !== start.x || pen.y !== start.y) c.segments.push(lineTo(pen, start));
          c.closed = true;
        }
        current = null;
        pen = start;
        lastCubic = null;
        lastQuad = null;
        continue;
      }
    } else if (!cmd || cmd === 'Z' || !scan.atNumber()) {
      // A number with no command before it, or a character that is neither: the data is broken here.
      break;
    }
    const a = readArgs(scan, cmd);
    if (!a) break;
    const at = (x: number, y: number): Pt => (relative ? { x: pen.x + x, y: pen.y + y } : { x, y });
    let seg: Segment | Segment[] | null = null;
    let nextCubic: Pt | null = null;
    let nextQuad: Pt | null = null;
    switch (cmd) {
      case 'M': {
        pen = at(a[0]!, a[1]!);
        start = pen;
        current = null;
        // Further pairs after a move are lines.
        cmd = 'L';
        break;
      }
      case 'L':
        seg = lineTo(pen, at(a[0]!, a[1]!));
        break;
      case 'H':
        seg = lineTo(pen, { x: relative ? pen.x + a[0]! : a[0]!, y: pen.y });
        break;
      case 'V':
        seg = lineTo(pen, { x: pen.x, y: relative ? pen.y + a[0]! : a[0]! });
        break;
      case 'C': {
        const s: Segment = { c1: at(a[0]!, a[1]!), c2: at(a[2]!, a[3]!), to: at(a[4]!, a[5]!) };
        seg = s;
        nextCubic = s.c2;
        break;
      }
      case 'S': {
        const c1: Pt = lastCubic ? { x: 2 * pen.x - lastCubic.x, y: 2 * pen.y - lastCubic.y } : pen;
        const s: Segment = { c1, c2: at(a[0]!, a[1]!), to: at(a[2]!, a[3]!) };
        seg = s;
        nextCubic = s.c2;
        break;
      }
      case 'Q': {
        const q = at(a[0]!, a[1]!);
        seg = quadratic(pen, q, at(a[2]!, a[3]!));
        nextQuad = q;
        break;
      }
      case 'T': {
        const q: Pt = lastQuad ? { x: 2 * pen.x - lastQuad.x, y: 2 * pen.y - lastQuad.y } : pen;
        seg = quadratic(pen, q, at(a[0]!, a[1]!));
        nextQuad = q;
        break;
      }
      case 'A':
        seg = arcToCubics(
          pen,
          a[0]!,
          a[1]!,
          a[2]!,
          a[3] === 1,
          a[4] === 1,
          at(a[5]!, a[6]!),
          pxPerUnit,
        );
        break;
    }
    if (seg) {
      const c = open();
      const segs = Array.isArray(seg) ? seg : [seg];
      for (const s of segs) c.segments.push(s);
      if (segs.length) pen = segs[segs.length - 1]!.to;
      else if (cmd === 'A') pen = at(a[5]!, a[6]!);
    }
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }
  return contours.filter((c) => c.segments.length > 0);
}
