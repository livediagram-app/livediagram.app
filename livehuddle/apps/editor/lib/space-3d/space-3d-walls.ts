// The walls the 3D view stands up (docs/specs/008-canvas/3d-view.md "What it shows"; blueprint: 3d-view.md): the same
// lines walking is stopped by (@livehuddle/avatar's collision), each a face on the floor from `a` to `b`, with the
// doorways cut out and a shut Door standing in its gap. Built once per board change, never per frame. Pure.

import { SPACE_STAGE_LIFT } from './space-3d-pieces';
import { isGlassRoom, type Element } from '@livehuddle/document';
import { roomWalls, type WallSegment } from '@livehuddle/avatar/office-geometry';
import { cutByDoors, doorLine, doorSpanOnWall } from '@livehuddle/avatar/room-outline';
import { corridorWalls } from '@livehuddle/avatar/corridor';
import { podWalls } from '@livehuddle/avatar/pod';
import { fenceLine } from '@livehuddle/avatar/fence';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';

/**
 * A Room or Corridor wall stands as tall as the tallest piece that stands against it (a Toilet Cubicle, 152), so a
 * bookshelf, a fridge or a Screen on it never rises over its top (DEFAULTS.md D137).
 */
export const SPACE_WALL_HEIGHT = 152;
/** An Office Pod is a booth: its walls stand a little over a character, so its furniture shows over them. */
export const SPACE_POD_WALL_HEIGHT = Math.round(AVATAR_HEIGHT * 1.3);
/** A Fence is a low run. */
export const SPACE_FENCE_HEIGHT = 22;
/** A doorway's opening, and so a shut Door's leaf: a lintel of wall stands over it. */
export const SPACE_DOOR_HEIGHT = 96;

export type SpaceWallKind =
  'wall' | 'glass' | 'fence' | 'picket' | 'doorway' | 'window' | 'grass' | 'stage';

/** How tall a row of grass blades pokes up from a lawn. */
export const SPACE_GRASS_HEIGHT = 7;
/** How far apart the rows of blades stand across a lawn, and how far in from its rounded edge they start. */
export const SPACE_GRASS_ROW = 22;
const GRASS_INSET = 10;

type Point = { x: number; y: number };

export type SpaceWall = {
  id: string;
  a: Point;
  b: Point;
  kind: SpaceWallKind;
  height: number;
  // 0 facing the camera, 1 running straight away from it: how far the face is shaded.
  shade: number;
  // A Room's name: over its doorway, on the lintel, or on its back wall when it has no doorway.
  label?: string;
  // A doorway's Door is shut: its leaf stands in the frame.
  shut?: boolean;
  // A doorway's Door, by id: a press on its frame or leaf is a press on the door (3d-view.md "Doorways").
  doorId?: string;
  // An open Door's leaf stands out of the wall at its hinge, swung the way the plan draws it: hinged at the face's
  // `start` (its `a`) or `end`, swung to the face's `front` (the camera's side) or `back`. Always the two together.
  hinge?: 'start' | 'end';
  // A doorway in a glass wall: the panel over its frame is glass, as the wall is (3d-view.md "Doorways").
  glass?: boolean;
};

// A wall within this of level can carry a room's name (DEFAULTS.md D140).
const LABEL_LEVEL_SIN = Math.sin((30 * Math.PI) / 180);

const HEIGHT: Record<SpaceWallKind, number> = {
  wall: SPACE_WALL_HEIGHT,
  glass: SPACE_WALL_HEIGHT,
  fence: SPACE_FENCE_HEIGHT,
  picket: SPACE_FENCE_HEIGHT,
  grass: SPACE_GRASS_HEIGHT,
  doorway: SPACE_WALL_HEIGHT,
  window: SPACE_WALL_HEIGHT,
  stage: SPACE_STAGE_LIFT,
};

type Shape = Extract<Element, { type: 'shape' }>;

const isShape = (el: Element): el is Shape => el.type === 'shape';

/** Every wall the 3D view stands up, in board order. */
export function spaceWalls(elements: readonly Element[]): SpaceWall[] {
  const shapes = elements.filter(isShape);
  const doors = shapes.filter((el) => el.shape === 'door');
  const doorLines = doors.map((el) => doorLine(el));
  // A Window is a box on a wall as a Door is: its line across the wall (room-builder.md "Window").
  const windowLines = shapes.filter((el) => el.shape === 'window').map((el) => doorLine(el));
  const out: SpaceWall[] = [];
  // What lies over a lawn: no blade pokes up through a room's floor, a path, a rug or water.
  const covers = shapes.filter((el) => COVERS_GRASS.has(el.shape));
  // Every wall a door can stand on, so a shut door is drawn only where it really closes a gap.
  const doorable: WallSegment[] = [];
  // The plaster walls a window can stand in (a glass room's walls are glass throughout).
  const plaster: WallSegment[] = [];
  // The glass walls a Door can stand in: its doorway's panel over the frame is glass too.
  const glassy: WallSegment[] = [];
  // Each doorable wall's named room, as its place in `named` (-1 for a corridor or an unnamed room), in step with
  // `doorable`.
  const doorableRoom: number[] = [];
  // Each named room's walls in `out`, to put its name on its back wall when no doorway carries it.
  const named: { from: number; to: number; label: string; done: boolean }[] = [];
  for (const el of shapes) {
    const push = (segs: readonly WallSegment[], kind: SpaceWallKind) => {
      segs.forEach((s, i) => {
        const wall = facingCamera(`${el.id}:${i}`, s, kind);
        if (wall) out.push(wall);
      });
    };
    // A Stage stands up (3d-view.md "A stage stands up"): its top rises (app/space-3d.css) on four wooden sides.
    if (el.shape === 'stage') {
      const { x, y, width: w, height: h } = el;
      push(
        [
          { a: { x, y }, b: { x: x + w, y } },
          { a: { x: x + w, y }, b: { x: x + w, y: y + h } },
          { a: { x: x + w, y: y + h }, b: { x, y: y + h } },
          { a: { x, y: y + h }, b: { x, y } },
        ],
        'stage',
      );
      continue;
    }
    if (el.shape === 'room') {
      const walls = roomWalls(el);
      doorable.push(...walls);
      if (!isGlassRoom(el)) plaster.push(...walls);
      else glassy.push(...walls);
      const label = typeof el.label === 'string' ? el.label.trim() : '';
      const glass = isGlassRoom(el);
      // A plaster wall's windows are cut out of it and stand as windows; a glass wall is all window already.
      const open = cutByDoors(sidesToCorners(walls), doorLines);
      const from = out.length;
      push(glass ? open : cutByDoors(open, windowLines), glass ? 'glass' : 'wall');
      const room = label ? named.push({ from, to: out.length, label, done: false }) - 1 : -1;
      for (let i = 0; i < walls.length; i++) doorableRoom.push(room);
    } else if (el.shape === 'corridor') {
      const walls = corridorWalls(el);
      doorable.push(...walls);
      for (let i = 0; i < walls.length; i++) doorableRoom.push(-1);
      plaster.push(...walls);
      push(cutByDoors(cutByDoors(walls, doorLines), windowLines), 'wall');
    } else if (el.shape === 'office-pod') {
      const start = out.length;
      push(podWalls(el), 'wall');
      for (let i = start; i < out.length; i++)
        out[i] = { ...out[i]!, height: SPACE_POD_WALL_HEIGHT };
    } else if (el.shape === 'fence') push([fenceLine(el)], 'fence');
    else if (el.shape === 'garden-fence') push([fenceLine(el)], 'picket');
    else if (el.shape === 'grass') push(grassRows(el, covers), 'grass');
  }
  // Every Door on a wall stands as a doorway: a wooden frame with a lintel of wall over it, its leaf in it when shut.
  doors.forEach((el, i) => {
    const line = doorLines[i]!;
    const on = doorable.findIndex((w) => doorSpanOnWall(w, line));
    if (on < 0) return;
    const wall = facingCamera(`door:${i}`, line, 'doorway');
    if (!wall) return;
    // The room's name over its door, on the lintel, where no piece covers it (the owner, 2026-11-18: "put the room
    // names above the door, not on the back wall").
    const room = named[doorableRoom[on] ?? -1];
    if (room) {
      wall.label = room.label;
      room.done = true;
    }
    wall.doorId = el.id;
    if ((el as { doorClosed?: boolean }).doorClosed === true) wall.shut = true;
    // Open, its leaf stands hinged at the door's first jamb, swung to the side the plan draws (doorParts): the face
    // keeps the door's own way unless facingCamera turned it round, and then the hinge and the swing both swap.
    else wall.hinge = wall.a.x === line.a.x && wall.a.y === line.a.y ? 'start' : 'end';
    if (glassy.some((w) => doorSpanOnWall(w, line))) wall.glass = true;
    out.push(wall);
  });
  // Every Window on a plaster wall stands in it: sill, glazing and the wall over it.
  windowLines.forEach((line, i) => {
    if (!plaster.some((w) => doorSpanOnWall(w, line))) return;
    const wall = facingCamera(`window:${i}`, line, 'window');
    if (wall) out.push(wall);
  });
  // A named room no doorway leads into keeps its name on its back wall.
  for (const n of named) if (!n.done) labelBackWall(out, n.from, n.label, n.to);
  return out;
}

// A lawn's blades poking up: level rows across it, inside its rounded edge (3d-view.md "Grass pokes up"). A turned
// lawn keeps its rows level across its box; a lawn too small for a row has none.
function grassRows(el: Shape, covers: readonly Shape[]): WallSegment[] {
  const left = el.x + GRASS_INSET;
  const right = el.x + el.width - GRASS_INSET;
  if (right - left < 1) return [];
  const rows: WallSegment[] = [];
  for (let y = el.y + GRASS_INSET; y <= el.y + el.height - GRASS_INSET; y += SPACE_GRASS_ROW) {
    // The row, less every covering piece it runs under.
    let spans: [number, number][] = [[left, right]];
    for (const c of covers) {
      if (c === el || y < c.y || y > c.y + c.height) continue;
      const cl = c.x;
      const cr = c.x + c.width;
      spans = spans.flatMap(([a, b]): [number, number][] =>
        cr <= a || cl >= b
          ? [[a, b]]
          : [
              ...(cl > a ? [[a, cl] as [number, number]] : []),
              ...(cr < b ? [[cr, b] as [number, number]] : []),
            ],
      );
    }
    for (const [a, b] of spans) if (b - a >= 1) rows.push({ a: { x: a, y }, b: { x: b, y } });
  }
  return rows;
}

// The floor pieces a lawn's blades never poke up through (3d-view.md "Grass pokes up").
const COVERS_GRASS = new Set<string>([
  'room',
  'corridor',
  'office-pod',
  'garden-path',
  'rug',
  'stage',
  'pond',
  'swimming-pool',
  'car-park',
  'stairs',
  'avatar-pad',
]);

// One wall, its ends ordered so its face fronts the camera (left to right; top to bottom when upright), or null when
// it has no length.
function facingCamera(id: string, s: WallSegment, kind: SpaceWallKind): SpaceWall | null {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  const flip = dx < 0 || (dx === 0 && dy < 0);
  const a = flip ? s.b : s.a;
  const b = flip ? s.a : s.b;
  return { id, a, b, kind, height: HEIGHT[kind], shade: Math.abs(dy) / length };
}

// The room's name on its back wall: of its level walls, those nearest the top, the longest (DEFAULTS.md D140).
function labelBackWall(walls: SpaceWall[], from: number, label: string, to = walls.length): void {
  let best: SpaceWall | null = null;
  let bestTop = Infinity;
  let bestLength = 0;
  for (let i = from; i < to; i++) {
    const w = walls[i]!;
    const length = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    if (Math.abs(w.b.y - w.a.y) / length > LABEL_LEVEL_SIN) continue;
    const top = Math.round((w.a.y + w.b.y) / 2);
    if (top < bestTop || (top === bestTop && length > bestLength)) {
      best = w;
      bestTop = top;
      bestLength = length;
    }
  }
  if (best) best.label = label;
}

/**
 * A room's walls with its side walls ending at the back and front walls' lines (3d-view.md "The plan's walls give
 * way"): the walking lines run the side walls up into the back wall's deep face, which in 3D poked up behind the back
 * wall (the owner, 2026-11-18: "the sides are going further than the back wall").
 */
export function sidesToCorners(walls: readonly WallSegment[]): WallSegment[] {
  const level = walls.filter((w) => w.a.y === w.b.y).map((w) => w.a.y);
  if (level.length === 0) return [...walls];
  const back = Math.min(...level);
  const front = Math.max(...level);
  const out: WallSegment[] = [];
  for (const w of walls) {
    if (w.a.x !== w.b.x) {
      out.push(w);
      continue;
    }
    const a = Math.max(back, Math.min(front, w.a.y));
    const b = Math.max(back, Math.min(front, w.b.y));
    if (Math.abs(b - a) > 0) out.push({ a: { x: w.a.x, y: a }, b: { x: w.b.x, y: b } });
  }
  return out;
}

/** A wall's place on the floor: where it starts, how long it is and its angle (degrees clockwise). */
export function wallFrame(wall: SpaceWall): {
  x: number;
  y: number;
  length: number;
  angle: number;
} {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  return {
    x: wall.a.x,
    y: wall.a.y,
    length: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
