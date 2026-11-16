// SVG path data as PDF path construction operators (liveworkspace/docs/specs/013-export/vector-pdf.md "Shapes and lines"): every command,
// relative or absolute, smooth or not, becomes moveto, lineto, cubic curveto or closepath; quadratics are raised to
// cubics and elliptical arcs split into cubics of at most a quarter turn. Read by a left-to-right scanner, never a
// backtracking regex, so a long or hostile path costs linear time.
import { num } from './matrix';

const isDigit = (c: number) => c >= 48 && c <= 57;

/** Scans path data into command letters and numbers. Arc flags may be written without separators ("a1 1 0 01 1 1"),
 *  so the caller asks for a flag where one is due. */
class Scanner {
  i = 0;
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  private skip(): void {
    const s = this.s;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      // Space, tab, newlines, form feed, comma.
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 44) this.i++;
      else break;
    }
  }

  /** The next command letter, or null at a number or the end. */
  command(): string | null {
    this.skip();
    const c = this.s[this.i];
    if (c && /[MmLlHhVvCcSsQqTtAaZz]/.test(c)) {
      this.i++;
      return c;
    }
    return null;
  }

  atNumber(): boolean {
    this.skip();
    const c = this.s.charCodeAt(this.i);
    return isDigit(c) || c === 45 || c === 43 || c === 46;
  }

  number(): number {
    this.skip();
    const s = this.s;
    const start = this.i;
    let i = this.i;
    if (s[i] === '+' || s[i] === '-') i++;
    let digits = 0;
    while (isDigit(s.charCodeAt(i))) {
      i++;
      digits++;
    }
    if (s[i] === '.') {
      i++;
      while (isDigit(s.charCodeAt(i))) {
        i++;
        digits++;
      }
    }
    if (digits === 0) throw new Error(`path: number expected at ${start}`);
    if (s[i] === 'e' || s[i] === 'E') {
      let j = i + 1;
      if (s[j] === '+' || s[j] === '-') j++;
      if (isDigit(s.charCodeAt(j))) {
        while (isDigit(s.charCodeAt(j))) j++;
        i = j;
      }
    }
    this.i = i;
    return Number(s.slice(start, i));
  }

  flag(): number {
    this.skip();
    const c = this.s[this.i];
    if (c !== '0' && c !== '1') throw new Error(`path: flag expected at ${this.i}`);
    this.i++;
    return c === '1' ? 1 : 0;
  }
}

/** A path in absolute segments: what the PDF operators and the outline's bounds are made from. */
export type Segment =
  | { k: 'M' | 'L'; x: number; y: number }
  | { k: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { k: 'Z' };

// An elliptical arc (SVG 1.1 F.6.5, endpoint to centre) as cubic segments.
function arcToCubics(
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  angle: number,
  large: number,
  sweep: number,
  x: number,
  y: number,
): Segment[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (x0 === x && y0 === y)) {
    return x0 === x && y0 === y ? [] : [{ k: 'L', x, y }];
  }
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): [number, number] => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  };
  const deriv = (t: number): [number, number] => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out: Segment[] = [];
  for (let n = 0; n < parts; n++) {
    const t1 = theta1 + n * step;
    const t2 = t1 + step;
    const [px1, py1] = point(t1);
    const [px2, py2] = point(t2);
    const [d1x, d1y] = deriv(t1);
    const [d2x, d2y] = deriv(t2);
    const last = n === parts - 1;
    out.push({
      k: 'C',
      x1: px1 + k * d1x,
      y1: py1 + k * d1y,
      x2: px2 - k * d2x,
      y2: py2 - k * d2y,
      x: last ? x : px2,
      y: last ? y : py2,
    });
  }
  return out;
}

/** Path data as absolute segments. Malformed data stops where it goes wrong, as a browser draws it. */
export function parsePath(d: string): Segment[] {
  const sc = new Scanner(d);
  const out: Segment[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // The last control point, for S and T, and which kind of curve set it.
  let cx = 0;
  let cy = 0;
  let prev = '';
  try {
    let cmd = sc.command();
    // Path data must open with a moveto; a browser draws nothing of one that doesn't.
    if (cmd !== 'M' && cmd !== 'm') return out;
    while (cmd) {
      const rel = cmd === cmd.toLowerCase();
      const up = cmd.toUpperCase();
      let first = true;
      do {
        const ox = rel ? x : 0;
        const oy = rel ? y : 0;
        if (up === 'M') {
          x = ox + sc.number();
          y = oy + sc.number();
          // Pairs after a moveto are linetos.
          out.push({ k: first ? 'M' : 'L', x, y });
          if (first) {
            startX = x;
            startY = y;
          }
          prev = 'L';
        } else if (up === 'L') {
          x = ox + sc.number();
          y = oy + sc.number();
          out.push({ k: 'L', x, y });
          prev = 'L';
        } else if (up === 'H') {
          x = ox + sc.number();
          out.push({ k: 'L', x, y });
          prev = 'L';
        } else if (up === 'V') {
          y = oy + sc.number();
          out.push({ k: 'L', x, y });
          prev = 'L';
        } else if (up === 'C' || up === 'S') {
          let x1: number;
          let y1: number;
          if (up === 'C') {
            x1 = ox + sc.number();
            y1 = oy + sc.number();
          } else {
            x1 = prev === 'C' ? 2 * x - cx : x;
            y1 = prev === 'C' ? 2 * y - cy : y;
          }
          const x2 = ox + sc.number();
          const y2 = oy + sc.number();
          x = ox + sc.number();
          y = oy + sc.number();
          out.push({ k: 'C', x1, y1, x2, y2, x, y });
          cx = x2;
          cy = y2;
          prev = 'C';
        } else if (up === 'Q' || up === 'T') {
          let qx: number;
          let qy: number;
          if (up === 'Q') {
            qx = ox + sc.number();
            qy = oy + sc.number();
          } else {
            qx = prev === 'Q' ? 2 * x - cx : x;
            qy = prev === 'Q' ? 2 * y - cy : y;
          }
          const nx = ox + sc.number();
          const ny = oy + sc.number();
          out.push({
            k: 'C',
            x1: x + (2 / 3) * (qx - x),
            y1: y + (2 / 3) * (qy - y),
            x2: nx + (2 / 3) * (qx - nx),
            y2: ny + (2 / 3) * (qy - ny),
            x: nx,
            y: ny,
          });
          x = nx;
          y = ny;
          cx = qx;
          cy = qy;
          prev = 'Q';
        } else if (up === 'A') {
          const rx = sc.number();
          const ry = sc.number();
          const rot = sc.number();
          const large = sc.flag();
          const sweep = sc.flag();
          const nx = ox + sc.number();
          const ny = oy + sc.number();
          out.push(...arcToCubics(x, y, rx, ry, rot, large, sweep, nx, ny));
          x = nx;
          y = ny;
          prev = 'L';
        } else {
          out.push({ k: 'Z' });
          x = startX;
          y = startY;
          prev = 'L';
          break;
        }
        first = false;
      } while (sc.atNumber());
      cmd = sc.command();
    }
  } catch {
    // Keep what was drawn before the error.
  }
  return out;
}

/** Segments as PDF path operators. */
export function segmentsToPdf(segments: readonly Segment[]): string {
  const out: string[] = [];
  for (const s of segments) {
    if (s.k === 'M') out.push(`${num(s.x)} ${num(s.y)} m`);
    else if (s.k === 'L') out.push(`${num(s.x)} ${num(s.y)} l`);
    else if (s.k === 'C')
      out.push(`${num(s.x1)} ${num(s.y1)} ${num(s.x2)} ${num(s.y2)} ${num(s.x)} ${num(s.y)} c`);
    else out.push('h');
  }
  return out.join('\n');
}

/** Path data straight to PDF operators. */
export const pathToPdf = (d: string): string => segmentsToPdf(parsePath(d));
