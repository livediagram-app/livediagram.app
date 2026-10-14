// The office templates' shared parts (docs/specs/012-collaboration/virtual-office-template.md): a room spec, its
// furniture in room-relative px, and the builder that lays them out with the rooms first and the rugs next, so the
// floors lie under everything. The Virtual Office and the space templates are tables of these.

import {
  createShape,
  createText,
  type ChairFacing,
  type Element,
  type RoomDoor,
  type ShapeKind,
} from '@livediagram/document';

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
      const el: Element = {
        ...createShape(p.kind, rx + p.x, ry + p.y),
        ...(p.facing ? { chairFacing: p.facing } : {}),
        ...(p.w && p.h ? { width: p.w, height: p.h } : {}),
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
      textColor: '#475569',
    },
    { ...createShape('mode-button', right - BUTTON_W, cy - BUTTON_H / 2), label: 'Walk In' },
  ];
}
