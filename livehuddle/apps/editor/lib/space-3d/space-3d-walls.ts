// The walls the 3D view stands up (docs/specs/008-canvas/3d-view.md "What it shows"; blueprint: 3d-view.md): the same
// lines walking is stopped by (@livehuddle/avatar's collision), each a face on the floor from `a` to `b`, with the
// doorways cut out and a shut Door standing in its gap. Built once per board change, never per frame. Pure.

import { isGlassRoom, type Element } from '@livehuddle/document';
import { roomWalls, type WallSegment } from '@livehuddle/avatar/office-geometry';
import { cutByDoors, doorLine, doorSpanOnWall } from '@livehuddle/avatar/room-outline';
import { corridorWalls } from '@livehuddle/avatar/corridor';
import { podWalls } from '@livehuddle/avatar/pod';
import { fenceLine } from '@livehuddle/avatar/fence';
import { AVATAR_HEIGHT } from '@livehuddle/avatar/walk';

/** A Room, Corridor or Office Pod wall stands as tall as a character (DEFAULTS.md D137). */
export const SPACE_WALL_HEIGHT = AVATAR_HEIGHT;
/** A Fence is a low run. */
export const SPACE_FENCE_HEIGHT = 22;
/** A shut Door's panel, a little lower than its wall. */
export const SPACE_DOOR_HEIGHT = 50;

export type SpaceWallKind = 'wall' | 'glass' | 'fence' | 'door';

type Point = { x: number; y: number };

export type SpaceWall = {
  id: string;
  a: Point;
  b: Point;
  kind: SpaceWallKind;
  height: number;
  // 0 facing the camera, 1 running straight away from it: how far the face is shaded.
  shade: number;
  // A Room's name, on its back wall.
  label?: string;
};

// A wall within this of level can carry a room's name (DEFAULTS.md D140).
const LABEL_LEVEL_SIN = Math.sin((30 * Math.PI) / 180);

const HEIGHT: Record<SpaceWallKind, number> = {
  wall: SPACE_WALL_HEIGHT,
  glass: SPACE_WALL_HEIGHT,
  fence: SPACE_FENCE_HEIGHT,
  door: SPACE_DOOR_HEIGHT,
};

type Shape = Extract<Element, { type: 'shape' }>;

const isShape = (el: Element): el is Shape => el.type === 'shape';

/** Every wall the 3D view stands up, in board order. */
export function spaceWalls(elements: readonly Element[]): SpaceWall[] {
  const shapes = elements.filter(isShape);
  const doors = shapes.filter((el) => el.shape === 'door');
  const doorLines = doors.map((el) => doorLine(el));
  const shut = doors
    .filter((el) => (el as { doorClosed?: boolean }).doorClosed === true)
    .map((el) => doorLine(el));
  const out: SpaceWall[] = [];
  // Every wall a door can stand on, so a shut door is drawn only where it really closes a gap.
  const doorable: WallSegment[] = [];
  for (const el of shapes) {
    const push = (segs: readonly WallSegment[], kind: SpaceWallKind, label?: string) => {
      const start = out.length;
      segs.forEach((s, i) => {
        const wall = facingCamera(`${el.id}:${i}`, s, kind);
        if (wall) out.push(wall);
      });
      if (label) labelBackWall(out, start, label);
    };
    if (el.shape === 'room') {
      const walls = roomWalls(el);
      doorable.push(...walls);
      const label = typeof el.label === 'string' ? el.label.trim() : '';
      push(cutByDoors(walls, doorLines), isGlassRoom(el) ? 'glass' : 'wall', label || undefined);
    } else if (el.shape === 'corridor') {
      const walls = corridorWalls(el);
      doorable.push(...walls);
      push(cutByDoors(walls, doorLines), 'wall');
    } else if (el.shape === 'office-pod') push(podWalls(el), 'wall');
    else if (el.shape === 'fence' || el.shape === 'garden-fence') push([fenceLine(el)], 'fence');
  }
  shut.forEach((line, i) => {
    if (!doorable.some((w) => doorSpanOnWall(w, line))) return;
    const wall = facingCamera(`door:${i}`, line, 'door');
    if (wall) out.push(wall);
  });
  return out;
}

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
function labelBackWall(walls: SpaceWall[], from: number, label: string): void {
  let best: SpaceWall | null = null;
  let bestTop = Infinity;
  let bestLength = 0;
  for (let i = from; i < walls.length; i++) {
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
