// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// draw.io's edge styles (routers), ported from jgraph/drawio v31.7.0
// (mxgraph/src/view/mxEdgeStyle.js; Apache-2.0). Each function names its source. A router reads
// the edge's fixed end points (`edge.absolutePoints`, null where an end floats), the terminals and
// the waypoints, and pushes the route's interior points onto `result`.

import type { DrawioStyle } from '../style';
import {
  MASK_NONE,
  MASK_WEST,
  MASK_EAST,
  contains,
  portConstraints,
  type Box,
  type Pt,
} from './geometry';
import { styleNumber, styleValue, type CellState } from './state';

/** A terminal as a router sees it; a router may stand a bare point in for one (no style). */
export type RouteBox = Box & { style?: DrawioStyle };

/** The edge being routed: its style, the origin its waypoints are relative to, and its end
 *  points so far (the first and last; null where an end floats). */
export type EdgeRouting = {
  style: DrawioStyle;
  origin: Pt;
  absolutePoints: (Pt | null)[];
  /** The page's grid size (Loop's default segment). */
  gridSize: number;
};

export type EdgeStyle = (
  edge: EdgeRouting,
  source: CellState | null,
  target: CellState | null,
  points: Pt[],
  result: (Pt | null)[],
) => void;

/** mxGraphView.transformControlPoint at scale 1. */
export const transformControlPoint = (edge: EdgeRouting, pt: Pt): Pt => ({
  x: pt.x + edge.origin.x,
  y: pt.y + edge.origin.y,
});

/** mxGraphView.getRoutingCenterX */
export const routingCenterX = (s: RouteBox): number =>
  s.x + s.width / 2 + (s.style ? styleNumber(s.style, 'routingCenterX') : 0) * s.width;

/** mxGraphView.getRoutingCenterY */
export const routingCenterY = (s: RouteBox): number =>
  s.y + s.height / 2 + (s.style ? styleNumber(s.style, 'routingCenterY') : 0) * s.height;

const pointBox = (p: Pt): RouteBox => ({ x: p.x, y: p.y, width: 0, height: 0 });

/** mxUtils.getPortConstraints for a terminal of `edge`. */
export function terminalPortConstraints(
  terminal: RouteBox,
  edge: EdgeRouting,
  source: boolean,
  fallback: number,
): number {
  const own = terminal.style ? styleValue(terminal.style, 'portConstraint') : undefined;
  const value =
    own ?? styleValue(edge.style, source ? 'sourcePortConstraint' : 'targetPortConstraint');
  const rotation =
    terminal.style && styleNumber(terminal.style, 'portConstraintRotation') === 1
      ? styleNumber(terminal.style, 'rotation')
      : 0;
  return portConstraints(value, rotation, fallback);
}

/** mxEdgeStyle.EntityRelation */
export const entityRelation: EdgeStyle = (edge, sourceState, targetState, _points, result) => {
  const segment = styleNumber(edge.style, 'segment', 30);
  const pts = edge.absolutePoints;
  const p0 = pts[0] ?? null;
  const pe = pts[pts.length - 1] ?? null;
  let source: RouteBox | null = sourceState;
  let target: RouteBox | null = targetState;

  let isSourceLeft = false;
  if (sourceState) {
    if (sourceState.relativeX !== null) {
      isSourceLeft = sourceState.relativeX <= 0.5;
    } else if (targetState) {
      isSourceLeft = (pe ? pe.x : targetState.x + targetState.width) < (p0 ? p0.x : sourceState.x);
    }
  }
  if (p0) {
    source = pointBox(p0);
  } else if (sourceState) {
    const constraint = terminalPortConstraints(sourceState, edge, true, MASK_NONE);
    if (constraint !== MASK_NONE && constraint !== MASK_WEST + MASK_EAST) {
      isSourceLeft = constraint === MASK_WEST;
    }
  } else {
    return;
  }

  let isTargetLeft = true;
  if (targetState) {
    if (targetState.relativeX !== null) {
      isTargetLeft = targetState.relativeX <= 0.5;
    } else if (sourceState) {
      isTargetLeft = (p0 ? p0.x : sourceState.x + sourceState.width) < (pe ? pe.x : targetState.x);
    }
  }
  if (pe) {
    target = pointBox(pe);
  } else if (targetState) {
    const constraint = terminalPortConstraints(targetState, edge, false, MASK_NONE);
    if (constraint !== MASK_NONE && constraint !== MASK_WEST + MASK_EAST) {
      isTargetLeft = constraint === MASK_WEST;
    }
  }

  if (source && target) {
    const x0 = isSourceLeft ? source.x : source.x + source.width;
    const y0 = routingCenterY(source);
    const xe = isTargetLeft ? target.x : target.x + target.width;
    const ye = routingCenterY(target);
    const dep = { x: x0 + (isSourceLeft ? -segment : segment), y: y0 };
    const arr = { x: xe + (isTargetLeft ? -segment : segment), y: ye };
    if (isSourceLeft === isTargetLeft) {
      const x = isSourceLeft ? Math.min(x0, xe) - segment : Math.max(x0, xe) + segment;
      result.push({ x, y: y0 }, { x, y: ye });
    } else if (dep.x < arr.x === isSourceLeft) {
      const midY = y0 + (ye - y0) / 2;
      result.push(dep, { x: dep.x, y: midY }, { x: arr.x, y: midY }, arr);
    } else {
      result.push(dep, arr);
    }
  }
};

/** mxEdgeStyle.Loop */
export const loop: EdgeStyle = (edge, source, _target, points, result) => {
  const pts = edge.absolutePoints;
  const p0 = pts[0] ?? null;
  const pe = pts[pts.length - 1] ?? null;
  if (p0 && pe) {
    for (const p of points) result.push(transformControlPoint(edge, p));
    return;
  }
  if (!source) return;
  let pt: Pt | null = points[0] ? transformControlPoint(edge, points[0]) : null;
  if (pt && contains(source, pt.x, pt.y)) pt = null;
  let x = 0;
  let dx = 0;
  let y = 0;
  let dy = 0;
  const seg = styleNumber(edge.style, 'segment', edge.gridSize);
  const dir = String(styleValue(edge.style, 'direction') ?? 'west');
  if (dir === 'north' || dir === 'south') {
    x = routingCenterX(source);
    dx = seg;
  } else {
    y = routingCenterY(source);
    dy = seg;
  }
  if (!pt || pt.x < source.x || pt.x > source.x + source.width) {
    if (pt) {
      x = pt.x;
      dy = Math.max(Math.abs(y - pt.y), dy);
    } else if (dir === 'north') {
      y = source.y - 2 * dx;
    } else if (dir === 'south') {
      y = source.y + source.height + 2 * dx;
    } else if (dir === 'east') {
      x = source.x - 2 * dy;
    } else {
      x = source.x + source.width + 2 * dy;
    }
  } else {
    x = routingCenterX(source);
    dx = Math.max(Math.abs(x - pt.x), dy);
    y = pt.y;
    dy = 0;
  }
  result.push({ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy });
};

/** mxEdgeStyle.SideToSide */
export const sideToSide: EdgeStyle = (edge, sourceState, targetState, points, result) => {
  const pts = edge.absolutePoints;
  const p0 = pts[0] ?? null;
  const pe = pts[pts.length - 1] ?? null;
  const pt = points[0] ? transformControlPoint(edge, points[0]) : null;
  const source: RouteBox | null = p0 ? pointBox(p0) : sourceState;
  const target: RouteBox | null = pe ? pointBox(pe) : targetState;
  if (!source || !target) return;
  const l = Math.max(source.x, target.x);
  const r = Math.min(source.x + source.width, target.x + target.width);
  const x = pt ? pt.x : Math.round(r + (l - r) / 2);
  let y1 = routingCenterY(source);
  let y2 = routingCenterY(target);
  if (pt) {
    if (pt.y >= source.y && pt.y <= source.y + source.height) y1 = pt.y;
    if (pt.y >= target.y && pt.y <= target.y + target.height) y2 = pt.y;
  }
  const clear = (px: number, py: number) => !contains(target, px, py) && !contains(source, px, py);
  if (clear(x, y1)) result.push({ x, y: y1 });
  if (clear(x, y2)) result.push({ x, y: y2 });
  if (result.length === 1) {
    if (pt) {
      if (clear(x, pt.y)) result.push({ x, y: pt.y });
    } else {
      const t = Math.max(source.y, target.y);
      const b = Math.min(source.y + source.height, target.y + target.height);
      result.push({ x, y: t + (b - t) / 2 });
    }
  }
};

/** mxEdgeStyle.TopToBottom */
export const topToBottom: EdgeStyle = (edge, sourceState, targetState, points, result) => {
  const pts = edge.absolutePoints;
  const p0 = pts[0] ?? null;
  const pe = pts[pts.length - 1] ?? null;
  const pt = points[0] ? transformControlPoint(edge, points[0]) : null;
  const source: RouteBox | null = p0 ? pointBox(p0) : sourceState;
  const target: RouteBox | null = pe ? pointBox(pe) : targetState;
  if (!source || !target) return;
  const t = Math.max(source.y, target.y);
  const b = Math.min(source.y + source.height, target.y + target.height);
  let x = routingCenterX(source);
  if (pt && pt.x >= source.x && pt.x <= source.x + source.width) x = pt.x;
  const y = pt ? pt.y : Math.round(b + (t - b) / 2);
  const clear = (px: number, py: number) => !contains(target, px, py) && !contains(source, px, py);
  if (clear(x, y)) result.push({ x, y });
  x = pt && pt.x >= target.x && pt.x <= target.x + target.width ? pt.x : routingCenterX(target);
  if (clear(x, y)) result.push({ x, y });
  if (result.length === 1) {
    if (pt) {
      if (clear(pt.x, y)) result.push({ x: pt.x, y });
    } else {
      const l = Math.max(source.x, target.x);
      const r = Math.min(source.x + source.width, target.x + target.width);
      result.push({ x: l + (r - l) / 2, y });
    }
  }
};

/** mxEdgeStyle.ElbowConnector */
export const elbowConnector: EdgeStyle = (edge, source, target, points, result) => {
  let pt = points[0] ?? null;
  let vertical = false;
  let horizontal = false;
  if (source && target) {
    if (pt) {
      const left = Math.min(source.x, target.x);
      const right = Math.max(source.x + source.width, target.x + target.width);
      const top = Math.min(source.y, target.y);
      const bottom = Math.max(source.y + source.height, target.y + target.height);
      pt = transformControlPoint(edge, pt);
      vertical = pt.y < top || pt.y > bottom;
      horizontal = pt.x < left || pt.x > right;
    } else {
      const left = Math.max(source.x, target.x);
      const right = Math.min(source.x + source.width, target.x + target.width);
      vertical = left === right;
      if (!vertical) {
        const top = Math.max(source.y, target.y);
        const bottom = Math.min(source.y + source.height, target.y + target.height);
        horizontal = top === bottom;
      }
    }
  }
  if (!horizontal && (vertical || styleValue(edge.style, 'elbow') === 'vertical')) {
    topToBottom(edge, source, target, points, result);
  } else {
    sideToSide(edge, source, target, points, result);
  }
};
