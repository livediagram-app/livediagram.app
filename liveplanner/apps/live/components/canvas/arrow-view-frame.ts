import {
  angledElbow,
  arrowDashOffset,
  arrowPathD,
  arrowPathMidpoint,
  arrowStyleOf,
  angledCornerPoints,
  curveAnchorPoints,
  curveControlPoint,
  DEFAULT_FINISH,
  finishArrowEnds,
  queryElementGrid,
  routeBehindHoles,
  routeBehindQueryRect,
  type ArrowElement,
  type ElementGrid,
  type ElementIndex,
  type Finish,
  type Rect,
} from '@liveplanner/document';

// The pure per-render frame of an arrow view, lifted out of ArrowView
// (following the boxed-drag-resolve / arrow-*-resolve pattern):
// resolved endpoints, the path + visual midpoint, the curve / elbow
// handle points. Labels are laid out for the whole layer at once
// (useArrowLabelLayouts), since they avoid each other.
export function deriveArrowViewFrame(
  stored: ArrowElement,
  elementIndex: ElementIndex,
  // The finish the arrow is drawn in (docs/specs/008-canvas/finish.md): Professional routes a mind
  // map's connectors right-angled.
  finish: Finish = DEFAULT_FINISH,
) {
  // Resolve the true endpoints, then apply the converging-fan offset: when
  // several arrows pin to the same anchor, each end slides a few px along
  // the target edge so the heads don't pile up (arrow-endpoint-spread.ts).
  // A finish-routed connector comes back as the arrow it draws, ends exact.
  const { arrow, from, to } = finishArrowEnds(stored, elementIndex, finish);
  // A route the finish draws belongs to the map, so it offers no bow, elbow or bend handles: dragging
  // one would edit a shape the stored arrow does not have.
  const routed = arrow !== stored;
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
    !routed &&
    (style === 'curved' || style === 'angled') &&
    arrow.curvePoints &&
    arrow.curvePoints.length > 0
      ? style === 'angled'
        ? angledCornerPoints(from, to, arrow.curvePoints, arrow.from, arrow.to)
        : curveAnchorPoints(from, to, arrow.curvePoints)
      : null;
  const curveControl =
    !routed && style === 'curved' && !curveAnchors
      ? curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to)
      : null;
  // Single elbow handle for an angled arrow with no explicit points; the
  // per-point handles take over once the user adds a bend.
  const elbowPoint =
    !routed && style === 'angled' && !curveAnchors
      ? angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset)
      : null;
  // A shared end's dashes anchored there, in step with every arrow into it (arrow-dash.ts).
  const dashOffset = arrowDashOffset(arrow, from, to);
  return {
    from,
    to,
    style,
    pathD,
    dashOffset,
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
    a.dashOffset === b.dashOffset &&
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
  finish: Finish = DEFAULT_FINISH,
): { frame: ArrowViewFrame; holes: Rect[] } {
  const frame = deriveArrowViewFrame(arrow, elementIndex, finish);
  const near = queryElementGrid(grid, routeBehindQueryRect(frame.from, frame.to));
  return { frame, holes: routeBehindHoles(arrow, frame.from, frame.to, near) };
}
