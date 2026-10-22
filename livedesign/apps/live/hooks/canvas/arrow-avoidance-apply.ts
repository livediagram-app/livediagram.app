import {
  collisionAvoidingCurveOffset,
  endpointPosition,
  finishCurvesNewArrows,
  finishNewArrowStyle,
  isBoxed,
  resolveFinish,
  type AvoidanceObstacle,
  type Element,
} from '@livepages/document';

// Apply the collision-avoiding curve (docs/specs/008-canvas/arrow-collision-avoidance.md) to a JUST-DRAWN arrow: if
// its straight chord would cross an unrelated element's clearance ring, or
// run flush along the boxes it connects, give it the gentle bow the
// geometry helper picks. One-shot at the end of the creation gesture; the
// result is an ordinary curved arrow the user can adjust or straighten
// with the existing handles. Pure elements map so the drag hook can run it
// through `commit` inside the same gesture (same undo step). An arrow drawn in the Professional finish
// becomes a right-angled connector instead (docs/specs/008-canvas/finish.md).
export function applyCollisionAvoidance(
  els: Element[],
  arrowId: string,
  tabFinish?: unknown,
): Element[] {
  const arrow = els.find((e) => e.id === arrowId);
  if (!arrow || arrow.type !== 'arrow') return els;
  // Only untouched-default arrows: a style the creation flow (or the user,
  // mid-gesture) already chose wins.
  if (arrow.arrowStyle !== undefined || arrow.curveOffset || arrow.curvePoints) return els;
  // Professional draws a new arrow as a right-angled connector and never bows it (finish.md).
  const finish = resolveFinish(arrow.finish, tabFinish);
  const style = finishNewArrowStyle(finish);
  if (style) return els.map((el) => (el.id === arrowId ? { ...el, arrowStyle: style } : el));
  if (!finishCurvesNewArrows(finish)) return els;
  const from = endpointPosition(arrow.from, els);
  const to = endpointPosition(arrow.to, els);
  const fromId = arrow.from.kind === 'pinned' ? arrow.from.elementId : null;
  const toId = arrow.to.kind === 'pinned' ? arrow.to.elementId : null;
  const obstacles: AvoidanceObstacle[] = els.filter(isBoxed).map((el) => ({
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    role: el.id === fromId ? 'from' : el.id === toId ? 'to' : 'other',
  }));
  const off = collisionAvoidingCurveOffset(from, to, obstacles);
  if (!off) return els;
  return els.map((el) =>
    el.id === arrowId ? { ...el, arrowStyle: 'curved' as const, curveOffset: off } : el,
  );
}
