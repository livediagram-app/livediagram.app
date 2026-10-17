// The office templates' shared parts (docs/specs/012-collaboration/virtual-office-template.md): a room spec, its
// furniture in room-relative px, and the builder that lays them out with the rooms first and the rugs next, so the
// floors lie under everything. The Virtual Office and the space templates are tables of these.

import {
  createShape,
  createText,
  isFloorShape,
  type ChairFacing,
  type Element,
  type RoomDoor,
  type ShapeKind,
} from '@livediagram/document';
import { CANVAS_TONES } from './template-inks';

// `w`/`h` override the piece's default size (keep its proportion: the drawings are aspect locked).
export type OfficePiece = {
  kind: ShapeKind;
  x: number;
  y: number;
  facing?: ChairFacing;
  w?: number;
  h?: number;
};
export type OfficeRoom = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  door: RoomDoor;
  pieces: OfficePiece[];
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

/** Rooms, then rugs, then furniture, each piece placed in its room. `x0, y0` is the plan's top left. */
export function furnishRooms(rooms: readonly OfficeRoom[], x0: number, y0: number): Element[] {
  const walls: Element[] = [];
  const floor: Element[] = [];
  const furniture: Element[] = [];
  for (const room of rooms) {
    const rx = x0 + room.x;
    const ry = y0 + room.y;
    walls.push({
      ...createShape('room', rx, ry),
      width: room.w,
      height: room.h,
      label: room.name,
      roomDoor: room.door,
    });
    for (const p of room.pieces) {
      const base = createShape(p.kind, rx + p.x, ry + p.y);
      const el: Element = {
        ...base,
        ...(p.facing ? { chairFacing: p.facing } : {}),
        ...sizeOf(p, base),
      };
      (p.kind === 'rug' ? floor : furniture).push(el);
    }
  }
  return [...walls, ...floor, ...furniture];
}

const BUTTON_W = 104;
const BUTTON_H = 96;
const HINT_W = 520;

/**
 * The way in: a Selection Mode button labelled Walk In (it hands out Avatar mode and drops the character at it),
 * with a line saying what to do, right-aligned to `right` and centred on `cy`.
 */
export function walkIn(right: number, cy: number, hint: string): Element[] {
  return [
    {
      ...createText(right - BUTTON_W - 20 - HINT_W, cy - 32),
      width: HINT_W,
      height: 64,
      label: hint,
      textSize: 'sm',
      textAlignX: 'right',
      // On the canvas beside the room: a slate that reads in either half (#475569 sank into the dark one).
      textColor: CANVAS_TONES.slate,
    },
    { ...createShape('mode-button', right - BUTTON_W, cy - BUTTON_H / 2), label: 'Walk In' },
  ];
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
): Element[] {
  const placed = furnishRooms(rooms, x0, y0 + head);
  return [
    ...placed.filter(isFloor),
    ...headingEls,
    ...placed.filter((el) => !isFloor(el)),
    ...extra,
  ];
}
