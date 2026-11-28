// Which walls the 3D view draws and which it cuts away (docs/specs/008-canvas/3d-view.md "Walls in front of you are
// cut away", "Performance"; blueprint: 3d-view.md). Pure: no React, no DOM.

import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import { WALL_RISE } from '../real-3d/models/kit';
// space-3d-turn before space-3d-camera: they import each other, and the turn's tilt store reads the camera's resting
// tilt as it loads.
import { boxToCamera, toCamera } from './space-3d-turn';
import { SPACE_3D_TILT_DEG } from './space-3d-camera';
import { SPACE_WALL_HEIGHT, type SpaceWall } from './space-3d-walls';

/** How far to either side of your feet a wall in front of you is cut away, in canvas px (DEFAULTS.md D138). */
export const SPACE_CUT_HALF_WIDTH = 72;

/**
 * How much floor a wall `height` tall (as built, before `WALL_RISE`) hides behind it at a camera tilt of `tiltDeg` from
 * straight down, in canvas px: the sight line from a floor point to the camera rises one unit for every tan(tilt) it
 * runs, so a wall closer than its risen height times tan(tilt) stands in it (DEFAULTS.md D138). The 3D view cuts a
 * wall that close in front of your feet.
 */
export function cutDepth(height: number, tiltDeg = SPACE_3D_TILT_DEG): number {
  return height * WALL_RISE * Math.tan((Math.max(0, Math.min(89, tiltDeg)) * Math.PI) / 180);
}

/** How far in front of your feet a full-height Room wall is cut away at the resting tilt: about 233 canvas px. */
export const SPACE_CUT_DEPTH = cutDepth(SPACE_WALL_HEIGHT);
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
    // A Room's back wall stands in from its box's top (ROOM_BACK_FACE), and its windows and doorways with it.
    Math.abs(m.y - (y + ROOM_BACK_FACE - ROOM_WALL / 2)) <= ROOM_EDGE ||
    Math.abs(m.y - y - height) <= ROOM_EDGE
  );
}

/**
 * Whether a wall runs across the view at the camera's quarter `turn` (level on screen), so it can stand between the
 * camera and you. A side wall runs towards the camera and never hides you, so it is never cut, by the cut-away box or
 * by the sight line from your head (the owner, 2026-11-27: a side wall "shouldn't have hidden because it covered
 * nothing").
 */
export function acrossView(wall: { a: Point; b: Point }, turn = 0): boolean {
  const dx = Math.abs(wall.b.x - wall.a.x);
  const dy = Math.abs(wall.b.y - wall.a.y);
  return turn % 2 === 0 ? dx >= dy : dy >= dx;
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
  // The camera's tilt from straight down, in degrees: how much floor each wall hides (`cutDepth`).
  tiltDeg = SPACE_3D_TILT_DEG,
): Set<string> {
  const out = new Set<string>();
  if (!feet) return out;
  // The cut-away box sits in front of the feet as the camera sees them, as deep as the floor the wall hides at this
  // tilt (a Pod's lower walls hide less). A quarter turn keeps a box a box, so it is turned back onto the plan once per
  // wall height (a board has a handful), and every wall is tested where it stands (none is turned).
  const f = toCamera(feet, turn);
  const boxes = new Map<number, { x: number; y: number; right: number; bottom: number }>();
  const boxFor = (height: number) => {
    let b = boxes.get(height);
    if (!b) {
      const box = boxToCamera(
        {
          x: f.x - SPACE_CUT_HALF_WIDTH,
          y: f.y,
          width: SPACE_CUT_HALF_WIDTH * 2,
          height: cutDepth(height, tiltDeg),
        },
        -turn,
      );
      b = { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
      boxes.set(height, b);
    }
    return b;
  };
  // Towards the camera, on the plan: one axis, so a wall's side and run are read from its plan points as they stand.
  const toward = toCamera({ x: 0, y: 1 }, -turn);
  const near = roomsNear(rooms, feet).map((room) => ({
    room,
    middle: (room.x + room.width / 2) * toward.x + (room.y + room.height / 2) * toward.y,
  }));
  // Blades of grass and fences are too low to hide anyone: never cut (a ghosted fence you walked along read as a
  // hairline, the owner 2026-11-25).
  for (const wall of walls) {
    if (wall.kind === 'grass' || wall.kind === 'fence' || wall.kind === 'picket') continue;
    // Only a wall across the view (level when the camera looks up or down the plan, upright when it looks across) can
    // stand between the camera and you. A side wall running towards the camera never hides you, so it never fades:
    // walking near a room's left or right wall used to drop it, and with it the whole side (the owner, 2026-11-27:
    // "why does the left wall of a room drop so often for no reason?").
    if (!acrossView(wall, turn)) continue;
    const box = boxFor(wall.height);
    if (segmentMeetsBox(wall.a, wall.b, box.x, box.y, box.right, box.bottom)) {
      out.add(wall.id);
      continue;
    }
    if (near.length === 0) continue;
    // ...on the camera's side of a near room's middle, and that room's own.
    const at = ((wall.a.x + wall.b.x) / 2) * toward.x + ((wall.a.y + wall.b.y) / 2) * toward.y;
    if (near.some((n) => at > n.middle && inRoomWall(wall, n.room))) out.add(wall.id);
  }
  // Each piece on its own: a door or a window splits a side into separate walls, and only those in your way fade
  // (the owner, 2026-11-27: "doors and windows should cause walls to be split into separate objects").
  return out;
}

// The last front walls worked out: the walls only change with the board, the turn with the camera, so a frame that
// changed neither asks again for free.
let frontMemo: {
  walls: readonly SpaceWall[];
  rooms: readonly SpaceRoom[];
  turn: number;
  ids: ReadonlySet<string>;
} | null = null;

/**
 * Every room's walls on the camera's side (its front wall as the camera is turned, with the doorways and windows in
 * it): editing cuts them all down, so the whole floor plan is in reach, as every roof is off (3d-view.md "Editing in
 * 3D"). Only walls across the view, as for the cut-away: a side wall never hides the floor.
 */
export function frontWallIds(
  walls: readonly SpaceWall[],
  rooms: readonly SpaceRoom[],
  turn = 0,
): ReadonlySet<string> {
  if (
    frontMemo &&
    frontMemo.walls === walls &&
    frontMemo.rooms === rooms &&
    frontMemo.turn === turn
  )
    return frontMemo.ids;
  const ids = new Set<string>();
  const toward = toCamera({ x: 0, y: 1 }, -turn);
  const middles = rooms.map(
    (room) => (room.x + room.width / 2) * toward.x + (room.y + room.height / 2) * toward.y,
  );
  for (const wall of walls) {
    if (wall.kind === 'grass' || wall.kind === 'fence' || wall.kind === 'picket') continue;
    if (!acrossView(wall, turn)) continue;
    const at = ((wall.a.x + wall.b.x) / 2) * toward.x + ((wall.a.y + wall.b.y) / 2) * toward.y;
    for (let i = 0; i < rooms.length; i++)
      if (at > middles[i]! && inRoomWall(wall, rooms[i]!)) {
        ids.add(wall.id);
        break;
      }
  }
  frontMemo = { walls, rooms, turn, ids };
  return ids;
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
