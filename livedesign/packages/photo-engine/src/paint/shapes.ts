// The Shape tools (docs/specs/031-photo/photo-tools.md "Shapes"): a rectangle (rounded or not), an
// ellipse or a line (with arrowheads) drawn into pixels, filled and stroked, anti-aliased by their
// coverage (a 4 x 4 grid a pixel).
import { createMask, type Mask8 } from '../raster/mask';
import type { Rect } from '../raster/raster';

type P = { x: number; y: number };
const SS = 4;

function coverageMask(
  bounds: Rect,
  inside: (x: number, y: number) => boolean,
  antiAlias: boolean,
): Mask8 {
  const r = {
    x: Math.floor(bounds.x),
    y: Math.floor(bounds.y),
    width: Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x),
    height: Math.ceil(bounds.y + bounds.height) - Math.floor(bounds.y),
  };
  const m = createMask(r);
  const sub = antiAlias ? SS : 1;
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      let hits = 0;
      for (let j = 0; j < sub; j++)
        for (let i = 0; i < sub; i++)
          if (inside(r.x + x + (i + 0.5) / sub, r.y + y + (j + 0.5) / sub)) hits++;
      m.data[y * r.width + x] = Math.round((hits / (sub * sub)) * 255);
    }
  return m;
}

function roundedRectInside(x0: number, y0: number, x1: number, y1: number, radius: number) {
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  return (x: number, y: number) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
}

export type ShapeMasks = { fill: Mask8 | null; stroke: Mask8 | null };

/** A rectangle from `a` to `b`: its fill and its stroke (centred on the edge) as masks. */
export function rectangleMasks(
  a: P,
  b: P,
  { radius = 0, strokeWidth = 0, antiAlias = true } = {},
): ShapeMasks {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return { fill: null, stroke: null };
  const fill = coverageMask(
    { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    roundedRectInside(x0, y0, x1, y1, radius),
    antiAlias,
  );
  if (strokeWidth <= 0) return { fill, stroke: null };
  const h = strokeWidth / 2;
  const outer = roundedRectInside(x0 - h, y0 - h, x1 + h, y1 + h, radius + h);
  const inner = roundedRectInside(x0 + h, y0 + h, x1 - h, y1 - h, Math.max(0, radius - h));
  const stroke = coverageMask(
    { x: x0 - h, y: y0 - h, width: x1 - x0 + strokeWidth, height: y1 - y0 + strokeWidth },
    (x, y) => outer(x, y) && !(x1 - x0 > strokeWidth && y1 - y0 > strokeWidth && inner(x, y)),
    antiAlias,
  );
  return { fill, stroke };
}

/** An ellipse in the box from `a` to `b`. */
export function ellipseMasks(a: P, b: P, { strokeWidth = 0, antiAlias = true } = {}): ShapeMasks {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx < 0.25 || ry < 0.25) return { fill: null, stroke: null };
  const cx = x0 + rx;
  const cy = y0 + ry;
  const inEllipse = (erx: number, ery: number) => (x: number, y: number) =>
    erx > 0 && ery > 0 && ((x - cx) / erx) ** 2 + ((y - cy) / ery) ** 2 <= 1;
  const fill = coverageMask(
    { x: x0, y: y0, width: rx * 2, height: ry * 2 },
    inEllipse(rx, ry),
    antiAlias,
  );
  if (strokeWidth <= 0) return { fill, stroke: null };
  const h = strokeWidth / 2;
  const outer = inEllipse(rx + h, ry + h);
  const inner = inEllipse(rx - h, ry - h);
  const stroke = coverageMask(
    { x: cx - rx - h, y: cy - ry - h, width: (rx + h) * 2, height: (ry + h) * 2 },
    (x, y) => outer(x, y) && !inner(x, y),
    antiAlias,
  );
  return { fill, stroke };
}

function distToSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function inTriangle(p: P, a: P, b: P, c: P): boolean {
  const s = (q: P, r: P, t: P) => (q.x - t.x) * (r.y - t.y) - (r.x - t.x) * (q.y - t.y);
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** A line from `a` to `b` of `width`, with arrowheads (three times the width, twice as long). */
export function lineMask(
  a: P,
  b: P,
  { width = 4, startArrow = false, endArrow = false, antiAlias = true } = {},
): Mask8 | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.5) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const head = width * 3;
  const heads: [P, P, P][] = [];
  let s = a;
  let e = b;
  const arrow = (tip: P, dir: number): [P, P, P] => {
    const back = { x: tip.x - ux * head * 2 * dir, y: tip.y - uy * head * 2 * dir };
    return [
      tip,
      { x: back.x - uy * head, y: back.y + ux * head },
      { x: back.x + uy * head, y: back.y - ux * head },
    ];
  };
  if (endArrow) {
    heads.push(arrow(b, 1));
    e = { x: b.x - ux * head * 1.5, y: b.y - uy * head * 1.5 };
  }
  if (startArrow) {
    heads.push(arrow(a, -1));
    s = { x: a.x + ux * head * 1.5, y: a.y + uy * head * 1.5 };
  }
  const pad = Math.max(width, head) + 1;
  const bounds = {
    x: Math.min(a.x, b.x) - pad,
    y: Math.min(a.y, b.y) - pad,
    width: Math.abs(b.x - a.x) + pad * 2,
    height: Math.abs(b.y - a.y) + pad * 2,
  };
  return coverageMask(
    bounds,
    (x, y) =>
      distToSegment({ x, y }, s, e) <= width / 2 || heads.some((t) => inTriangle({ x, y }, ...t)),
    antiAlias,
  );
}
