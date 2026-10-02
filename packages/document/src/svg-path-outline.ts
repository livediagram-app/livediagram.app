// Outline polylines from drawn SVG paths: the cloud's bumps and the
// document's wavy edge for anchors (docs/specs/008-canvas/arrow-anchors.md
// "Anchor geometry"), and every drawn part of a shape for the whiteboard's
// outline hit (docs/specs/023-draw-mode/draw-mode.md "Selecting"). Only the
// absolute commands the shape-geometry table uses are read (M, L, C, A, Z);
// anything else returns null and the caller keeps the box.

import type { Point } from './geometry-primitives';

// Cubic curves are sampled at this many segments each.
export const PATH_CURVE_SEGMENTS = 12;
// Elliptical arcs likewise: under half a pixel of error on a quarter turn at 200 px.
export const PATH_ARC_SEGMENTS = 16;

export type SvgSubpath = { points: Point[]; closed: boolean };

const PARAMS: Record<string, number> = { M: 2, L: 2, C: 6, A: 7, Z: 0 };

// Points along an SVG arc from `from` to `to`, excluding `from` (SVG 1.1 F.6.5,
// endpoint to centre parameterisation, radii scaled up when too small).
function arcPoints(
  from: Point,
  rxIn: number,
  ryIn: number,
  degrees: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point,
  segments: number,
): Point[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y)) return [to];
  const phi = (degrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const out: Point[] = [];
  for (let s = 1; s <= segments; s++) {
    const t = start + (delta * s) / segments;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push(s === segments ? to : { x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
  return out;
}

/** The path's subpaths as polylines, each closed by a Z or left open, or null
 *  for a command outside M, L, C, A and Z. */
export function svgPathSubpaths(
  d: string,
  segmentsPerCurve = PATH_CURVE_SEGMENTS,
  segmentsPerArc = PATH_ARC_SEGMENTS,
): SvgSubpath[] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const subpaths: SvgSubpath[] = [];
  let current: SvgSubpath | null = null;
  let i = 0;
  let cmd = '';
  let cur: Point = { x: 0, y: 0 };
  const num = () => Number(tokens[i++]);
  const push = (p: Point) => {
    if (!current) {
      current = { points: [cur], closed: false };
      subpaths.push(current);
    }
    current.points.push(p);
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (!(cmd in PARAMS)) {
      console.warn(`[shape-outline] unsupported path command=${cmd}`);
      return null;
    }
    if (cmd === 'M') {
      cur = { x: num(), y: num() };
      current = { points: [cur], closed: false };
      subpaths.push(current);
      // Further pairs after a move are lines.
      cmd = 'L';
    } else if (cmd === 'L') {
      const p = { x: num(), y: num() };
      push(p);
      cur = p;
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const end = { x: num(), y: num() };
      const start = cur;
      for (let s = 1; s <= segmentsPerCurve; s++) {
        const t = s / segmentsPerCurve;
        const u = 1 - t;
        push({
          x: u * u * u * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
          y: u * u * u * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
        });
      }
      cur = end;
    } else if (cmd === 'A') {
      const [rx, ry, rot, large, sweep, ex, ey] = [num(), num(), num(), num(), num(), num(), num()];
      const end = { x: ex, y: ey };
      for (const p of arcPoints(cur, rx, ry, rot, large !== 0, sweep !== 0, end, segmentsPerArc)) {
        push(p);
      }
      cur = end;
    } else {
      // Z: numbers after it would be malformed.
      if (i < tokens.length && !/[a-zA-Z]/.test(tokens[i]!)) return null;
      const closing: SvgSubpath | null = current;
      if (closing) {
        closing.closed = true;
        cur = closing.points[0]!;
      }
      current = null;
    }
  }
  return subpaths;
}

/** The whole path as one point list (its subpaths run together), for a
 *  single-silhouette outline; null for an unsupported command. */
export function sampleSvgPath(
  d: string,
  segmentsPerCurve = PATH_CURVE_SEGMENTS,
  segmentsPerArc = PATH_ARC_SEGMENTS,
): Point[] | null {
  const subpaths = svgPathSubpaths(d, segmentsPerCurve, segmentsPerArc);
  return subpaths ? subpaths.flatMap((s) => s.points) : null;
}
