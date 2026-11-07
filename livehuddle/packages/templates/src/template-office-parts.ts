// The office templates' shared parts (docs/specs/012-collaboration/virtual-office-template.md): a room spec, its
// furniture in room-relative px, and the builder that lays them out with the rooms first and the rugs next, so the
// floors lie under everything. The Virtual Office and the space templates are tables of these.

import {
  createShape,
  isFloorShape,
  PIECE_VARIANT_SIZES,
  roomWithDoorPiece,
  type ChairFacing,
  type Element,
  type RoomDoor,
  type ShapeKind,
} from '@livehuddle/document';
import { heading } from './template-session-parts';
import { doorOnWall, type WallWindow } from './template-wall-pieces';

// `w`/`h` override the piece's default size (keep its proportion: the drawings are aspect locked).
export type OfficePiece = {
  kind: ShapeKind;
  x: number;
  y: number;
  facing?: ChairFacing;
  w?: number;
  h?: number;
  // A stage's Show Cameras (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way in").
  stageCameras?: boolean;
  // A piece's label: an Elevator's name (docs/specs/009-elements/elevator.md "Names").
  label?: string;
  // A piece's type (a rug's, a Long Table's: docs/specs/009-elements/office.md "Rug types"), its size the type's own
  // unless `w`/`h` say otherwise.
  variant?: string;
};
export type OfficeRoom = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  door: RoomDoor;
  pieces: OfficePiece[];
  // Glass walls (docs/specs/009-elements/office.md "Glass walls"): you see who is in the room without walking in. Its
  // Door is a sliding glass one.
  glass?: boolean;
  // Windows in its outside walls (docs/specs/009-elements/room-builder.md "Window"), each on a wall, `at` along it.
  windows?: readonly WallWindow[];
};

// A piece's size: its own `w` and `h`, or one of them with the other kept to the drawing's proportion (the drawings
// are aspect locked), or its default.
function sizeOf(
  p: OfficePiece,
  base: { width: number; height: number },
): { width?: number; height?: number } {
  if (p.w && p.h) return { width: p.w, height: p.h };
  if (p.w) return { width: p.w, height: Math.round((p.w * base.height) / base.width) };
  if (p.h) return { width: Math.round((p.h * base.width) / base.height), height: p.h };
  return {};
}

/** One piece placed with its top left at (x, y): its facing, cameras and size applied. */
function placePiece(p: OfficePiece, x: number, y: number): Element {
  const made = createShape(p.kind, x, y);
  const typed = p.variant ? PIECE_VARIANT_SIZES[p.kind]?.[p.variant] : undefined;
  const base = p.variant ? { ...made, ...typed, variant: p.variant } : made;
  return {
    ...base,
    ...(p.facing ? { chairFacing: p.facing } : {}),
    ...(p.stageCameras ? { stageCameras: true } : {}),
    ...(p.label ? { label: p.label } : {}),
    ...sizeOf(p, base),
  };
}

/**
 * Open-air pieces, then rooms, then rugs and stages, then the rooms' Doors, then furniture, each room's piece placed in its room. `x0, y0` is
 * the plan's top left. `open` are pieces under no roof (a lawn, a path, a tree), placed from the plan's top left: their
 * floors (grass, garden paths) lie under the rooms, their furniture with the rest.
 */
export function furnishRooms(
  rooms: readonly OfficeRoom[],
  x0: number,
  y0: number,
  open: readonly OfficePiece[] = [],
): Element[] {
  const ground: Element[] = [];
  const walls: Element[] = [];
  const floor: Element[] = [];
  const doors: Element[] = [];
  const furniture: Element[] = [];
  for (const p of open) {
    const el = placePiece(p, x0 + p.x, y0 + p.y);
    (isFloorShape(p.kind) ? ground : furniture).push(el);
  }
  for (const room of rooms) {
    const rx = x0 + room.x;
    const ry = y0 + room.y;
    // The doorway is a Door piece (docs/specs/009-elements/office.md "The doorway is a Door"), on the wall asked for.
    const { room: el, door } = roomWithDoorPiece({
      ...createShape('room', rx, ry),
      width: room.w,
      height: room.h,
      label: room.name,
      roomDoor: room.door,
      ...(room.glass ? { variant: 'glass' } : {}),
    });
    walls.push(el);
    // A glass room's doorway is a sliding glass Door, in the middle of the same wall.
    if (door && room.glass && room.door !== 'none') {
      const along = room.door === 'n' || room.door === 's' ? room.w : room.h;
      doors.push(doorOnWall(el, room.door, along / 2, 'door', 'sliding'));
    } else if (door) doors.push(door);
    for (const w of room.windows ?? []) doors.push(doorOnWall(el, w.side, w.at, 'window'));
    for (const p of room.pieces) {
      (isFloorShape(p.kind) ? floor : furniture).push(placePiece(p, rx + p.x, ry + p.y));
    }
  }
  return [...ground, ...walls, ...floor, ...doors, ...furniture];
}

const isFloor = (el: Element) => el.type === 'shape' && isFloorShape(el.shape);

/**
 * A space laid out: its rooms furnished `head` below `y0`, the floors (rooms, then rugs) first, then the heading, then
 * the furniture, then `extra`, so a title never lies under a floor. Split by kind, never by position, so a piece that
 * is a floor can never be dropped or doubled.
 */
export function officePlan(
  rooms: readonly OfficeRoom[],
  x0: number,
  y0: number,
  head: number,
  headingEls: readonly Element[],
  extra: readonly Element[],
  open: readonly OfficePiece[] = [],
): Element[] {
  const placed = furnishRooms(rooms, x0, y0 + head, open);
  return [
    ...placed.filter(isFloor),
    ...headingEls,
    ...placed.filter((el) => !isFloor(el)),
    ...extra,
  ];
}

// A space's heading band above its plan, and the margin under it (where its Avatar Pad waited before it moved into
// the plan: template-arrival.ts), which keeps every plan centred where it always was.
export const SPACE_HEAD = 96;
export const SPACE_BELOW = 120;

/** A space's floor plan under its heading (officePlan: floors first, then the heading, then the rest). */
export function spacePlan(
  x0: number,
  y0: number,
  width: number,
  rooms: OfficeRoom[],
  title: { text: string; width: number; sticker: string; subtitle: string },
  extra: Element[],
  open: readonly OfficePiece[] = [],
): Element[] {
  return officePlan(
    rooms,
    x0,
    y0,
    SPACE_HEAD,
    heading(x0, y0, width, title.text, title.width, title.sticker, title.subtitle),
    extra,
    open,
  );
}
