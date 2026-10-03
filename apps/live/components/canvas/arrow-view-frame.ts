import {
  angledElbow,
  arrowEndpointSpread,
  arrowPathD,
  arrowPathMidpoint,
  arrowStyleOf,
  angledCornerPoints,
  curveAnchorPoints,
  curveControlPoint,
  endpointPosition,
  queryElementGrid,
  routeBehindHoles,
  routeBehindQueryRect,
  type ArrowElement,
  type ElementGrid,
  type ElementIndex,
  type Rect,
} from '@livediagram/document';

// The pure per-render frame of an arrow view, lifted out of ArrowView
// (following the boxed-drag-resolve / arrow-*-resolve pattern):
// resolved endpoints, the path + visual midpoint, the curve / elbow
// handle points. Labels are laid out for the whole layer at once
// (useArrowLabelLayouts), since they avoid each other.
export function deriveArrowViewFrame(arrow: ArrowElement, elementIndex: ElementIndex) {
  // Resolve the true endpoints, then apply the converging-fan offset: when
  // several arrows pin to the same anchor, each end slides a few px along
  // the target edge so the heads don't pile up (arrow-endpoint-spread.ts).
  const rawFrom = endpointPosition(arrow.from, elementIndex);
  const rawTo = endpointPosition(arrow.to, elementIndex);
  const fromSpread = arrowEndpointSpread(arrow.id, 'from', elementIndex);
  const toSpread = arrowEndpointSpread(arrow.id, 'to', elementIndex);
  const from = { x: rawFrom.x + fromSpread.x, y: rawFrom.y + fromSpread.y };
  const to = { x: rawTo.x + toSpread.x, y: rawTo.y + toSpread.y };
  const style = arrowStyleOf(arrow);
  const pathD = arrowPathD(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  const midpoint = arrowPathMidpoint(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  // Bezier control point (only meaningful for curved arrows). The
  // curve drag handle sits exactly on this point, not on the
  // visual midpoint, since dragging the control point is what
  // actually changes the curve shape (the midpoint is a derived
  // by-product of the control point at t=0.5).
  // Multi-bend control points (absolute), for curved (smooth spline) OR
  // angled (polyline) arrows that carry explicit points. The single bow /
  // elbow handles below are used only when there are no explicit points.
  const curveAnchors =
    (style === 'curved' || style === 'angled') && arrow.curvePoints && arrow.curvePoints.length > 0
      ? style === 'angled'
        ? angledCornerPoints(from, to, arrow.curvePoints, arrow.from, arrow.to)
        : curveAnchorPoints(from, to, arrow.curvePoints)
      : null;
  const curveControl =
    style === 'curved' && !curveAnchors
      ? curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to)
      : null;
  // Single elbow handle for an angled arrow with no explicit points; the
  // per-point handles take over once the user adds a bend.
  const elbowPoint =
    style === 'angled' && !curveAnchors
      ? angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset)
      : null;
  return {
    from,
    to,
    style,
    pathD,
    midpoint,
    curveAnchors,
    curveControl,
    elbowPoint,
  };
}

export type ArrowViewFrame = ReturnType<typeof deriveArrowViewFrame>;

type XY = { x: number; y: number } | null;
const samePoint = (a: XY, b: XY) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y);
const samePoints = (a: readonly XY[] | null, b: readonly XY[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((p, i) => samePoint(p, b[i]!)));

// By value: an arrow view re-renders only when its own frame changes
// (docs/specs/008-canvas/canvas-performance.md), however often the layer derives it afresh.
export function sameArrowViewFrame(a: ArrowViewFrame, b: ArrowViewFrame): boolean {
  return (
    a.style === b.style &&
    a.pathD === b.pathD &&
    samePoint(a.from, b.from) &&
    samePoint(a.to, b.to) &&
    samePoint(a.midpoint, b.midpoint) &&
    samePoint(a.curveControl, b.curveControl) &&
    samePoint(a.elbowPoint, b.elbowPoint) &&
    samePoints(a.curveAnchors, b.curveAnchors)
  );
}

export function sameRects(a: readonly Rect[], b: readonly Rect[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((r, i) => {
        const o = b[i]!;
        return r.x === o.x && r.y === o.y && r.width === o.width && r.height === o.height;
      }))
  );
}

// An arrow's frame and its route-behind holes (docs/specs/008-canvas/arrow-route-behind.md), the
// holes from its neighbours in the element grid rather than the whole board.
export function arrowViewGeometry(
  arrow: ArrowElement,
  elementIndex: ElementIndex,
  grid: ElementGrid,
): { frame: ArrowViewFrame; holes: Rect[] } {
  const frame = deriveArrowViewFrame(arrow, elementIndex);
  const near = queryElementGrid(grid, routeBehindQueryRect(frame.from, frame.to));
  return { frame, holes: routeBehindHoles(arrow, frame.from, frame.to, near) };
}
