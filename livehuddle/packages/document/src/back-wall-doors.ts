// The Doors standing on a rectangular Room's back wall (docs/specs/009-elements/room-builder.md "On a back wall"):
// that wall is drawn as a tall band, its top and the face standing up from the floor, so a Door's own gap (a wall's
// thickness either side of the wall's centre line) left most of it standing across the doorway and an open door did
// not look open (Work Tracker 1042). The room breaks its band where an open one stands and draws a shut one in its face;
// the Door then draws only what moves. Both renderers read this: the canvas (RoomView, DoorView) and the export
// (svg-render.ts). Pure: no React, no DOM.

import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import { doorLine, doorSpanOnWall } from '@livehuddle/avatar/room-outline';
import type { Element, ShapeElement } from './index';

/** One Door on a back wall: its span along the wall in the room's own px (0..width, left to right), and whether shut. */
export type BackWallDoor = { from: number; to: number; closed: boolean };

/** Every rectangular room's back-wall Doors by room id, and the ids of the Doors standing on one. */
export type BackWallDoors = {
  rooms: ReadonlyMap<string, readonly BackWallDoor[]>;
  doors: ReadonlySet<string>;
};

export const NO_BACK_WALL_DOORS: BackWallDoors = { rooms: new Map(), doors: new Set() };

// A room with a back wall band: a Room drawn as a rectangle (solid or glass), never one drawn with the Room Builder,
// whose walls are all one thickness.
function hasBackWall(el: ShapeElement): boolean {
  return (
    el.shape === 'room' &&
    !(el.roomOutline && el.roomOutline.length >= 3) &&
    el.width > 0 &&
    el.height > ROOM_BACK_FACE
  );
}

// Built once per board (the elements array), so every room and door reading it on a render shares one pass.
const cache = new WeakMap<readonly Element[], BackWallDoors>();

/**
 * The Doors standing on each rectangular room's back wall: the wall's centre line, ROOM_BACK_FACE - ROOM_WALL / 2 down
 * from the room's top, where the snap stands them (room-builder.ts `wallMiddle`). Rooms x doors, both few; cached per
 * elements array.
 */
export function backWallDoors(elements: readonly Element[]): BackWallDoors {
  const known = cache.get(elements);
  if (known) return known;
  const rooms: ShapeElement[] = [];
  const doors: ShapeElement[] = [];
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    if (hasBackWall(el)) rooms.push(el);
    else if (el.shape === 'door') doors.push(el);
  }
  let out = NO_BACK_WALL_DOORS;
  if (rooms.length > 0 && doors.length > 0) {
    const byRoom = new Map<string, BackWallDoor[]>();
    const onBack = new Set<string>();
    const lines = doors.map((d) => ({
      door: d,
      line: doorLine(d),
      cx: d.x + d.width / 2,
      cy: d.y + d.height / 2,
    }));
    for (const room of rooms) {
      const y = room.y + ROOM_BACK_FACE - ROOM_WALL / 2;
      const wall = { a: { x: room.x, y }, b: { x: room.x + room.width, y } };
      const spans: BackWallDoor[] = [];
      for (const { door, line, cx, cy } of lines) {
        // Cheap first: its centre on the wall's line, within the wall's run (doorSpanOnWall's 2 px).
        if (Math.abs(cy - y) > 2 || cx < room.x || cx > room.x + room.width) continue;
        const span = doorSpanOnWall(wall, line);
        if (!span) continue;
        spans.push({ from: span[0], to: span[1], closed: door.doorClosed === true });
        onBack.add(door.id);
      }
      if (spans.length > 0)
        byRoom.set(
          room.id,
          spans.sort((p, q) => p.from - q.from),
        );
    }
    if (onBack.size > 0) out = { rooms: byRoom, doors: onBack };
  }
  cache.set(elements, out);
  return out;
}

/** A room's runs of back wall between its open doorways (and an older room's own top doorway, `builtIn`), left to right. */
export function backWallRuns(
  width: number,
  doors: readonly BackWallDoor[],
  builtIn: [number, number] | null = null,
): [number, number][] {
  const gaps = doors.filter((d) => !d.closed).map((d): [number, number] => [d.from, d.to]);
  if (builtIn) gaps.push(builtIn);
  gaps.sort((p, q) => p[0] - q[0]);
  const runs: [number, number][] = [];
  let from = 0;
  for (const [a, b] of gaps) {
    if (a > from) runs.push([from, a]);
    from = Math.max(from, b);
  }
  if (from < width) runs.push([from, width]);
  return runs;
}

/** A Door's jamb, as its own drawing has it (room-builder.ts `doorParts`). */
export function doorJamb(width: number): number {
  return Math.min(6, width / 4);
}

/**
 * A shut Door drawn in a back wall's face, in the room's own px: its leaf standing in the doorway between its jambs,
 * from just under the wall's top to the floor, and the knob on its leading side.
 */
export function backWallDoorLeaf(door: BackWallDoor): {
  leaf: { x: number; y: number; w: number; h: number };
  knob: { cx: number; cy: number; r: number };
} {
  const jamb = doorJamb(door.to - door.from);
  const x = door.from + jamb;
  const w = Math.max(0, door.to - door.from - 2 * jamb);
  const y = ROOM_WALL + 2;
  const h = ROOM_BACK_FACE - ROOM_WALL / 2 - y;
  return {
    leaf: { x, y, w, h },
    knob: { cx: x + w - Math.min(8, w / 4), cy: y + h * 0.55, r: 2.25 },
  };
}
