import {
  arrowStyleOf,
  curveAnchorPoints,
  endpointPosition,
  projectToArrow,
  snapArrowPoint,
  type AlignmentGuide,
  type ArrowElement,
  type Element,
} from '@livediagram/diagram';
import { ALIGN_SNAP_THRESHOLD } from '@/lib/canvas';

// The arrow control-handle frame resolvers (spec/09 arrows), lifted out
// of useEditorDrag's pointermove switch like resolveArrowEndpointDrag /
// the boxed resolvers before them: pure functions the drag hook feeds
// the gesture's captured start state + the live delta, getting back the
// offset to write and the guides to draw. The hook stays the owner of
// everything React-shaped (the checkpoint tick, the guide scheduler).

// Snap a dragged control point against its neighbouring vertices and
// nearby elements' edges / centres. The dragged vertex sits at
// poly[pointIndex + 1], so its neighbours are poly[pointIndex] and
// poly[pointIndex + 2]. Filter out any miss: if the point was removed
// mid-drag the index can fall off the end, and an undefined neighbour
// would crash snapArrowPoint reading `.x`.
function snapArrowControlPoint(
  els: Element[],
  arrowId: string,
  raw: { x: number; y: number },
  pointIndex: number | null | undefined,
): { point: { x: number; y: number }; guides: AlignmentGuide[] } {
  const arrow = els.find((e): e is ArrowElement => e.id === arrowId && e.type === 'arrow');
  if (!arrow) return { point: raw, guides: [] };
  const from = endpointPosition(arrow.from, els);
  const to = endpointPosition(arrow.to, els);
  const anchors = arrow.curvePoints ? curveAnchorPoints(from, to, arrow.curvePoints) : [];
  const poly = [from, ...anchors, to];
  const neighbours =
    pointIndex != null && arrow.curvePoints
      ? [poly[pointIndex], poly[pointIndex + 2]].filter(
          (p): p is { x: number; y: number } => p != null,
        )
      : [from, to];
  const exclude = new Set<string>();
  if (arrow.from.kind === 'pinned') exclude.add(arrow.from.elementId);
  if (arrow.to.kind === 'pinned') exclude.add(arrow.to.elementId);
  return snapArrowPoint(raw, neighbours, els, ALIGN_SNAP_THRESHOLD, exclude);
}

// Resolve one curve / elbow handle frame. The control point should sit
// at `pointer + grab`, where grab is the pointer-to-control delta
// captured on gesture start; translating that into an offset means
// subtracting the base point (the chord midpoint for a curve, the
// auto-elbow position for an elbow — both captured at start so a
// concurrent endpoint move doesn't yank the bend).
export function resolveArrowControlFrame({
  els,
  arrowId,
  baseX,
  baseY,
  grabDx,
  grabDy,
  dx,
  dy,
  pointIndex,
}: {
  els: Element[];
  arrowId: string;
  baseX: number;
  baseY: number;
  grabDx: number;
  grabDy: number;
  dx: number;
  dy: number;
  // The multi-bend control point slot being dragged; null for the
  // legacy single bow / the elbow handle.
  pointIndex: number | null | undefined;
}): { offsetDx: number; offsetDy: number; guides: AlignmentGuide[] } {
  const raw = { x: baseX + grabDx + dx, y: baseY + grabDy + dy };
  const { point: snapped, guides } = snapArrowControlPoint(els, arrowId, raw, pointIndex);
  return { offsetDx: snapped.x - baseX, offsetDy: snapped.y - baseY, guides };
}

// Resolve one label-drag frame: the dragged point is the label's
// grab-time anchor plus the pointer delta, projected onto the line to
// get the new {t, offset} placement (stays attached to the line, either
// side). Endpoints resolve fresh so it survives endpoint moves. Null
// when the arrow is gone.
export function resolveArrowLabelFrame({
  els,
  arrowId,
  startAnchorX,
  startAnchorY,
  dx,
  dy,
}: {
  els: Element[];
  arrowId: string;
  startAnchorX: number;
  startAnchorY: number;
  dx: number;
  dy: number;
}): ArrowElement['labelOffset'] | null {
  const arrow = els.find((el) => el.id === arrowId);
  if (!arrow || arrow.type !== 'arrow') return null;
  const from = endpointPosition(arrow.from, els);
  const to = endpointPosition(arrow.to, els);
  const point = { x: startAnchorX + dx, y: startAnchorY + dy };
  return projectToArrow(
    arrowStyleOf(arrow),
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    point,
    arrow.curvePoints,
  );
}
