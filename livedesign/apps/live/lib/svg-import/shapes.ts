// SVG's basic shapes as contours (docs/specs/020-import-export/svg-import.md "Geometry"): rect (rounded too),
// circle, ellipse, line, polyline and polygon, each drawn the way the SVG spec defines it in path terms, curves
// through arcToCubics so they meet the same precision as an `A` command.
import { arcToCubics } from './arc';
import { lineTo, type Contour, type Pt, type Segment } from './geometry';
import { NumberScanner, numberList } from './number-scan';

/** The viewport lengths a percentage resolves against: its width, height and normalised diagonal. */
export type Viewport = { width: number; height: number };

type Axis = 'x' | 'y' | 'd';

/** A length attribute in user units: a number with an optional unit (px, pt, pc, mm, cm, in, %), else `fallback`. */
export function parseLength(raw: string | null, axis: Axis, vp: Viewport, fallback = 0): number {
  if (raw === null) return fallback;
  const scan = new NumberScanner(raw.trim());
  const v = scan.number();
  if (v === null) return fallback;
  let unit = '';
  while (!scan.done && unit.length < 3) unit += scan.take();
  switch (unit.toLowerCase()) {
    case '':
    case 'px':
      return v;
    case 'pt':
      return (v * 4) / 3;
    case 'pc':
      return v * 16;
    case 'mm':
      return (v * 96) / 25.4;
    case 'cm':
      return (v * 96) / 2.54;
    case 'in':
      return v * 96;
    case '%': {
      const base =
        axis === 'x'
          ? vp.width
          : axis === 'y'
            ? vp.height
            : Math.hypot(vp.width, vp.height) / Math.SQRT2;
      return (v / 100) * base;
    }
  }
  return fallback;
}

type Attr = (name: string) => string | null;

// A closed contour through arcs that turn through the four corners (an ellipse when the straight runs are empty).
function roundedContour(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
  px: number,
): Contour {
  const segs: Segment[] = [];
  let pen: Pt = { x: x + rx, y };
  const start = pen;
  const line = (to: Pt) => {
    if (to.x !== pen.x || to.y !== pen.y) segs.push(lineTo(pen, to));
    pen = to;
  };
  const arc = (to: Pt) => {
    for (const s of arcToCubics(pen, rx, ry, 0, false, true, to, px)) segs.push(s);
    pen = to;
  };
  line({ x: x + w - rx, y });
  arc({ x: x + w, y: y + ry });
  line({ x: x + w, y: y + h - ry });
  arc({ x: x + w - rx, y: y + h });
  line({ x: x + rx, y: y + h });
  arc({ x, y: y + h - ry });
  line({ x, y: y + ry });
  arc(start);
  return { start, segments: segs, closed: true };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, px: number): Contour[] {
  if (!(rx > 0) || !(ry > 0)) return [];
  return [roundedContour(cx - rx, cy - ry, rx * 2, ry * 2, rx, ry, px)];
}

function poly(raw: string | null, closed: boolean): Contour[] {
  const n = numberList(raw ?? '');
  // An odd count drops the last number, as the spec asks.
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push({ x: n[i]!, y: n[i + 1]! });
  if (pts.length < 2) return [];
  const segs: Segment[] = [];
  for (let i = 1; i < pts.length; i++) segs.push(lineTo(pts[i - 1]!, pts[i]!));
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (closed && (first.x !== last.x || first.y !== last.y)) segs.push(lineTo(last, first));
  return [{ start: first, segments: segs, closed }];
}

/** The contours of a basic shape (`tag` in lower case), or null when `tag` is not one. `px` is landed px per unit. */
export function shapeContours(tag: string, attr: Attr, vp: Viewport, px: number): Contour[] | null {
  const len = (name: string, axis: Axis) => parseLength(attr(name), axis, vp);
  switch (tag) {
    case 'rect': {
      const x = len('x', 'x');
      const y = len('y', 'y');
      const w = len('width', 'x');
      const h = len('height', 'y');
      if (!(w > 0) || !(h > 0)) return [];
      // A missing or `auto` radius takes the other's value (SVG 2).
      const rxRaw = attr('rx');
      const ryRaw = attr('ry');
      let rx = rxRaw === null || rxRaw === 'auto' ? NaN : len('rx', 'x');
      let ry = ryRaw === null || ryRaw === 'auto' ? NaN : len('ry', 'y');
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(0, rx), w / 2);
      ry = Math.min(Math.max(0, ry), h / 2);
      if (rx === 0 || ry === 0) {
        const p = (px0: number, py: number): Pt => ({ x: px0, y: py });
        const corners = [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)];
        const segs = corners.map((c, i) => lineTo(c, corners[(i + 1) % 4]!));
        return [{ start: corners[0]!, segments: segs, closed: true }];
      }
      return [roundedContour(x, y, w, h, rx, ry, px)];
    }
    case 'circle': {
      const r = len('r', 'd');
      return ellipse(len('cx', 'x'), len('cy', 'y'), r, r, px);
    }
    case 'ellipse': {
      const rx = len('rx', 'x');
      const ry = len('ry', 'y');
      return ellipse(len('cx', 'x'), len('cy', 'y'), rx, ry, px);
    }
    case 'line': {
      const from = { x: len('x1', 'x'), y: len('y1', 'y') };
      const to = { x: len('x2', 'x'), y: len('y2', 'y') };
      if (from.x === to.x && from.y === to.y) return [];
      return [{ start: from, segments: [lineTo(from, to)], closed: false }];
    }
    case 'polyline':
      return poly(attr('points'), false);
    case 'polygon':
      return poly(attr('points'), true);
  }
  return null;
}
