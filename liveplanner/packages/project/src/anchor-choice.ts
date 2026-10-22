import type { Anchor, BoxedElement } from './index';
import { sideOffered, type Side } from './anchors';
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

const NORMALS: Record<Side, Point> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

// The side an end faces `towards` among the sides that carry anchors: the
// sides the ray leaves through, soonest first, then the rest by how directly
// they face the direction. A triangle's bare top is skipped for the face
// that points most that way. Null when the direction is zero.
export function facingSideTowards(element: BoxedElement, towards: Point): Side | null {
  const c = centreOf(element);
  let dx = towards.x - c.x;
  let dy = towards.y - c.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  const rotation = element.rotation ?? 0;
  if (rotation) {
    const local = rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -rotation);
    dx = local.x;
    dy = local.y;
  }
  const box = connectorBox(element);
  const hw = box.width / 2 || 1;
  const hh = box.height / 2 || 1;
  const time = (side: Side) => {
    const d = side === 'n' ? -dy / hh : side === 's' ? dy / hh : side === 'e' ? dx / hw : -dx / hw;
    return d > 0 ? 1 / d : Infinity;
  };
  const facing = (side: Side) => NORMALS[side].x * dx + NORMALS[side].y * dy;
  const ranked = [...SIDES].sort((a, b) => time(a) - time(b) || facing(b) - facing(a));
  return ranked.find((side) => sideOffered(element, side)) ?? null;
}

// The creation anchor: the middle of the side the connector faces towards
// `towards`. 'e' when the direction is zero (a point on the centre).
export function bestAnchorTowards(element: BoxedElement, towards: Point): Anchor {
  const side = facingSideTowards(element, towards);
  if (side && side !== exitSideTowards(element, towards)) {
    console.debug(`[arrow-anchors] creation element=${element.id} side=${side} fallback=side`);
  }
  return side ?? 'e';
}
