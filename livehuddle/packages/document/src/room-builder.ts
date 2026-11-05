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
import { ROOM_WALL, roomWalls } from '@liveworkspace/avatar/office-geometry';
import type { Element, ElementId, ShapeElement } from './index';
import { createShape } from './shape-factory';

export { snap45, pointInPolygon, polygonArea } from '@liveworkspace/avatar/room-outline';

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

// Every room's walls, uncut, with the room each belongs to.
function wallsOf(elements: readonly Element[]) {
  const out: { room: ShapeElement; a: OutlinePoint; b: OutlinePoint }[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'room') continue;
    const walls = isOutlinedRoom(el) ? outlineWalls(el, el.roomOutline) : roomWalls(el);
    for (const w of walls) out.push({ room: el, ...w });
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
  if (door.shape !== 'door' || room.shape !== 'room') return false;
  const line = doorLine(door);
  const walls = isOutlinedRoom(room) ? outlineWalls(room, room.roomOutline) : roomWalls(room);
  return walls.some((w) => doorSpanOnWall(w, line) !== null);
}

/** `ids` plus every door standing on a wall of a room in `ids`: a moved room carries its doors. */
export function withAttachedDoors(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): ReadonlySet<ElementId> {
  const rooms = elements.filter(
    (el): el is ShapeElement => el.type === 'shape' && el.shape === 'room' && ids.has(el.id),
  );
  if (rooms.length === 0) return ids;
  let out: Set<ElementId> | null = null;
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'door' || ids.has(el.id)) continue;
    if (rooms.some((room) => doorOnRoom(el, room))) (out ??= new Set(ids)).add(el.id);
  }
  return out ?? ids;
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
    swing: `M${r2(width - jamb)} ${r2(mid)} A${r2(reach)} ${r2(reach)} 0 0 1 ${r2(jamb + 1.5)} ${r2(mid + reach)}`,
  };
}
