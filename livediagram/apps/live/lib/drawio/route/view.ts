// Ported from draw.io, Copyright (c) 2006-2015 JGraph Holdings Ltd and draw.io AG, Apache-2.0
// (packages/licences/texts/drawio-31.7.0-LICENSE.txt); translated to TypeScript and changed.
// The path draw.io draws for one edge, ported from jgraph/drawio v31.7.0
// (mxGraphView.updateEdgeState and what it calls, mxGraph.getConnectionConstraint, Graph.js's
// getLegacyConnectionPoint and centerPerimeter override; Apache-2.0). Each function names its
// source. Everything is in draw.io units at scale 1.

import { debugLog } from '@/lib/debug-log';
import type { DrawioStyle } from '../style';
import { centreX, centreY, rotatedPoint, toRadians, type Box, type Pt } from './geometry';
import {
  elbowConnector,
  entityRelation,
  loop,
  sideToSide,
  topToBottom,
  transformControlPoint,
  type EdgeRouting,
  type EdgeStyle,
} from './edge-styles';
import { orthConnector } from './orth-connector';
import { perimeterOf } from './perimeters';
import { segmentConnector } from './segment-connector';
import { statePoint, styleNumber, styleValue, truthy, type CellState } from './state';

/** One end of an edge: a terminal cell's state, or a point when nothing is there. */
export type RouteEnd = { kind: 'terminal'; state: CellState } | { kind: 'point'; at: Pt };

export type RouteInput = {
  style: DrawioStyle;
  /** The origin the waypoints are relative to (the edge's parent). */
  origin: Pt;
  /** The waypoints, relative to `origin`. */
  points: Pt[];
  source: RouteEnd;
  target: RouteEnd;
  gridSize: number;
  /** The state of a `sourcePort` / `targetPort` cell, when it has one. */
  portState?: (cellId: string) => CellState | null;
};

// The routers by style name (mxStyleRegistry plus Shapes.js). draw.io's isometric router skews
// its segments; here it routes as the elbow it is drawn from.
const EDGE_STYLES: Record<string, EdgeStyle> = {
  elbowEdgeStyle: elbowConnector,
  entityRelationEdgeStyle: entityRelation,
  loopEdgeStyle: loop,
  sideToSideEdgeStyle: sideToSide,
  topToBottomEdgeStyle: topToBottom,
  orthogonalEdgeStyle: orthConnector,
  segmentEdgeStyle: segmentConnector,
  isometricEdgeStyle: elbowConnector,
};

// mxGraph.isOrthogonalEdgeStyle, by name.
const ORTHOGONAL_STYLES = new Set([
  'segmentEdgeStyle',
  'elbowEdgeStyle',
  'sideToSideEdgeStyle',
  'topToBottomEdgeStyle',
  'entityRelationEdgeStyle',
  'orthogonalEdgeStyle',
]);

type Constraint = { point: Pt | null; perimeter: boolean; dx: number; dy: number };

/** mxGraph.getConnectionConstraint */
function connectionConstraint(style: DrawioStyle, source: boolean): Constraint {
  const x = styleValue(style, source ? 'exitX' : 'entryX');
  const y = styleValue(style, source ? 'exitY' : 'entryY');
  const point = x !== undefined && y !== undefined ? { x: Number(x), y: Number(y) } : null;
  if (!point) return { point: null, perimeter: false, dx: 0, dy: 0 };
  const perimeter = styleValue(style, source ? 'exitPerimeter' : 'entryPerimeter') ?? 1;
  return {
    point,
    perimeter: truthy(perimeter),
    dx: styleNumber(style, source ? 'exitDx' : 'entryDx'),
    dy: styleNumber(style, source ? 'exitDy' : 'entryDy'),
  };
}

/** mxGraphView.getPerimeterBounds: the state's box grown by its `perimeterSpacing` and `border`. */
function perimeterBounds(state: CellState, border = 0): Box {
  const grow = border + styleNumber(state.style, 'perimeterSpacing');
  return {
    x: state.x - grow,
    y: state.y - grow,
    width: state.width + 2 * grow,
    height: state.height + 2 * grow,
  };
}

const flip = (state: CellState, key: 'flipH' | 'flipV') =>
  state.vertex && styleNumber(state.style, key) === 1;

/** mxGraphView.getPerimeterPoint */
function perimeterPoint(state: CellState, next: Pt, orthogonal: boolean, border = 0): Pt {
  const perimeter = perimeterOf(state);
  if (perimeter) {
    const bounds = perimeterBounds(state, border);
    if (bounds.width > 0 || bounds.height > 0) {
      const flipH = flip(state, 'flipH');
      const flipV = flip(state, 'flipV');
      const mirror = (p: Pt): Pt => ({
        x: flipH ? 2 * centreX(bounds) - p.x : p.x,
        y: flipV ? 2 * centreY(bounds) - p.y : p.y,
      });
      const point = perimeter(bounds, state, mirror(next), orthogonal);
      if (point) return mirror(point);
    }
  }
  return statePoint(state);
}

const QUARTER_TURNS: Record<string, number> = { north: 270, west: 180, south: 90 };

// mxUtils.getRotatedPoint by a multiple of 90 degrees, as draw.io turns them (no trigonometry).
function quarterTurn(p: Pt, degrees: number, c: Pt): Pt {
  const cos = degrees === 180 ? -1 : 0;
  const sin = degrees === 90 ? 1 : degrees === 270 ? -1 : 0;
  return rotatedPoint(p, cos, sin, c);
}

/** Graph.getLegacyConnectionPoint (draw.io's default, `legacyAnchorPoints=1`). */
function connectionPoint(state: CellState, constraint: Constraint): Pt | null {
  if (!constraint.point) return null;
  let bounds = perimeterBounds(state);
  const cx = { x: centreX(bounds), y: centreY(bounds) };
  const direction = styleValue(state.style, 'direction');
  let r1 = 0;
  if (direction !== undefined && styleNumber(state.style, 'anchorPointDirection', 1) === 1) {
    r1 = QUARTER_TURNS[String(direction)] ?? 0;
    if (direction === 'north' || direction === 'south') {
      // mxRectangle.rotate90
      const t = (bounds.width - bounds.height) / 2;
      bounds = { x: bounds.x + t, y: bounds.y - t, width: bounds.height, height: bounds.width };
    }
  }
  let point: Pt = {
    x: bounds.x + constraint.point.x * bounds.width + constraint.dx,
    y: bounds.y + constraint.point.y * bounds.height + constraint.dy,
  };
  let r2 = styleNumber(state.style, 'rotation');
  if (constraint.perimeter) {
    if (r1 !== 0) point = quarterTurn(point, r1, cx);
    point = perimeterPoint(state, point, false);
  } else {
    r2 += r1;
    if (state.vertex) {
      let flipH = styleNumber(state.style, 'flipH') === 1;
      let flipV = styleNumber(state.style, 'flipV') === 1;
      if (direction === 'north' || direction === 'south') [flipH, flipV] = [flipV, flipH];
      if (flipH) point.x = 2 * centreX(bounds) - point.x;
      if (flipV) point.y = 2 * centreY(bounds) - point.y;
    }
  }
  if (r2 !== 0) {
    const rad = toRadians(r2);
    point = rotatedPoint(point, Math.cos(rad), Math.sin(rad), cx);
  }
  return point;
}

const terminalOf = (end: RouteEnd): CellState | null =>
  end.kind === 'terminal' ? end.state : null;

/** mxGraphView.getFixedTerminalPoint, with Graph.js's centerPerimeter. */
function fixedTerminalPoint(input: RouteInput, end: RouteEnd, source: boolean): Pt | null {
  const terminal = terminalOf(end);
  if (terminal) {
    if (styleValue(terminal.style, 'perimeter') === 'centerPerimeter') {
      return { x: centreX(terminal), y: centreY(terminal) };
    }
    return connectionPoint(terminal, connectionConstraint(input.style, source));
  }
  return end.kind === 'point' ? end.at : null;
}

/** mxGraphView.getTerminalPort */
function terminalPort(input: RouteInput, terminal: CellState | null, source: boolean) {
  const id = styleValue(input.style, source ? 'sourcePort' : 'targetPort');
  if (terminal && id !== undefined) return input.portState?.(String(id)) ?? terminal;
  return terminal;
}

/** mxGraphView.getEdgeStyle, with isLoopStyleEnabled. */
function edgeStyleOf(input: RouteInput, source: CellState | null, target: CellState | null) {
  const sc = connectionConstraint(input.style, true);
  const tc = connectionConstraint(input.style, false);
  const isLoop =
    input.points.length < 2 &&
    (!truthy(styleValue(input.style, 'orthogonalLoop')) || (!sc.point && !tc.point)) &&
    !!source &&
    source.cellId === target?.cellId;
  const name = isLoop
    ? (styleValue(input.style, 'loop') ?? 'loopEdgeStyle')
    : !truthy(styleValue(input.style, 'noEdgeStyle'))
      ? styleValue(input.style, 'edgeStyle')
      : undefined;
  if (name === undefined) return null;
  const found = EDGE_STYLES[String(name)];
  if (!found) debugLog('[drawio-route] edge style not ported, drawn straight', { name });
  return found ?? null;
}

/** mxGraph.isOrthogonal */
function isOrthogonal(style: DrawioStyle): boolean {
  const own = styleValue(style, 'orthogonal');
  if (own !== undefined) return truthy(own);
  if (truthy(styleValue(style, 'noEdgeStyle'))) return false;
  return ORTHOGONAL_STYLES.has(String(styleValue(style, 'edgeStyle')));
}

/** mxGraphView.getNextPoint */
function nextPoint(points: (Pt | null)[], opposite: CellState | null, source: boolean): Pt | null {
  const count = points.length;
  const point =
    count >= 2 ? points[source ? Math.min(1, count - 1) : Math.max(0, count - 2)] : null;
  if (point) return point;
  return opposite ? { x: centreX(opposite), y: centreY(opposite) } : null;
}

/** mxGraphView.getFloatingTerminalPoint */
function floatingTerminalPoint(
  input: RouteInput,
  points: (Pt | null)[],
  startState: CellState,
  end: CellState | null,
  source: boolean,
): Pt {
  const start = terminalPort(input, startState, source)!;
  let next = nextPoint(points, end, source) ?? { x: centreX(start), y: centreY(start) };
  const alpha = toRadians(styleNumber(start.style, 'rotation'));
  const centre = { x: centreX(start), y: centreY(start) };
  if (alpha !== 0) next = rotatedPoint(next, Math.cos(-alpha), Math.sin(-alpha), centre);
  const border =
    styleNumber(input.style, 'perimeterSpacing') +
    styleNumber(input.style, source ? 'sourcePerimeterSpacing' : 'targetPerimeterSpacing');
  let pt = perimeterPoint(start, next, alpha === 0 && isOrthogonal(input.style), border);
  if (alpha !== 0) pt = rotatedPoint(pt, Math.cos(alpha), Math.sin(alpha), centre);
  return pt;
}

/** mxGraphView.updateEdgeState's routing: fixed ends, the router or the waypoints, then the
 *  floating ends. Returns every point of the path, both ends included. */
export function routeEdge(input: RouteInput): Pt[] {
  const source = terminalOf(input.source);
  const target = terminalOf(input.target);
  const p0 = fixedTerminalPoint(input, input.source, true);
  const pe = fixedTerminalPoint(input, input.target, false);

  // updatePoints
  const edge: EdgeRouting = {
    style: input.style,
    origin: input.origin,
    absolutePoints: [p0, pe],
    gridSize: input.gridSize,
  };
  const pts: (Pt | null)[] = [p0];
  const router = edgeStyleOf(input, source, target);
  if (router) {
    router(
      edge,
      terminalPort(input, source, true),
      terminalPort(input, target, false),
      input.points,
      pts,
    );
  } else {
    for (const p of input.points) pts.push(transformControlPoint(edge, p));
  }
  pts.push(pe);

  // updateFloatingTerminalPoints: the target end first, then the source.
  if (!pe && target) pts[pts.length - 1] = floatingTerminalPoint(input, pts, target, source, false);
  if (!p0 && source) pts[0] = floatingTerminalPoint(input, pts, source, target, true);

  return pts.filter((p): p is Pt => !!p);
}
