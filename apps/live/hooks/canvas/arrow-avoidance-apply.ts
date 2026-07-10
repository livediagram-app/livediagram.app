import {
  collisionAvoidingCurveOffset,
  endpointPosition,
  isBoxed,
  type AvoidanceObstacle,
  type Element,
} from '@livediagram/diagram';

// Apply the collision-avoiding curve (spec/77) to a JUST-DRAWN arrow: if
// its straight chord would cross an unrelated element's clearance ring, or
// run flush along the boxes it connects, give it the gentle bow the
// geometry helper picks. One-shot at the end of the creation gesture; the
// result is an ordinary curved arrow the user can adjust or straighten
// with the existing handles. Pure elements map so the drag hook can run it
// through `commit` inside the same gesture (same undo step).
export function applyCollisionAvoidance(els: Element[], arrowId: string): Element[] {
  const arrow = els.find((e) => e.id === arrowId);
  if (!arrow || arrow.type !== 'arrow') return els;
  // Only untouched-default arrows: a style the creation flow (or the user,
  // mid-gesture) already chose wins.
  if (arrow.arrowStyle !== undefined || arrow.curveOffset || arrow.curvePoints) return els;
  const from = endpointPosition(arrow.from, els);
  const to = endpointPosition(arrow.to, els);
  const fromId =
    arrow.from.kind === 'pinned'
      ? arrow.from.elementId
      : arrow.from.kind === 'pinned-group'
        ? arrow.from.groupId
        : null;
  const toId =
    arrow.to.kind === 'pinned'
      ? arrow.to.elementId
      : arrow.to.kind === 'pinned-group'
        ? arrow.to.groupId
        : null;
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
