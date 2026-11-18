// Which walls the 3D view draws and which it cuts away (docs/specs/008-canvas/3d-view.md "Walls in front of you are
// cut away", "Performance"; blueprint: 3d-view.md). Pure: no React, no DOM.

import { boxToCamera, toCamera } from './space-3d-turn';
import type { SpaceWall } from './space-3d-walls';

/** How far to either side of your feet a wall in front of you is cut away, in canvas px (DEFAULTS.md D138). */
export const SPACE_CUT_HALF_WIDTH = 72;
/** How far in front of your feet (down the screen) a wall is cut away, in canvas px (DEFAULTS.md D138). */
export const SPACE_CUT_DEPTH = 150;
/** A cut-away wall's opacity. */
export const SPACE_CUT_OPACITY = 0.18;

// The area drawn, in screens at the zoom (DEFAULTS.md D139).
export const SPACE_AREA_SIDE = 1.5;
export const SPACE_AREA_AHEAD = 3;
export const SPACE_AREA_BEHIND = 1.5;

type Point = { x: number; y: number };

export type SpaceArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  // The canvas point at the screen's middle and the zoom the area was worked out at.
  centre: Point;
  zoom: number;
  width: number;
  height: number;
};

// Liang-Barsky, one edge: narrows [t0, t1] to where the segment is inside it; false once nothing is left.
const clip = { t0: 0, t1: 1 };
function clipEdge(p: number, q: number): boolean {
  if (p === 0) return q >= 0;
  const r = q / p;
  if (p < 0) {
    if (r > clip.t0) clip.t0 = r;
  } else if (r < clip.t1) clip.t1 = r;
  return clip.t0 <= clip.t1;
}

// Does the segment a-b pass through the box? Allocates nothing: it runs for every wall on every move.
function segmentMeetsBox(
  a: Point,
  b: Point,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  // Most walls are nowhere near: their bounding box misses the box.
  if (Math.max(a.x, b.x) < left || Math.min(a.x, b.x) > right) return false;
  if (Math.max(a.y, b.y) < top || Math.min(a.y, b.y) > bottom) return false;
  clip.t0 = 0;
  clip.t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (
    clipEdge(-dx, a.x - left) &&
    clipEdge(dx, right - a.x) &&
    clipEdge(-dy, a.y - top) &&
    clipEdge(dy, bottom - a.y)
  );
}

export type SpaceRoom = { id: string; x: number; y: number; width: number; height: number };

// How close to a room's edge a doorway or window stands to be in that room's wall, in canvas px.
const ROOM_EDGE = 16;

/** The rooms and pods on the board, unturned (a turned room's box is not its walls). */
export function spaceRooms(
  elements: readonly {
    id: string;
    type: string;
    shape?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }[],
): SpaceRoom[] {
  const out: SpaceRoom[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || (el.shape !== 'room' && el.shape !== 'office-pod')) continue;
    if (el.rotation) continue;
    out.push({
      id: el.id,
      x: el.x ?? 0,
      y: el.y ?? 0,
      width: el.width ?? 0,
      height: el.height ?? 0,
    });
  }
  return out;
}

/** How near a room your feet must come for its walls facing the camera to fade, in canvas px. */
export const SPACE_ROOM_NEAR = 96;

/** The rooms whose box holds the feet or lies within SPACE_ROOM_NEAR of them. */
function roomsNear(rooms: readonly SpaceRoom[], feet: Point): SpaceRoom[] {
  return rooms.filter(
    (r) =>
      feet.x > r.x - SPACE_ROOM_NEAR &&
      feet.x < r.x + r.width + SPACE_ROOM_NEAR &&
      feet.y > r.y - SPACE_ROOM_NEAR &&
      feet.y < r.y + r.height + SPACE_ROOM_NEAR,
  );
}

/** Whether a wall is one of the room's own: its walls, or a doorway or window standing on its edge. */
function inRoomWall(wall: SpaceWall, room: SpaceRoom): boolean {
  if (wall.id.startsWith(`${room.id}:`)) return true;
  if (wall.kind !== 'doorway' && wall.kind !== 'window') return false;
  const m = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const { x, y, width, height } = room;
  if (m.x < x - ROOM_EDGE || m.x > x + width + ROOM_EDGE) return false;
  if (m.y < y - ROOM_EDGE || m.y > y + height + ROOM_EDGE) return false;
  return (
    Math.abs(m.x - x) <= ROOM_EDGE ||
    Math.abs(m.x - x - width) <= ROOM_EDGE ||
    Math.abs(m.y - y) <= ROOM_EDGE ||
    Math.abs(m.y - y - height) <= ROOM_EDGE
  );
}

/**
 * The ids of the walls standing in front of your feet, which fade so they never hide you. None without feet. In or near
 * a room, its walls on the camera's side fade too, so you see into the whole room and can choose to go in (3d-view.md
 * "Walls in front of you are cut away").
 */
export function cutAwayIds(
  walls: readonly SpaceWall[],
  feet: Point | null,
  // The camera's quarter turns (3d-view.md "Turning the camera"): in front is the camera's way.
  turn = 0,
  rooms: readonly SpaceRoom[] = [],
): Set<string> {
  const out = new Set<string>();
  if (!feet) return out;
  // The cut-away box sits in front of the feet as the camera sees them. A quarter turn keeps a box a box, so it is
  // turned back onto the plan once, and every wall is tested where it stands (none is turned, nothing allocated).
  const f = toCamera(feet, turn);
  const box = boxToCamera(
    {
      x: f.x - SPACE_CUT_HALF_WIDTH,
      y: f.y,
      width: SPACE_CUT_HALF_WIDTH * 2,
      height: SPACE_CUT_DEPTH,
    },
    -turn,
  );
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  // Towards the camera, on the plan: one axis, so a wall's side and run are read from its plan points as they stand.
  const toward = toCamera({ x: 0, y: 1 }, -turn);
  const level = toward.x === 0;
  const near = roomsNear(rooms, feet).map((room) => ({
    room,
    middle: (room.x + room.width / 2) * toward.x + (room.y + room.height / 2) * toward.y,
  }));
  // Blades of grass are too low to hide anyone: never cut.
  for (const wall of walls) {
    if (wall.kind === 'grass') continue;
    if (segmentMeetsBox(wall.a, wall.b, box.x, box.y, right, bottom)) {
      out.add(wall.id);
      continue;
    }
    if (near.length === 0) continue;
    // A wall across the view (level when the camera looks up or down the plan, upright when it looks across)...
    const dx = Math.abs(wall.b.x - wall.a.x);
    const dy = Math.abs(wall.b.y - wall.a.y);
    if (level ? dx < dy : dy < dx) continue;
    // ...on the camera's side of a near room's middle, and that room's own.
    const at = ((wall.a.x + wall.b.x) / 2) * toward.x + ((wall.a.y + wall.b.y) / 2) * toward.y;
    if (near.some((n) => at > n.middle && inRoomWall(wall, n.room))) out.add(wall.id);
  }
  return out;
}

/** The canvas area whose walls are drawn, for a view on a canvas of `size`. */
export function viewArea(
  view: { zoom: number; offset: Point },
  size: { width: number; height: number },
): SpaceArea {
  const w = size.width / view.zoom;
  const h = size.height / view.zoom;
  // The canvas point at the screen's middle: the flat view's `scale(zoom) translate(offset)` about the centre.
  const centre = { x: size.width / 2 - view.offset.x, y: size.height / 2 - view.offset.y };
  return {
    left: centre.x - w * SPACE_AREA_SIDE,
    right: centre.x + w * SPACE_AREA_SIDE,
    top: centre.y - h * SPACE_AREA_AHEAD,
    bottom: centre.y + h * SPACE_AREA_BEHIND,
    centre,
    zoom: view.zoom,
    width: size.width,
    height: size.height,
  };
}

/**
 * The area for a turned camera (3d-view.md "Turning the camera"): ahead may be any side, so from the same middle it
 * reaches as far as ahead does every way.
 */
export function turnedArea(area: SpaceArea): SpaceArea {
  const reach = (Math.max(area.width, area.height) / area.zoom) * SPACE_AREA_AHEAD;
  const { centre } = area;
  return {
    ...area,
    left: centre.x - reach,
    right: centre.x + reach,
    top: centre.y - reach,
    bottom: centre.y + reach,
  };
}

/** The walls whose bounding box meets the area. */
export function wallsInArea(walls: readonly SpaceWall[], area: SpaceArea): SpaceWall[] {
  return walls.filter(
    (w) =>
      Math.max(w.a.x, w.b.x) >= area.left &&
      Math.min(w.a.x, w.b.x) <= area.right &&
      Math.max(w.a.y, w.b.y) >= area.top &&
      Math.min(w.a.y, w.b.y) <= area.bottom,
  );
}

/**
 * Whether the drawn area is due to be chosen again: the view's middle has moved a quarter of the area's side from
 * where it was chosen, or the zoom or the canvas's size has changed.
 */
export function areaMovedFar(area: SpaceArea, next: SpaceArea): boolean {
  if (area.zoom !== next.zoom || area.width !== next.width || area.height !== next.height)
    return true;
  const w = area.width / area.zoom;
  const h = area.height / area.zoom;
  return (
    Math.abs(next.centre.x - area.centre.x) > (w * SPACE_AREA_SIDE) / 2 ||
    Math.abs(next.centre.y - area.centre.y) > (h * SPACE_AREA_BEHIND) / 2
  );
}
