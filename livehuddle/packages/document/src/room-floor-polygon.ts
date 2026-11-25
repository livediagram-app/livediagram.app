// A Room's floor as drawn (docs/specs/009-elements/office.md "A Room turns"): a turned room's floor is its interior's
// corners turned about its centre, and a Room Builder room's (room-builder.md) is its outline (turned too, when it
// is). The room's call (call-geometry.ts), the office dog (pet-wander.ts), the Receptionist and the Jukebox all read
// this one polygon, so they agree on where the room's floor is. An upright box room has none: its callers keep their
// box test. Pure: no React, no DOM. Work each room's polygon out once per board change, never per frame.

import { rotatePoint } from '@liveworkspace/model-core/geometry-primitives';
import { roomInterior } from '@livehuddle/avatar/office-geometry';
import { pointInPolygon } from '@livehuddle/avatar/room-outline';
import { isRoomOutline } from './room-outline-field';

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

/** What a room's floor is read from: its box, its turn and its outline. */
export type RoomFloorSource = Box & {
  readonly rotation?: unknown;
  readonly roomOutline?: unknown;
};

/** A room's turn when it is turned: a finite number of degrees that is not a whole turn, else null. */
export function roomTurn(room: { readonly rotation?: unknown }): number | null {
  const r = room.rotation;
  return typeof r === 'number' && Number.isFinite(r) && r % 360 !== 0 ? r : null;
}

const centreOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * A room's floor as drawn, in canvas px: its outline, or its interior's corners, turned by its turn. Null for an
 * upright box room (its floor is `roomInterior`, a box) and for a turned one with no floor inside its walls.
 */
export function roomFloorPolygon(room: RoomFloorSource): Point[] | null {
  const turn = roomTurn(room);
  const outline = isRoomOutline(room.roomOutline) ? room.roomOutline : null;
  if (turn === null && !outline) return null;
  let polygon: Point[];
  if (outline) {
    polygon = outline.map((p) => ({ x: room.x + p.x * room.width, y: room.y + p.y * room.height }));
  } else {
    const f = roomInterior(room);
    if (f.width <= 0 || f.height <= 0) return null;
    polygon = [
      { x: f.x, y: f.y },
      { x: f.x + f.width, y: f.y },
      { x: f.x + f.width, y: f.y + f.height },
      { x: f.x, y: f.y + f.height },
    ];
  }
  if (turn === null) return polygon;
  const c = centreOf(room);
  return polygon.map((p) => rotatePoint(p, c, turn));
}

/** A room's whole box (walls and all) as drawn: its four corners turned, or null when it is upright. */
export function turnedRoomBox(room: RoomFloorSource): Point[] | null {
  const turn = roomTurn(room);
  if (turn === null) return null;
  const c = centreOf(room);
  const { x, y, width: w, height: h } = room;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((p) => rotatePoint(p, c, turn));
}

/** Where a point of a room standing upright is once the room turns (itself for an upright room). */
export function turnRoomPoint(room: RoomFloorSource, p: Point): Point {
  const turn = roomTurn(room);
  return turn === null ? p : rotatePoint(p, centreOf(room), turn);
}

/** The axis-aligned box round a polygon. */
export function polygonBounds(polygon: readonly Point[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of polygon) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// The squared distance from `p` to the segment a-b.
function segmentDistanceSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  const ex = a.x + t * dx - p.x;
  const ey = a.y + t * dy - p.y;
  return ex * ex + ey * ey;
}

/** Whether `p` is inside `polygon` and at least `inset` px from every one of its edges. */
export function insidePolygonBy(p: Point, polygon: readonly Point[], inset: number): boolean {
  if (!pointInPolygon(p, polygon)) return false;
  if (inset <= 0) return true;
  const min = inset * inset;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentDistanceSq(p, polygon[j]!, polygon[i]!) < min) return false;
  }
  return true;
}

/**
 * Whether a floor polygon has room for anything kept `inset` px off its walls: its bounds are wider and taller than
 * two insets, and a four-cornered floor (a turned box room's) holds its middle that far in, which for a rectangle is
 * exactly whether any spot does.
 */
export function floorHasRoom(polygon: readonly Point[], inset: number): boolean {
  const b = polygonBounds(polygon);
  if (b.width <= 2 * inset || b.height <= 2 * inset) return false;
  return polygon.length !== 4 || insidePolygonBy(centreOf(b), polygon, inset);
}

/**
 * A spot inside `polygon`, `inset` px clear of its edges, from the generator's next numbers: drawn in `bounds`, two
 * numbers a draw, the first of `draws` that lands inside, or null when none does. The same generator gives the same
 * spot on every screen.
 */
export function drawInPolygon(
  polygon: readonly Point[],
  bounds: Box,
  inset: number,
  next: () => number,
  draws: number,
): Point | null {
  for (let i = 0; i < draws; i += 1) {
    const p = { x: bounds.x + next() * bounds.width, y: bounds.y + next() * bounds.height };
    if (insidePolygonBy(p, polygon, inset)) return p;
  }
  return null;
}
