// Aiming a wall piece at a wall in 3D (docs/specs/009-elements/wall-pieces.md "Aimed at a wall in 3D"): the floor
// point under the pointer lies behind the wall the pointer is over, so a Poster placed there landed on the wall's far
// face. A wall piece aims instead where the pointer's sight line meets the first wall standing in it, on the camera's
// side. Pure: the 3D walls, which of them are cut down, and the sight line in the scene's frame (canvas px, z up).

import {
  mountsOnWall,
  snapToWallFace,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { WALL_RISE } from './models/kit';
import { real3DWallAim } from './real-3d-pick';
import { WALL_CUT_HEIGHT } from './scene-walls';
import { SPACE_DOOR_HEIGHT, type SpaceWall } from '@/lib/space-3d/space-3d-walls';

type Vec3 = { x: number; y: number; z: number };
type Point = { x: number; y: number };

/** How far back towards the camera from the wall the `toward` point stands, in canvas px. */
const TOWARD_STEP = 2;

/** The walls a wall piece hangs on: a Room's, a Corridor's and a Pod's (glass), a window's and a doorway's lintel. */
const HANGS_ON: ReadonlySet<SpaceWall['kind']> = new Set(['wall', 'glass', 'window', 'doorway']);

/**
 * Where a sight line from `from` along `dir` (into the scene) first meets a standing wall, and a point just on the
 * camera's side of it; null when it meets none before the floor. A wall cut down (`low`) stands only its low height;
 * a doorway is met only over its opening, at its lintel.
 */
export function wallHitAlong(
  walls: readonly SpaceWall[],
  low: { has(id: string): boolean },
  from: Vec3,
  dir: Vec3,
): { at: Point; toward: Point } | null {
  let best = Infinity;
  for (const w of walls) {
    if (!HANGS_ON.has(w.kind)) continue;
    const ex = w.b.x - w.a.x;
    const ey = w.b.y - w.a.y;
    // Solve from + t*dir = a + u*e in the plan.
    const den = dir.x * ey - dir.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = w.a.x - from.x;
    const qy = w.a.y - from.y;
    const t = (qx * ey - qy * ex) / den;
    if (t <= 0 || t >= best) continue;
    const u = (qx * dir.y - qy * dir.x) / den;
    if (u < 0 || u > 1) continue;
    const z = from.z + t * dir.z;
    const top = (low.has(w.id) ? WALL_CUT_HEIGHT : w.height) * WALL_RISE;
    const bottom = w.kind === 'doorway' ? SPACE_DOOR_HEIGHT * WALL_RISE : 0;
    if (z < bottom || z > top) continue;
    best = t;
  }
  if (best === Infinity) return null;
  const at = { x: from.x + best * dir.x, y: from.y + best * dir.y };
  const run = Math.hypot(dir.x, dir.y) || 1;
  return {
    at,
    toward: { x: at.x - (dir.x / run) * TOWARD_STEP, y: at.y - (dir.y / run) * TOWARD_STEP },
  };
}

/**
 * A wall piece put on the wall it is aimed at in 3D: its middle where the sight line to the floor point at its middle
 * meets a wall, flush on the camera's side; else, or for any other piece, snapToWallFace as in the flat plan.
 */
export function snapAimedWallPiece(
  piece: ShapeElement,
  elements: readonly Element[],
): ShapeElement {
  const aimed = mountsOnWall(piece.shape) ? aimWallPiece(piece) : null;
  if (!aimed) return snapToWallFace(piece, elements);
  return snapToWallFace(
    { ...piece, x: aimed.at.x - piece.width / 2, y: aimed.at.y - piece.height / 2 },
    elements,
    aimed.toward,
  );
}

/** The wall aim for a wall piece's middle (snapMovedWallPieces' `aim`): null off the 3D view or over no wall. */
export function aimWallPiece(piece: ShapeElement): { at: Point; toward: Point } | null {
  return real3DWallAim({ x: piece.x + piece.width / 2, y: piece.y + piece.height / 2 });
}
