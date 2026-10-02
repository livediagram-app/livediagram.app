// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// Where an edge meets a shape's outline: draw.io's perimeter functions, ported from jgraph/drawio
// v31.7.0 (mxgraph/src/view/mxPerimeter.js and js/grapheditor/Shapes.js; Apache-2.0). Each
// function names its source. `next` is the point the edge comes from; `orthogonal` asks for the
// projection that keeps the edge's end segment horizontal or vertical.

import { debugLog } from '@/lib/debug-log';
import {
  centreX,
  centreY,
  directedBounds,
  intersection,
  polygonPerimeterPoint,
  type Box,
  type Pt,
} from './geometry';
import { styleNumber, styleValue, type CellState } from './state';

export type Perimeter = (
  bounds: Box,
  vertex: CellState,
  next: Pt,
  orthogonal: boolean,
) => Pt | null;

/** mxPerimeter.RectanglePerimeter */
export const rectanglePerimeter: Perimeter = (bounds, _vertex, next, orthogonal) => {
  const cx = centreX(bounds);
  const cy = centreY(bounds);
  const alpha = Math.atan2(next.y - cy, next.x - cx);
  const p = { x: 0, y: 0 };
  const pi = Math.PI;
  const beta = pi / 2 - alpha;
  const t = Math.atan2(bounds.height, bounds.width);
  if (alpha < -pi + t || alpha > pi - t) {
    p.x = bounds.x;
    p.y = cy - (bounds.width * Math.tan(alpha)) / 2;
  } else if (alpha < -t) {
    p.y = bounds.y;
    p.x = cx - (bounds.height * Math.tan(beta)) / 2;
  } else if (alpha < t) {
    p.x = bounds.x + bounds.width;
    p.y = cy + (bounds.width * Math.tan(alpha)) / 2;
  } else {
    p.y = bounds.y + bounds.height;
    p.x = cx + (bounds.height * Math.tan(beta)) / 2;
  }
  if (orthogonal) {
    if (next.x >= bounds.x && next.x <= bounds.x + bounds.width) p.x = next.x;
    else if (next.y >= bounds.y && next.y <= bounds.y + bounds.height) p.y = next.y;
    if (next.x < bounds.x) p.x = bounds.x;
    else if (next.x > bounds.x + bounds.width) p.x = bounds.x + bounds.width;
    if (next.y < bounds.y) p.y = bounds.y;
    else if (next.y > bounds.y + bounds.height) p.y = bounds.y + bounds.height;
  }
  return p;
};

/** mxPerimeter.EllipsePerimeter */
export const ellipsePerimeter: Perimeter = (bounds, _vertex, next, orthogonal) => {
  const { x, y } = bounds;
  const a = bounds.width / 2;
  const b = bounds.height / 2;
  const cx = x + a;
  const cy = y + b;
  const px = next.x;
  const py = next.y;
  // parseInt: draw.io truncates the deltas towards zero.
  const dx = Math.trunc(px - cx);
  const dy = Math.trunc(py - cy);
  if (dx === 0 && dy !== 0) return { x: cx, y: cy + (b * dy) / Math.abs(dy) };
  if (dx === 0 && dy === 0) return { x: px, y: py };
  if (orthogonal) {
    if (py >= y && py <= y + bounds.height) {
      const ty = py - cy;
      let tx = Math.sqrt(a * a * (1 - (ty * ty) / (b * b))) || 0;
      if (px <= x) tx = -tx;
      return { x: cx + tx, y: py };
    }
    if (px >= x && px <= x + bounds.width) {
      const tx = px - cx;
      let ty = Math.sqrt(b * b * (1 - (tx * tx) / (a * a))) || 0;
      if (py <= y) ty = -ty;
      return { x: px, y: cy + ty };
    }
  }
  const d = dy / dx;
  const h = cy - d * cx;
  const e = a * a * d * d + b * b;
  const f = -2 * cx * e;
  const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
  const det = Math.sqrt(f * f - 4 * e * g);
  const xout1 = (-f + det) / (2 * e);
  const xout2 = (-f - det) / (2 * e);
  const yout1 = d * xout1 + h;
  const yout2 = d * xout2 + h;
  const dist1 = Math.hypot(xout1 - px, yout1 - py);
  const dist2 = Math.hypot(xout2 - px, yout2 - py);
  return dist1 < dist2 ? { x: xout1, y: yout1 } : { x: xout2, y: yout2 };
};

/** mxPerimeter.RhombusPerimeter */
export const rhombusPerimeter: Perimeter = (bounds, _vertex, next, orthogonal) => {
  const { x, y, width: w, height: h } = bounds;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const px = next.x;
  const py = next.y;
  if (cx === px) return cy > py ? { x: cx, y } : { x: cx, y: y + h };
  if (cy === py) return cx > px ? { x, y: cy } : { x: x + w, y: cy };
  let tx = cx;
  let ty = cy;
  if (orthogonal) {
    if (px >= x && px <= x + w) tx = px;
    else if (py >= y && py <= y + h) ty = py;
  }
  if (px < cx) {
    return py < cy
      ? intersection(px, py, tx, ty, cx, y, x, cy)
      : intersection(px, py, tx, ty, cx, y + h, x, cy);
  }
  return py < cy
    ? intersection(px, py, tx, ty, cx, y, x + w, cy)
    : intersection(px, py, tx, ty, cx, y + h, x + w, cy);
};

const directionOf = (vertex: CellState) => String(styleValue(vertex.style, 'direction') ?? 'east');

/** mxPerimeter.TrianglePerimeter */
export const trianglePerimeter: Perimeter = (bounds, vertex, next, orthogonal) => {
  const direction = styleValue(vertex.style, 'direction');
  const vertical = direction === 'north' || direction === 'south';
  const { x, y, width: w, height: h } = bounds;
  let cx = x + w / 2;
  let cy = y + h / 2;
  let start = { x, y };
  let corner = { x: x + w, y: cy };
  let end = { x, y: y + h };
  if (direction === 'north') {
    start = end;
    corner = { x: cx, y };
    end = { x: x + w, y: y + h };
  } else if (direction === 'south') {
    corner = { x: cx, y: y + h };
    end = { x: x + w, y };
  } else if (direction === 'west') {
    start = { x: x + w, y };
    corner = { x, y: cy };
    end = { x: x + w, y: y + h };
  }
  const dx = next.x - cx;
  const dy = next.y - cy;
  const alpha = vertical ? Math.atan2(dx, dy) : Math.atan2(dy, dx);
  const t = vertical ? Math.atan2(w, h) : Math.atan2(h, w);
  const base =
    direction === 'north' || direction === 'west'
      ? alpha > -t && alpha < t
      : alpha < -Math.PI + t || alpha > Math.PI - t;
  let result: Pt | null;
  if (base) {
    if (
      orthogonal &&
      ((vertical && next.x >= start.x && next.x <= end.x) ||
        (!vertical && next.y >= start.y && next.y <= end.y))
    ) {
      result = vertical ? { x: next.x, y: start.y } : { x: start.x, y: next.y };
    } else if (direction === 'north') {
      result = { x: x + w / 2 + (h * Math.tan(alpha)) / 2, y: y + h };
    } else if (direction === 'south') {
      result = { x: x + w / 2 - (h * Math.tan(alpha)) / 2, y };
    } else if (direction === 'west') {
      result = { x: x + w, y: y + h / 2 + (w * Math.tan(alpha)) / 2 };
    } else {
      result = { x, y: y + h / 2 - (w * Math.tan(alpha)) / 2 };
    }
  } else {
    if (orthogonal) {
      const pt = { x: cx, y: cy };
      if (next.y >= y && next.y <= y + h) {
        pt.x = vertical ? cx : direction === 'west' ? x + w : x;
        pt.y = next.y;
      } else if (next.x >= x && next.x <= x + w) {
        pt.x = next.x;
        pt.y = !vertical ? cy : direction === 'north' ? y + h : y;
      }
      cx = pt.x;
      cy = pt.y;
    }
    result =
      (vertical && next.x <= x + w / 2) || (!vertical && next.y <= y + h / 2)
        ? intersection(next.x, next.y, cx, cy, start.x, start.y, corner.x, corner.y)
        : intersection(next.x, next.y, cx, cy, corner.x, corner.y, end.x, end.y);
  }
  return result ?? { x: cx, y: cy };
};

// The shared tail of Shapes.js's polygon perimeters: from the centre, or from the centre slid
// onto `next`'s row or column when orthogonal, to the polygon.
function polygonPoint(bounds: Box, points: Pt[], next: Pt, orthogonal: boolean): Pt | null {
  const p1 = { x: centreX(bounds), y: centreY(bounds) };
  if (orthogonal) {
    if (next.x < bounds.x || next.x > bounds.x + bounds.width) p1.y = next.y;
    else p1.x = next.x;
  }
  return polygonPerimeterPoint(points, p1, next);
}

// A shape's `size` style as Shapes.js reads it: the fixed size in px when `fixedSize` is set,
// else a fraction of the box.
function shapeSize(vertex: CellState, fraction: number, fixedPx: number) {
  const fixed = String(styleValue(vertex.style, 'fixedSize') ?? '0') !== '0';
  return { fixed, size: styleNumber(vertex.style, 'size', fixed ? fixedPx : fraction) };
}

/** Shapes.js mxPerimeter.ParallelogramPerimeter */
export const parallelogramPerimeter: Perimeter = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = shapeSize(vertex, 0.2, 20);
  const { x, y, width: w, height: h } = bounds;
  const direction = directionOf(vertex);
  let points: Pt[];
  if (direction === 'north' || direction === 'south') {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [
      { x, y },
      { x: x + w, y: y + dy },
      { x: x + w, y: y + h },
      { x, y: y + h - dy },
      { x, y },
    ];
  } else {
    const dx = fixed ? Math.max(0, Math.min(w * 0.5, size)) : w * Math.max(0, Math.min(1, size));
    points = [
      { x: x + dx, y },
      { x: x + w, y },
      { x: x + w - dx, y: y + h },
      { x, y: y + h },
      { x: x + dx, y },
    ];
  }
  return polygonPoint(bounds, points, next, orthogonal);
};

/** Shapes.js mxPerimeter.TrapezoidPerimeter */
export const trapezoidPerimeter: Perimeter = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = shapeSize(vertex, 0.2, 20);
  const { x, y, width: w, height: h } = bounds;
  const direction = directionOf(vertex);
  const along = (len: number, cap: number) =>
    fixed ? Math.max(0, Math.min(cap, size)) : len * Math.max(0, Math.min(1, size));
  let points: Pt[];
  if (direction === 'east') {
    const dx = along(w, w * 0.5);
    points = [
      { x: x + dx, y },
      { x: x + w - dx, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
      { x: x + dx, y },
    ];
  } else if (direction === 'west') {
    const dx = along(w, w);
    points = [
      { x, y },
      { x: x + w, y },
      { x: x + w - dx, y: y + h },
      { x: x + dx, y: y + h },
      { x, y },
    ];
  } else if (direction === 'north') {
    const dy = along(h, h);
    points = [
      { x, y: y + dy },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h - dy },
      { x, y: y + dy },
    ];
  } else {
    const dy = along(h, h);
    points = [
      { x, y },
      { x: x + w, y: y + dy },
      { x: x + w, y: y + h - dy },
      { x, y: y + h },
      { x, y },
    ];
  }
  return polygonPoint(bounds, points, next, orthogonal);
};

/** Shapes.js mxPerimeter.StepPerimeter */
export const stepPerimeter: Perimeter = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = shapeSize(vertex, 0.2, 20);
  const { x, y, width: w, height: h } = bounds;
  const cx = centreX(bounds);
  const cy = centreY(bounds);
  const direction = directionOf(vertex);
  const along = (len: number) =>
    fixed ? Math.max(0, Math.min(len, size)) : len * Math.max(0, Math.min(1, size));
  let points: Pt[];
  if (direction === 'east') {
    const dx = along(w);
    points = [
      { x, y },
      { x: x + w - dx, y },
      { x: x + w, y: cy },
      { x: x + w - dx, y: y + h },
      { x, y: y + h },
      { x: x + dx, y: cy },
      { x, y },
    ];
  } else if (direction === 'west') {
    const dx = along(w);
    points = [
      { x: x + dx, y },
      { x: x + w, y },
      { x: x + w - dx, y: cy },
      { x: x + w, y: y + h },
      { x: x + dx, y: y + h },
      { x, y: cy },
      { x: x + dx, y },
    ];
  } else if (direction === 'north') {
    const dy = along(h);
    points = [
      { x, y: y + dy },
      { x: cx, y },
      { x: x + w, y: y + dy },
      { x: x + w, y: y + h },
      { x: cx, y: y + h - dy },
      { x, y: y + h },
      { x, y: y + dy },
    ];
  } else {
    const dy = along(h);
    points = [
      { x, y },
      { x: cx, y: y + dy },
      { x: x + w, y },
      { x: x + w, y: y + h - dy },
      { x: cx, y: y + h },
      { x, y: y + h - dy },
      { x, y },
    ];
  }
  return polygonPoint(bounds, points, next, orthogonal);
};

/** Shapes.js mxPerimeter.HexagonPerimeter2 */
export const hexagonPerimeter2: Perimeter = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = shapeSize(vertex, 0.25, 20);
  const { x, y, width: w, height: h } = bounds;
  const cx = centreX(bounds);
  const cy = centreY(bounds);
  const direction = directionOf(vertex);
  const along = (len: number) =>
    fixed ? Math.max(0, Math.min(len, size)) : len * Math.max(0, Math.min(1, size));
  let points: Pt[];
  if (direction === 'north' || direction === 'south') {
    const dy = along(h);
    points = [
      { x: cx, y },
      { x: x + w, y: y + dy },
      { x: x + w, y: y + h - dy },
      { x: cx, y: y + h },
      { x, y: y + h - dy },
      { x, y: y + dy },
      { x: cx, y },
    ];
  } else {
    const dx = along(w);
    points = [
      { x: x + dx, y },
      { x: x + w - dx, y },
      { x: x + w, y: cy },
      { x: x + w - dx, y: y + h },
      { x: x + dx, y: y + h },
      { x, y: cy },
      { x: x + dx, y },
    ];
  }
  return polygonPoint(bounds, points, next, orthogonal);
};

/** Shapes.js mxPerimeter.CalloutPerimeter: the rectangle above the callout's pointer. */
export const calloutPerimeter: Perimeter = (bounds, vertex, next, orthogonal) => {
  const size = Math.max(0, Math.min(bounds.height, styleNumber(vertex.style, 'size', 30)));
  const inner = directedBounds(
    bounds,
    { x: 0, y: 0, width: 0, height: size },
    directionOf(vertex),
    String(styleValue(vertex.style, 'flipH') ?? '0') === '1',
    String(styleValue(vertex.style, 'flipV') ?? '0') === '1',
  );
  return rectanglePerimeter(inner, vertex, next, orthogonal);
};

/** Shapes.js mxPerimeter.CenterPerimeter */
export const centerPerimeter: Perimeter = (bounds) => ({ x: centreX(bounds), y: centreY(bounds) });

/** The registered perimeters by style name (mxStyleRegistry and Shapes.js). */
const PERIMETERS: Record<string, Perimeter> = {
  rectanglePerimeter,
  ellipsePerimeter,
  rhombusPerimeter,
  trianglePerimeter,
  parallelogramPerimeter,
  trapezoidPerimeter,
  stepPerimeter,
  hexagonPerimeter2,
  calloutPerimeter,
  centerPerimeter,
};

/** mxGraphView.getPerimeterFunction: the state's perimeter, null when its style names none. A
 *  perimeter not ported here (`lifelinePerimeter`, the older `hexagonPerimeter`, ...) reads as a
 *  rectangle, logged. */
export function perimeterOf(state: CellState): Perimeter | null {
  const name = styleValue(state.style, 'perimeter');
  if (typeof name !== 'string') return null;
  const found = PERIMETERS[name];
  if (found) return found;
  debugLog('[drawio-route] perimeter not ported, read as a rectangle', { perimeter: name });
  return rectanglePerimeter;
}
