// A character against a wall in the 3D view (docs/specs/008-canvas/3d-view.md "Against a wall"): a figure stands up
// about its feet facing the camera, so it leans back from them, and a wall just behind its feet (as the camera sees
// it) cut through it, leaving only its feet in front of the wall. Such a character is drawn towards the camera by its
// whole height, chip and all (the stylesheet's `--space-seat-lift`, as the Receptionist behind a desk is), which keeps
// it in front of the wall. Pure.

import { AVATAR_HEAD_CHROME, AVATAR_HEIGHT } from '@livehuddle/avatar/walk';
import type { SpaceWall } from './space-3d-walls';
import { toCamera } from './space-3d-turn';

type Point = { x: number; y: number };
type Line = { a: Point; b: Point };

/** The walls a standing figure can lean into: those taller than a character, not a fence, the grass or a stage. */
export function wallsTallerThanFigures(walls: readonly SpaceWall[]): Line[] {
  return walls.filter((w) => w.height >= AVATAR_HEIGHT);
}

/** How far a figure of this scale is drawn towards the camera: its whole height and what it carries over its head. */
export function figureWallLift(scale: number): number {
  return Math.ceil((AVATAR_HEIGHT + AVATAR_HEAD_CHROME) * scale);
}

/**
 * Whether a wall runs behind feet at `at`, as the camera turned `q` quarters sees it, within `reach` (the figure's
 * lift: no figure leans back further than it is tall). A wall running straight away from the camera is beside the
 * figure, never behind it.
 */
export function wallBehind(walls: readonly Line[], at: Point, q: number, reach: number): boolean {
  const p = toCamera(at, q);
  for (const w of walls) {
    const a = toCamera(w.a, q);
    const b = toCamera(w.b, q);
    const dx = b.x - a.x;
    if (dx === 0 || (a.x - p.x) * (b.x - p.x) > 0) continue;
    // The wall's point straight up the screen from the feet.
    const y = a.y + ((p.x - a.x) / dx) * (b.y - a.y);
    const gap = p.y - y;
    if (gap >= 0 && gap <= reach) return true;
  }
  return false;
}

/** The lift for a standing figure at `at`: its whole height when a wall runs behind it, else 0. */
export function wallLiftAt(
  walls: readonly Line[],
  at: Point | null,
  q: number,
  scale: number,
): number {
  if (!at || walls.length === 0) return 0;
  const lift = figureWallLift(scale);
  return wallBehind(walls, at, q, lift) ? lift : 0;
}
