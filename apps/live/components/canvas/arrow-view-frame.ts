import {
  angledElbow,
  arrowEndpointSpread,
  arrowLabelAnchor,
  arrowPathD,
  arrowPathMidpoint,
  arrowStyleOf,
  curveAnchorPoints,
  curveControlPoint,
  endpointPosition,
  type ArrowElement,
  type ElementIndex,
} from '@livediagram/diagram';
import { arrowLabelFontSize, placeLabel } from '@/lib/arrow-label-geometry';

// The pure per-render frame of an arrow view, lifted out of ArrowView
// (following the boxed-drag-resolve / arrow-*-resolve pattern):
// resolved endpoints, the path + visual midpoint, the curve / elbow
// handle points, and the label's placement.
export function deriveArrowViewFrame(
  arrow: ArrowElement,
  elementIndex: ElementIndex,
  isEditing: boolean,
) {
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
      ? curveAnchorPoints(from, to, arrow.curvePoints)
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
  const labelText = arrow.label ?? '';
  const showLabel = isEditing || labelText.length > 0;
  // When the user has dragged the label, anchor it to their chosen
  // {t, offset} on the line; otherwise auto-place it around the
  // midpoint dodging nearby boxes.
  const labelPos = !showLabel
    ? { x: midpoint.x, y: midpoint.y }
    : arrow.labelOffset
      ? arrowLabelAnchor(
          style,
          from,
          to,
          arrow.from,
          arrow.to,
          arrow.curveOffset,
          arrow.elbowOffset,
          arrow.labelOffset,
          arrow.curvePoints,
        )
      : placeLabel(
          midpoint,
          labelText,
          elementIndex,
          arrow.id,
          arrowLabelFontSize(arrow.textSize),
          {
            dx: to.x - from.x,
            dy: to.y - from.y,
          },
        );
  return {
    from,
    to,
    style,
    pathD,
    midpoint,
    curveAnchors,
    curveControl,
    elbowPoint,
    labelText,
    labelPos,
  };
}
