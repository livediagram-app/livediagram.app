// The Room Builder and the Door (docs/specs/009-elements/room-builder.md), as the model sees them: the room the tool
// commits, a room's outline in canvas px, and a door put onto the nearest wall (when dropped, when moved, and when
// its room moves). The pure geometry is @liveworkspace/avatar's room-outline, shared with the walk.
import {
  doorLine,
  doorSpanOnWall,
  nearestWall,
  outlineWalls,
  type OutlinePoint,
} from '@liveworkspace/avatar/room-outline';
import {
  DEFAULT_ROOM_DOOR,
  ROOM_BACK_FACE,
  ROOM_WALL,
  roomWalls,
  type RoomDoor,
} from '@liveworkspace/avatar/office-geometry';
import type { Element, ElementId, ShapeElement } from './index';
import { createShape } from './shape-factory';
import { roomPresetCompanions } from './room-presets';
import { roomPresetDoorAt } from './room-preset-shapes';
import { corridorWalls } from './piece-variants';

export { snap45, pointInPolygon, polygonArea } from '@liveworkspace/avatar/room-outline';

/** How near a character's feet must be to a door's opening to swing it (room-builder.md "Opening and closing"). */
export const DOOR_REACH = 48;

/**
 * Whether a character's feet are next to a door (docs/specs/009-elements/room-builder.md "Opening and closing"):
 * within DOOR_REACH of the door's opening (the line across its gap, at the wall's centre line), on either side.
 */
export function isNextToDoor(feet: { x: number; y: number }, door: ShapeElement): boolean {
  if (door.shape !== 'door') return false;
  const { a, b } = doorLine(door);
  const wx = b.x - a.x;
  const wy = b.y - a.y;
  const len2 = wx * wx + wy * wy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((feet.x - a.x) * wx + (feet.y - a.y) * wy) / len2));
  return Math.hypot(feet.x - (a.x + wx * t), feet.y - (a.y + wy * t)) <= DOOR_REACH;
}

/** A door with its swing turned (`doorClosed` set when shut, removed when open, so an open door stores nothing). */
export function toggledDoor(door: ShapeElement): ShapeElement {
  if (door.doorClosed === true) {
    const { doorClosed: _open, ...rest } = door;
    return rest;
  }
  return { ...door, doorClosed: true };
}

/** A door within this many canvas px of a wall snaps onto it. */
export const DOOR_SNAP_REACH = 48;

/** Whether an element is a room drawn with the Room Builder: a room with an outline of three or more corners. */
export function isOutlinedRoom(el: Element): el is ShapeElement & { roomOutline: OutlinePoint[] } {
  return (
    el.type === 'shape' &&
    el.shape === 'room' &&
    Array.isArray(el.roomOutline) &&
    el.roomOutline.length >= 3
  );
}

/** A custom room's corners in canvas px. */
export function roomOutlinePoints(
  el: ShapeElement & { roomOutline: OutlinePoint[] },
): OutlinePoint[] {
  return el.roomOutline.map((p) => ({ x: el.x + p.x * el.width, y: el.y + p.y * el.height }));
}

/**
 * The room the Room Builder commits for these corners (canvas px, the walls' centre line), or null for fewer than
 * three distinct corners or no area: its box is the corners' bounds grown by half a wall, the corners stored as
 * fractions of it, aspect locked so a 45-degree wall stays 45 degrees.
 */
export function createOutlinedRoom(corners: readonly OutlinePoint[]): ShapeElement | null {
  const distinct = corners.filter(
    (p, i) => i === 0 || p.x !== corners[i - 1]!.x || p.y !== corners[i - 1]!.y,
  );
  const first = distinct[0];
  const last = distinct[distinct.length - 1];
  if (first && last && distinct.length > 1 && first.x === last.x && first.y === last.y)
    distinct.pop();
  if (distinct.length < 3) return null;
  const half = ROOM_WALL / 2;
  const xs = distinct.map((p) => p.x);
  const ys = distinct.map((p) => p.y);
  const x0 = Math.min(...xs) - half;
  const y0 = Math.min(...ys) - half;
  const width = Math.max(...xs) + half - x0;
  const height = Math.max(...ys) + half - y0;
  if (width <= ROOM_WALL || height <= ROOM_WALL) return null;
  const base = createShape('room', x0, y0);
  return {
    ...base,
    width,
    height,
    roomOutline: distinct.map((p) => ({ x: (p.x - x0) / width, y: (p.y - y0) / height })),
    // The doorway is the Door's job on a custom room.
    roomDoor: 'none',
    aspectLocked: true,
  };
}

/** Whether an element has walls a Door stands on: a Room, or a Corridor (docs/specs/009-elements/corridor.md). */
function isWalled(el: Element): el is ShapeElement {
  return el.type === 'shape' && (el.shape === 'room' || el.shape === 'corridor');
}

// A room's or a corridor's walls, uncut by any door.
function wallLines(el: ShapeElement) {
  if (el.shape === 'corridor') return corridorWalls(el);
  return isOutlinedRoom(el) ? outlineWalls(el, el.roomOutline) : roomWalls(el);
}

// Every room's and corridor's walls, uncut, with the piece each belongs to.
function wallsOf(elements: readonly Element[]) {
  const out: { room: ShapeElement; a: OutlinePoint; b: OutlinePoint }[] = [];
  for (const el of elements) {
    if (!isWalled(el)) continue;
    for (const w of wallLines(el)) out.push({ room: el, ...w });
  }
  return out;
}

/**
 * The door put onto the nearest room wall within DOOR_SNAP_REACH: centred on the wall's centre line, turned to its
 * angle, clear of the wall's ends, and in its room's floor colour (so the gap it paints matches the floor). The door
 * unchanged when no wall is near. Rooms in `skip` are not snapped to.
 */
export function snapDoorToWall(
  door: ShapeElement,
  elements: readonly Element[],
  skip: ReadonlySet<ElementId> = new Set(),
): ShapeElement {
  if (door.shape !== 'door') return door;
  const walls = wallsOf(elements).filter((w) => !skip.has(w.room.id));
  const centre = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
  const hit = nearestWall(centre, walls, DOOR_SNAP_REACH, door.width / 2);
  if (!hit) return door;
  const x = hit.at.x - door.width / 2;
  const y = hit.at.y - door.height / 2;
  const fill = walls[hit.index]!.room.fillColor;
  if (door.x === x && door.y === y && (door.rotation ?? 0) === hit.angle && door.fillColor === fill)
    return door;
  const next: ShapeElement = { ...door, x, y, rotation: hit.angle };
  if (fill) next.fillColor = fill;
  else delete next.fillColor;
  return next;
}

/** Each door among `ids` snapped onto its nearest wall (a door moved by a drag). Same array when nothing moved. */
export function snapMovedDoors(els: Element[], ids: { has(id: ElementId): boolean }): Element[] {
  let changed = false;
  const out = els.map((el) => {
    if (!ids.has(el.id) || el.type !== 'shape' || el.shape !== 'door') return el;
    const next = snapDoorToWall(el, els);
    if (next !== el) changed = true;
    return next;
  });
  return changed ? out : els;
}

/** Whether a door stands on one of the room's walls (so it rides the room's drag and cuts its wall). */
export function doorOnRoom(door: ShapeElement, room: ShapeElement): boolean {
  if (door.shape !== 'door' || !isWalled(room)) return false;
  const line = doorLine(door);
  return wallLines(room).some((w) => doorSpanOnWall(w, line) !== null);
}

/** `ids` plus every door standing on a wall of a room in `ids`: a moved room carries its doors. */
export function withAttachedDoors(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): ReadonlySet<ElementId> {
  const rooms = elements.filter((el): el is ShapeElement => isWalled(el) && ids.has(el.id));
  if (rooms.length === 0) return ids;
  let out: Set<ElementId> | null = null;
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'door' || ids.has(el.id)) continue;
    if (rooms.some((room) => doorOnRoom(el, room))) (out ??= new Set(ids)).add(el.id);
  }
  return out ?? ids;
}

/**
 * Whether a room still has a doorway of its own (docs/specs/009-elements/office.md "Older rooms keep their built-in
 * doorway"): a rectangular Room whose `roomDoor` is absent or a wall. A new Room, and every custom room, has none: its
 * doors are Door pieces.
 */
export function hasBuiltInDoorway(el: Element): boolean {
  return (
    el.type === 'shape' &&
    el.shape === 'room' &&
    !isOutlinedRoom(el) &&
    (el.roomDoor ?? DEFAULT_ROOM_DOOR) !== 'none'
  );
}

// The middle of a rectangular room's wall, on the wall's centre line (where roomWalls draws it).
function wallMiddle(room: ShapeElement, side: Exclude<RoomDoor, 'none'>): OutlinePoint {
  const half = ROOM_WALL / 2;
  const { x, y, width: w, height: h } = room;
  if (side === 'n') return { x: x + w / 2, y: y + ROOM_BACK_FACE - half };
  if (side === 's') return { x: x + w / 2, y: y + h - half };
  if (side === 'w') return { x: x + half, y: y + h / 2 };
  return { x: x + w - half, y: y + h / 2 };
}

/**
 * A rectangular Room's own doorway handed to a Door piece (docs/specs/009-elements/office.md "The doorway is a Door"):
 * the room with `roomDoor: 'none'`, and a Door standing in the middle of the wall its doorway was in (the front wall
 * when `roomDoor` is absent), snapped onto that wall in the room's floor colour and the room's stroke. `door` is null
 * when the room had no doorway, or its wall is too short to take a door (shorter than the door and two wall ends). A
 * custom room, or anything that is not a room, comes back unchanged with no door.
 */
export function roomWithDoorPiece(room: ShapeElement): {
  room: ShapeElement;
  door: ShapeElement | null;
} {
  if (room.shape !== 'room' || isOutlinedRoom(room)) return { room, door: null };
  const side = room.roomDoor ?? DEFAULT_ROOM_DOOR;
  const closed: ShapeElement = { ...room, roomDoor: 'none' };
  if (side === 'none') return { room: closed, door: null };
  const base = createShape('door', 0, 0);
  // A wall shorter than a door between two wall ends takes none (the built-in doorway was squeezed to a sliver there).
  const length = side === 'n' || side === 's' ? room.width : room.height;
  if (length < base.width + 2 * ROOM_WALL) return { room: closed, door: null };
  const at = wallMiddle(room, side);
  const free: ShapeElement = {
    ...base,
    x: at.x - base.width / 2,
    y: at.y - base.height / 2,
    ...(room.strokeColor ? { strokeColor: room.strokeColor } : {}),
  };
  // Already on the wall's centre line, clear of its ends: the snap only turns it and gives it the floor colour.
  return { room: closed, door: snapDoorToWall(free, [closed]) };
}

/**
 * A newly added element, plus the Door a new Room comes with (`roomWithDoorPiece`) and, placed from a room preset's tile
 * (`variant`), the pieces the preset furnishes it with (`roomPresetCompanions`); anything else on its own.
 */
export function withDoorPiece(el: Element, variant?: string): Element[] {
  if (el.type !== 'shape' || el.shape !== 'room') return [el];
  const { room, door } = roomWithDoorPiece(el);
  const shaped = door ? null : presetDoor(room, variant);
  return [
    room,
    ...(door ? [door] : []),
    ...(shaped ? [shaped] : []),
    ...roomPresetCompanions(room, variant),
  ];
}

// A shaped room preset's Door (docs/specs/009-elements/office.md "Room presets"), stood on the wall its preset names
// and snapped onto it in the room's stroke and floor; null for any other room.
function presetDoor(room: ShapeElement, variant: string | undefined): ShapeElement | null {
  const at = roomPresetDoorAt(room, variant);
  if (!at) return null;
  const base = createShape('door', 0, 0);
  const free: ShapeElement = {
    ...base,
    x: at.x - base.width / 2,
    y: at.y - base.height / 2,
    ...(room.strokeColor ? { strokeColor: room.strokeColor } : {}),
  };
  return snapDoorToWall(free, [room]);
}

// A room's walls, uncut by any built-in doorway, in an order that survives a resize (a rectangle's four sides, a
// custom room's outline walls, a corridor's runs).
function wholeWalls(room: ShapeElement) {
  if (room.shape === 'corridor') return corridorWalls(room);
  return isOutlinedRoom(room)
    ? outlineWalls(room, room.roomOutline)
    : roomWalls({ ...room, roomDoor: 'none', roomOutline: undefined });
}

/**
 * The Doors standing on a room's walls carried through the room's resize (docs/specs/009-elements/room-builder.md
 * "It rides its room"): for every room whose box changed between `before` and `after`, each door that stood on one of
 * its walls keeps its place along that wall as a fraction of the wall's length, clamped clear of the wall's ends, and
 * turns with it. Derived, not stored: a door is on a wall when it stands on it, so older doors follow too. `after`
 * unchanged (the same array) when no room changed or no door stood on one.
 */
export function doorsFollowRooms(before: readonly Element[], after: Element[]): Element[] {
  const was = new Map<ElementId, ShapeElement>();
  for (const el of before) if (isWalled(el)) was.set(el.id, el);
  const changed: { from: ShapeElement; to: ShapeElement }[] = [];
  for (const el of after) {
    if (!isWalled(el)) continue;
    const from = was.get(el.id);
    if (
      from &&
      from !== el &&
      (from.x !== el.x || from.y !== el.y || from.width !== el.width || from.height !== el.height)
    )
      changed.push({ from, to: el });
  }
  if (changed.length === 0) return after;
  let out: Element[] | null = null;
  for (const [i, el] of after.entries()) {
    if (el.type !== 'shape' || el.shape !== 'door') continue;
    const centre = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    for (const { from, to } of changed) {
      const hit = nearestWall(centre, wholeWalls(from), 1);
      if (!hit) continue;
      const a = wholeWalls(from)[hit.index]!;
      const b = wholeWalls(to)[hit.index];
      if (!b) break;
      const lenA = Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y) || 1;
      const t =
        ((hit.at.x - a.a.x) * (a.b.x - a.a.x) + (hit.at.y - a.a.y) * (a.b.y - a.a.y)) / lenA ** 2;
      const lenB = Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y);
      const half = el.width / 2;
      const margin = lenB > 2 * half ? half / lenB : 0.5;
      const u = Math.max(margin, Math.min(1 - margin, t));
      const at = { x: b.a.x + (b.b.x - b.a.x) * u, y: b.a.y + (b.b.y - b.a.y) * u };
      const moved = snapDoorToWall({ ...el, x: at.x - half, y: at.y - el.height / 2 }, [to]);
      (out ??= [...after])[i] = moved;
      break;
    }
  }
  return out ?? after;
}

// --- Drawing -----------------------------------------------------------------

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A custom room's drawing in its own px (0..width, 0..height): the floor polygon and the walls' centre line, both
 * closed paths. The walls are stroked ROOM_WALL wide along the line, mitred, by the canvas and the export alike.
 */
export function outlinedRoomPaths(el: {
  width: number;
  height: number;
  roomOutline: readonly OutlinePoint[];
}): { floor: string; walls: string } {
  const d =
    el.roomOutline
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x * el.width)} ${r2(p.y * el.height)}`)
      .join(' ') + ' Z';
  return { floor: d, walls: d };
}

/**
 * A door's drawing in its own px, the wall's centre line along y = height / 2: the gap it paints over the wall (in
 * the floor), a jamb at each end, the leaf standing open at a right angle and its swing arc.
 */
export function doorParts(
  width: number,
  height: number,
): {
  gap: { x: number; y: number; w: number; h: number };
  jambs: { x: number; y: number; w: number; h: number }[];
  leaf: { x: number; y: number; w: number; h: number };
  // The leaf closed: lying across the opening along the wall's centre line, hinged where the open leaf is.
  shut: { x: number; y: number; w: number; h: number };
  swing: string;
} {
  const mid = height / 2;
  const jamb = Math.min(6, width / 4);
  const reach = Math.max(0, width - 2 * jamb);
  return {
    gap: { x: 0, y: r2(mid - ROOM_WALL / 2 - 1.5), w: width, h: ROOM_WALL + 3 },
    jambs: [
      { x: 0, y: r2(mid - ROOM_WALL / 2), w: jamb, h: ROOM_WALL },
      { x: r2(width - jamb), y: r2(mid - ROOM_WALL / 2), w: jamb, h: ROOM_WALL },
    ],
    leaf: { x: r2(jamb), y: r2(mid), w: 3, h: r2(reach) },
    shut: { x: r2(jamb), y: r2(mid - 1.5), w: r2(reach), h: 3 },
    swing: `M${r2(width - jamb)} ${r2(mid)} A${r2(reach)} ${r2(reach)} 0 0 1 ${r2(jamb + 1.5)} ${r2(mid + reach)}`,
  };
}
