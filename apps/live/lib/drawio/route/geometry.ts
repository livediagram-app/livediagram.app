// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// The geometry helpers draw.io's view leans on, ported from jgraph/drawio v31.7.0
// (mxgraph/src/util/mxUtils.js, mxConstants.js; Apache-2.0). Each function names its source.
// Units are draw.io's own: the view at scale 1, translate 0.

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

// mxConstants.DIRECTION_MASK_*
export const MASK_NONE = 0;
export const MASK_WEST = 1;
export const MASK_NORTH = 2;
export const MASK_SOUTH = 4;
export const MASK_EAST = 8;
export const MASK_ALL = 15;

export const centreX = (b: Box) => b.x + b.width / 2;
export const centreY = (b: Box) => b.y + b.height / 2;

/** mxUtils.toRadians */
export const toRadians = (deg: number) => (Math.PI * deg) / 180;

/** mxUtils.contains */
export const contains = (b: Box, x: number, y: number): boolean =>
  b.x <= x && b.x + b.width >= x && b.y <= y && b.y + b.height >= y;

/** mxUtils.getRotatedPoint */
export function rotatedPoint(pt: Pt, cos: number, sin: number, c: Pt = { x: 0, y: 0 }): Pt {
  const x = pt.x - c.x;
  const y = pt.y - c.y;
  return { x: x * cos - y * sin + c.x, y: y * cos + x * sin + c.y };
}

/** mxUtils.getBoundingBox: the box around `rect` turned by `rotation` degrees about its centre. */
export function rotatedBounds(rect: Box, rotation: number): Box {
  const rad = toRadians(rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const c = { x: centreX(rect), y: centreY(rect) };
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((p) => rotatedPoint(p, cos, sin, c));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** mxUtils.intersection: where segment 0-1 meets segment 2-3, or null. */
export function intersection(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): Pt | null {
  const denom = (y3 - y2) * (x1 - x0) - (x3 - x2) * (y1 - y0);
  const ua = ((x3 - x2) * (y0 - y2) - (y3 - y2) * (x0 - x2)) / denom;
  const ub = ((x1 - x0) * (y0 - y2) - (y1 - y0) * (x0 - x2)) / denom;
  const eps = 0.000001;
  if (ua >= -eps && ua <= 1 + eps && ub >= -eps && ub <= 1 + eps) {
    return { x: x0 + ua * (x1 - x0), y: y0 + ua * (y1 - y0) };
  }
  return null;
}

/** mxUtils.getPerimeterPoint: the polygon point nearest `point` on the line from `center`. */
export function polygonPerimeterPoint(pts: Pt[], center: Pt, point: Pt): Pt | null {
  let min: { p: Pt; distSq: number } | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const pt = intersection(a.x, a.y, b.x, b.y, center.x, center.y, point.x, point.y);
    if (pt) {
      const distSq = (point.y - pt.y) ** 2 + (point.x - pt.x) ** 2;
      if (!min || min.distSq > distSq) min = { p: pt, distSq };
    }
  }
  return min ? min.p : null;
}

/** mxUtils.ptSegDistSq */
export function ptSegDistSq(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  px: number,
  py: number,
): number {
  x2 -= x1;
  y2 -= y1;
  px -= x1;
  py -= y1;
  let dotprod = px * x2 + py * y2;
  let projlenSq: number;
  if (dotprod <= 0) {
    projlenSq = 0;
  } else {
    px = x2 - px;
    py = y2 - py;
    dotprod = px * x2 + py * y2;
    projlenSq = dotprod <= 0 ? 0 : (dotprod * dotprod) / (x2 * x2 + y2 * y2);
  }
  return Math.max(0, px * px + py * py - projlenSq);
}

/** mxUtils.relativeCcw */
export function relativeCcw(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  px: number,
  py: number,
): -1 | 0 | 1 {
  x2 -= x1;
  y2 -= y1;
  px -= x1;
  py -= y1;
  let ccw = px * y2 - py * x2;
  if (ccw === 0) {
    ccw = px * x2 + py * y2;
    if (ccw > 0) {
      px -= x2;
      py -= y2;
      ccw = Math.max(0, px * x2 + py * y2);
    }
  }
  return ccw < 0 ? -1 : ccw > 0 ? 1 : 0;
}

/** mxUtils.reversePortConstraints */
export function reversePortConstraints(constraint: number): number {
  let result = (constraint & MASK_WEST) << 3;
  result |= (constraint & MASK_NORTH) << 1;
  result |= (constraint & MASK_SOUTH) >> 1;
  result |= (constraint & MASK_EAST) >> 3;
  return result;
}

// The masks of north, west, south and east, each turned by a quarter `quad` times clockwise.
const TURNED: Record<string, readonly number[]> = {
  north: [MASK_NORTH, MASK_EAST, MASK_SOUTH, MASK_WEST],
  west: [MASK_WEST, MASK_NORTH, MASK_EAST, MASK_SOUTH],
  south: [MASK_SOUTH, MASK_WEST, MASK_NORTH, MASK_EAST],
  east: [MASK_EAST, MASK_SOUTH, MASK_WEST, MASK_NORTH],
};

/** mxUtils.getPortConstraints: `portConstraint` names as a direction mask, else `fallback`. */
export function portConstraints(
  value: string | number | undefined,
  rotation: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const directions = String(value);
  let quad = 0;
  if (rotation > 45) quad = rotation >= 135 ? 2 : 1;
  else if (rotation < -45) quad = rotation <= -135 ? 2 : 3;
  let out = MASK_NONE;
  for (const name of ['north', 'west', 'south', 'east']) {
    if (directions.includes(name)) out |= TURNED[name]![quad]!;
  }
  return out;
}

/** mxUtils.getDirectedBounds: `rect` inset by `m` (x left, y top, width right, height bottom)
 *  turned to the shape's direction. */
export function directedBounds(
  rect: Box,
  m: Box,
  direction: string,
  flipH: boolean,
  flipV: boolean,
): Box {
  const d = direction;
  let mx = Math.round(Math.max(0, Math.min(rect.width, m.x)));
  let my = Math.round(Math.max(0, Math.min(rect.height, m.y)));
  let mw = Math.round(Math.max(0, Math.min(rect.width, m.width)));
  let mh = Math.round(Math.max(0, Math.min(rect.height, m.height)));
  const vertical = d === 'south' || d === 'north';
  if ((flipV && vertical) || (flipH && !vertical)) [mx, mw] = [mw, mx];
  if ((flipH && vertical) || (flipV && !vertical)) [my, mh] = [mh, my];
  let m2 = { x: mx, y: my, width: mw, height: mh };
  if (d === 'south') m2 = { y: mx, x: mh, width: my, height: mw };
  else if (d === 'west') m2 = { y: mh, x: mw, width: mx, height: my };
  else if (d === 'north') m2 = { y: mw, x: my, width: mh, height: mx };
  return {
    x: rect.x + m2.x,
    y: rect.y + m2.y,
    width: rect.width - m2.width - m2.x,
    height: rect.height - m2.height - m2.y,
  };
}
