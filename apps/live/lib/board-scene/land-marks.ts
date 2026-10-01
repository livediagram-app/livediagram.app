// Ink and unheaded lines on the whiteboard profile (docs/specs/020-import-export/board-scene.md
// "Kinds"): ink becomes a marker stroke, a two-point line a line, a longer one a path.
import {
  MAX_FREEHAND_POINTS,
  MAX_PATH_NODES,
  pathGeometry,
  penColourHex,
  type ArrowElement,
  type FreehandElement,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { colourAlpha, lineColourFields, resolveFill } from './colour';
import { boxOfPoints, commonFields, endsMeet, limitPoints, turnPoints } from './common';
import { LANDING_RULES, type LandContext } from './context';
import type { SceneInk, ScenePoint, ScenePolyline, SceneStroke } from './scene';
import { arrowWidthPx, borderStrokeOf, markerWidthPx } from './width';

// Ends within this many px coincide (the Excalidraw importer's closure test).
export const CLOSED_END_EPSILON_PX = 1;
// How far a curved line's handles reach: a sixth of the chord between a node's neighbours
// (Catmull-Rom as cubic Béziers).
export const CURVE_HANDLE_RATIO = 1 / 6;

/** The element opacity a stroke asks for: its own times its colour's alpha. */
export function strokeOpacity(stroke: SceneStroke, colour = stroke.colour): number {
  return (stroke.opacity ?? 1) * colourAlpha(colour);
}

const dashOf = (stroke: SceneStroke) =>
  stroke.dash === 'dashed' || stroke.dash === 'dotted' ? { strokeStyle: stroke.dash } : {};

/** An ink item as a marker (or highlighter) stroke. */
export function landInk(item: SceneInk, id: string, ctx: LandContext): FreehandElement {
  const { stroke } = item;
  const colour = stroke.stops?.length ? stroke.stops[0]! : stroke.colour;
  if (stroke.stops?.length) ctx.degrade(LANDING_RULES.multicolourInk);
  if (item.fill) ctx.degrade(LANDING_RULES.filledInk);
  if (stroke.dash && stroke.dash !== 'solid') ctx.degrade(LANDING_RULES.dashedInk);
  let points: ScenePoint[] = limitPoints(item.points, MAX_FREEHAND_POINTS - 1);
  if (item.closed && !endsMeet(points, CLOSED_END_EPSILON_PX)) points = [...points, points[0]!];
  const box = boxOfPoints(points);
  const pressured = points.every((p) => p.p !== undefined && Number.isFinite(p.p));
  const resolved = ctx.colour(colour);
  const common = commonFields(item, ctx, strokeOpacity(stroke, colour));
  if (item.highlighter) {
    // The highlighter has no named colour: a stock colour lands as its light-board version.
    const strokeColor =
      resolved?.kind === 'stock'
        ? penColourHex(resolved.name, 'light')
        : resolved?.kind === 'hex'
          ? resolved.hex
          : undefined;
    return {
      id,
      type: 'freehand',
      ...box,
      closed: false,
      pen: 'highlighter',
      penWidth: stroke.widthPx > 0 ? stroke.widthPx : markerWidthPx(stroke.widthPx),
      ...(strokeColor ? { strokeColor } : {}),
      ...common,
    };
  }
  return {
    id,
    type: 'freehand',
    ...box,
    closed: false,
    penWidth: markerWidthPx(stroke.widthPx),
    streamline: item.streamline !== undefined && item.streamline > 0 ? item.streamline : 0,
    ...(pressured ? { pressures: points.map((p) => Math.min(1, Math.max(0, p.p!))) } : {}),
    ...lineColourFields(resolved),
    ...common,
  };
}

/** A two-point unheaded line: the whiteboard's Line (an arrow with no heads). */
export function landLine(item: ScenePolyline, id: string, ctx: LandContext): ArrowElement {
  // A line has no rotation of its own: its ends are turned instead.
  const turned = turnPoints(item.points, item.rotationDeg);
  const [a, b] = [turned[0]!, turned[turned.length - 1]!];
  const { rotation: _turned, ...common } = commonFields(item, ctx, strokeOpacity(item.stroke));
  return {
    id,
    type: 'arrow',
    from: { kind: 'free', x: a.x, y: a.y },
    to: { kind: 'free', x: b.x, y: b.y },
    arrowEnds: 'none',
    strokeWidth: arrowWidthPx(item.stroke.widthPx),
    ...dashOf(item.stroke),
    ...lineColourFields(ctx.colour(item.stroke.colour)),
    ...common,
  };
}

// Catmull-Rom handles for node i of `pts` (closed wraps; an open end uses itself as neighbour).
function curveAnchors(pts: readonly ScenePoint[], closed: boolean): PathAnchor[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const tx = (next.x - prev.x) * CURVE_HANDLE_RATIO;
    const ty = (next.y - prev.y) * CURVE_HANDLE_RATIO;
    const end = !closed && (i === 0 || i === n - 1);
    const anchor: PathAnchor = { x: p.x, y: p.y, mode: end ? 'corner' : 'mirrored' };
    if (closed || i > 0) anchor.handleIn = { x: p.x - tx, y: p.y - ty };
    if (closed || i < n - 1) anchor.handleOut = { x: p.x + tx, y: p.y + ty };
    return anchor;
  });
}

/** A line through three or more points: a path, corners kept or (curved) smooth, closed with its fill. */
export function landPath(item: ScenePolyline, id: string, ctx: LandContext): PathElement {
  const closed = item.closed === true;
  let pts: ScenePoint[] = limitPoints(item.points, MAX_PATH_NODES);
  if (closed && endsMeet(pts, CLOSED_END_EPSILON_PX)) pts = pts.slice(0, -1);
  const anchors: PathAnchor[] = item.curved
    ? curveAnchors(pts, closed)
    : pts.map((p) => ({ x: p.x, y: p.y, mode: 'corner' }));
  const fill = closed ? resolveFill(item.fill) : undefined;
  const stroke = borderStrokeOf(item.stroke.widthPx);
  return {
    id,
    type: 'path',
    ...pathGeometry(anchors, closed),
    closed,
    ...(stroke !== 'medium' ? { strokeWidth: stroke } : {}),
    ...dashOf(item.stroke),
    ...lineColourFields(ctx.colour(item.stroke.colour)),
    ...(fill ? { fillColor: fill } : {}),
    ...commonFields(item, ctx, strokeOpacity(item.stroke)),
  };
}
