import type { Anchor, BoxedElement } from './index';
import type { Side } from './anchors';
import { centreOf } from './geometry';
import { rotatePoint, type Point } from './geometry-primitives';
import { connectorBox } from './shape-outline';

// Which side of an element a connector leaves through
// (docs/specs/008-canvas/arrow-anchors.md): the creation anchor and the
// auto-rebind's facing side both come from here.

// Stable tie order: a square faced at exactly 45deg resolves the same way
// every time.
const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

// The side the ray from the element's centre towards `towards` leaves its
// connector box through: a slab / ray-box test, so it is aspect-ratio aware
// (a short, wide box leaves through its top or bottom for all but
// near-horizontal targets). Rotation is undone first, so the side is in the
// element's own frame, the frame anchors are named in. Null when the
// direction is zero.
export function exitSideTowards(element: BoxedElement, towards: Point): Side | null {
  const c = centreOf(element);
  let dx = towards.x - c.x;
  let dy = towards.y - c.y;
  const rotation = element.rotation ?? 0;
  if (rotation) {
    const local = rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -rotation);
    dx = local.x;
    dy = local.y;
  }
  // `|| 1` guards a degenerate zero dimension; real elements clamp to MIN_SIZE.
  const box = connectorBox(element);
  const halfWidth = box.width / 2 || 1;
  const halfHeight = box.height / 2 || 1;
  const times: Record<Side, number> = {
    n: dy < 0 ? halfHeight / -dy : Infinity,
    e: dx > 0 ? halfWidth / dx : Infinity,
    s: dy > 0 ? halfHeight / dy : Infinity,
    w: dx < 0 ? halfWidth / -dx : Infinity,
  };
  let best: Side | null = null;
  for (const side of SIDES) {
    if (times[side] !== Infinity && (best === null || times[side] < times[best])) best = side;
  }
  return best;
}

// Where one end should AIM when choosing its side: the point of the other
// connector box closest to this element's centre, not the other centre.
// Boxes side by side but slightly offset (rows, columns, template layouts)
// then face each other through their opposing sides instead of one end
// grabbing a top or bottom side because the centre-to-centre ray crossed a
// corner diagonal. Falls back to the other centre when the boxes overlap
// (the clamp would return this centre itself: a degenerate ray).
export function anchorAimPoint(other: BoxedElement, fromCentre: Point): Point {
  const box = connectorBox(other);
  const x = Math.min(Math.max(fromCentre.x, box.x), box.x + box.width);
  const y = Math.min(Math.max(fromCentre.y, box.y), box.y + box.height);
  if (x === fromCentre.x && y === fromCentre.y) return centreOf(other);
  return { x, y };
}

// The creation anchor: the middle of the side the connector leaves through
// towards `towards`. 'e' when the direction is zero (a point on the centre).
export function bestAnchorTowards(element: BoxedElement, towards: Point): Anchor {
  return exitSideTowards(element, towards) ?? 'e';
}
