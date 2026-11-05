import {
  DOOR_REACH,
  doorParts,
  isNextToDoor,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';

// A click on a Door in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Clicking a piece", room-builder.md "Opening
// and closing"): next to it, the click swings it open or shut where you stand; farther away it walks you to its near
// side and swings nothing. The canvas layer is pointer-inert while walking, so the door under a click is found from
// the click's canvas point, not the DOM. One pass over the tab's elements per click, never per frame.

// A press this close round a door's box, or round its leaf's swing, still counts as on it: a door is thin.
const HIT_PAD = 10;
// Across its wall a door takes at least this many screen px (half each side), however far out the camera is: the
// wall strip alone is a sliver at walking zoom.
const MIN_ACROSS_PX = 32;
// Where a far click leaves you: this far out from the opening, on your side of it, so you arrive within reach.
const NEAR_SIDE = Math.round(DOOR_REACH * 0.6);
type Point = { x: number; y: number };

const isDoor = (el: Element): el is ShapeElement => el.type === 'shape' && el.shape === 'door';

// The point in the door's own frame: x along its wall, y across it, both from its centre.
function local(door: ShapeElement, p: Point): Point {
  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;
  const r = ((door.rotation ?? 0) * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: dx * Math.cos(r) + dy * Math.sin(r), y: -dx * Math.sin(r) + dy * Math.cos(r) };
}

/**
 * Whether a canvas point is on what a door paints (docs/specs/008-canvas/avatar-mode.md "Clicking a piece"): the
 * opening across its wall, padded to at least MIN_ACROSS_PX screen px at `zoom`, and, while it stands open, the
 * quarter circle its leaf sweeps from the hinge (the leaf and its dashed arc, doorParts). Shut, the leaf lies along
 * the wall, so the opening alone is the door.
 */
export function onDoor(door: ShapeElement, point: Point, zoom = 1): boolean {
  const p = local(door, point);
  const across = Math.max(door.height / 2 + HIT_PAD, MIN_ACROSS_PX / 2 / Math.max(zoom, 0.01));
  if (Math.abs(p.x) <= door.width / 2 + HIT_PAD && Math.abs(p.y) <= across) return true;
  if (door.doorClosed === true) return false;
  // The swing, from the door box's top-left as doorParts draws it: hinged at the first jamb on the centre line,
  // sweeping a quarter circle of the leaf's reach to the +y side.
  const { leaf } = doorParts(door.width, door.height);
  const dx = p.x + door.width / 2 - leaf.x;
  const dy = p.y + door.height / 2 - leaf.y;
  return dx >= -HIT_PAD && dy >= -HIT_PAD && Math.hypot(dx, dy) <= leaf.h + HIT_PAD;
}

/** The topmost Door whose painted shape is under a canvas point (at the camera's `zoom`), or null. */
export function doorAt(elements: readonly Element[], point: Point, zoom = 1): ShapeElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (isDoor(el) && onDoor(el, point, zoom)) return el;
  }
  return null;
}

/** The point just outside a door's opening on the side `feet` stand on. */
export function doorNearSide(door: ShapeElement, feet: Point): Point {
  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;
  const r = ((door.rotation ?? 0) * Math.PI) / 180;
  const side = local(door, feet).y < 0 ? -1 : 1;
  return { x: cx - Math.sin(r) * NEAR_SIDE * side, y: cy + Math.cos(r) * NEAR_SIDE * side };
}

export type DoorPress = {
  doorId: string;
  // The feet are within reach: the click swings it (when the viewer may; a Viewer's click walks).
  next: boolean;
  // Where a click that does not swing it walks you.
  nearSide: Point;
};

/** The door under a walking click at `point`, whether `feet` can reach it, and its near side; null for no door. */
export function avatarDoorPress(
  elements: readonly Element[],
  point: Point,
  feet: Point,
  zoom = 1,
): DoorPress | null {
  const door = doorAt(elements, point, zoom);
  if (!door) return null;
  return { doorId: door.id, next: isNextToDoor(feet, door), nearSide: doorNearSide(door, feet) };
}
