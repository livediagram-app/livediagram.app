// Outline polygons from drawn SVG paths (docs/specs/008-canvas/arrow-anchors.md
// "Anchor geometry"): the cloud's bumps and the document's wavy edge are
// cubic curves in the shared shape-geometry table, sampled here so anchors
// sit on the line the user sees. Only the absolute commands those paths use
// are read; anything else returns null and the caller keeps the box.

import type { Point } from './geometry-primitives';

// Cubic curves are sampled at this many segments each.
export const PATH_CURVE_SEGMENTS = 12;

export function sampleSvgPath(d: string, segmentsPerCurve = PATH_CURVE_SEGMENTS): Point[] | null {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let i = 0;
  let cmd = '';
  let cur: Point = { x: 0, y: 0 };
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (cmd === 'M' || cmd === 'L') {
      cur = { x: num(), y: num() };
      points.push(cur);
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const end = { x: num(), y: num() };
      const start = cur;
      for (let s = 1; s <= segmentsPerCurve; s++) {
        const t = s / segmentsPerCurve;
        const u = 1 - t;
        points.push({
          x: u * u * u * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
          y: u * u * u * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
        });
      }
      cur = end;
    } else if (cmd === 'Z') {
      // The polygon closes itself; numbers after it would be malformed.
      if (i < tokens.length && !/[a-zA-Z]/.test(tokens[i]!)) return null;
    } else {
      console.warn(`[shape-outline] unsupported path command=${cmd}`);
      return null;
    }
  }
  return points;
}
