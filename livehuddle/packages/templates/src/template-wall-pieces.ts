// The pieces that stand in a room's wall in the templates: a Door (docs/specs/009-elements/room-builder.md "Door") and a
// Window ("Window"), each placed on the wall's centre line `at` px along it and snapped onto it as a placed one is.
// Shared by every Space's rooms (template-office-parts.ts) and the sites' closed rooms (template-campus-parts.ts).
//
// Pure: each call returns a fresh element.

import {
  createShape,
  PIECE_VARIANT_SIZES,
  snapDoorToWall,
  type DOOR_VARIANTS,
  type ShapeElement,
} from '@livehuddle/document';

export type DoorSide = 'n' | 'e' | 's' | 'w';
export type DoorVariant = (typeof DOOR_VARIANTS)[number];

/** A window in a room's wall: the wall it stands in and how far along that wall its middle is (room-relative px). */
export type WallWindow = { side: DoorSide; at: number };

// A Room's wall centre lines sit half a wall (5 px) inside its box, the back wall at its back face (36 px down):
// @livehuddle/avatar/office-geometry's ROOM_WALL and ROOM_BACK_FACE.
const HALF_WALL = 5;
const BACK_FACE = 36;

/** Where a Door's middle stands on a room's wall: on the wall's centre line, `at` along it. */
function doorMiddle(room: ShapeElement, side: DoorSide, at: number): { x: number; y: number } {
  switch (side) {
    case 'n':
      return { x: room.x + at, y: room.y + BACK_FACE - HALF_WALL };
    case 's':
      return { x: room.x + at, y: room.y + room.height - HALF_WALL };
    case 'w':
      return { x: room.x + HALF_WALL, y: room.y + at };
    case 'e':
      return { x: room.x + room.width - HALF_WALL, y: room.y + at };
  }
}

/**
 * A Door (or a Window) on the room's wall, snapped onto it as a placed one is (turned to the wall, a Window facing in,
 * in the room's floor colour). `variant` is a Door's type, at its own size.
 */
export function doorOnWall(
  room: ShapeElement,
  side: DoorSide,
  at: number,
  kind: 'door' | 'window' = 'door',
  variant?: DoorVariant,
): ShapeElement {
  const middle = doorMiddle(room, side, at);
  const made = createShape(kind, 0, 0);
  const base = variant ? { ...made, ...PIECE_VARIANT_SIZES.door?.[variant], variant } : made;
  const free: ShapeElement = {
    ...base,
    x: middle.x - base.width / 2,
    y: middle.y - base.height / 2,
  };
  return snapDoorToWall(free, [room]);
}
