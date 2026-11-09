// The Corridor (docs/specs/009-elements/corridor.md): a passage of floor with a wall down each long side
// and its ends open, straight, turning a corner, a T-junction or a crossroads. Its walls and floor in its own px, and
// its walls in canvas px turned by its rotation, for the walk, the doors that snap onto it and the drawing. Pure: no
// React, no DOM.

import { rotatePoint } from '@liveworkspace/model-core/geometry-primitives';
import { ROOM_WALL } from './office-geometry';
import type { OutlinePoint, OutlineSegment } from './room-outline';

/** A corridor's types, the first the one an absent or unknown `variant` draws. */
export const CORRIDOR_VARIANTS = ['straight', 'corner', 'tee', 'cross'] as const;
export type CorridorVariant = (typeof CORRIDOR_VARIANTS)[number];

/** How wide an arm is, wall to wall, in canvas px: two people pass in it. */
export const CORRIDOR_ARM = 120;

/** The type a stored `variant` draws: its own when a corridor takes it, else the Straight. */
export function corridorVariant(variant: unknown): CorridorVariant {
  return (CORRIDOR_VARIANTS as readonly unknown[]).includes(variant)
    ? (variant as CorridorVariant)
    : 'straight';
}

type Box = { x: number; y: number; width: number; height: number; rotation?: number };

/**
 * A corridor's drawing in its own px (0..width, 0..height): the floor polygon and its walls, each an open run along
 * an arm's side on the walls' centre line (ROOM_WALL / 2 in from the arm's edge), stopping at the open ends.
 */
export function corridorShape(
  width: number,
  height: number,
  variant: unknown,
): { floor: OutlinePoint[]; walls: OutlinePoint[][] } {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const t = corridorVariant(variant);
  const half = ROOM_WALL / 2;
  const p = (x: number, y: number) => ({ x, y });
  if (t === 'straight') {
    const floor = [p(0, 0), p(w, 0), p(w, h), p(0, h)];
    // Along the longer sides: across when wider than tall, up and down when taller.
    return w >= h
      ? {
          floor,
          walls: [
            [p(0, half), p(w, half)],
            [p(0, h - half), p(w, h - half)],
          ],
        }
      : {
          floor,
          walls: [
            [p(half, 0), p(half, h)],
            [p(w - half, 0), p(w - half, h)],
          ],
        };
  }
  const a = Math.min(CORRIDOR_ARM, w, h);
  if (t === 'corner') {
    // An arm down the left and one along the bottom, open at the top and at the right.
    return {
      floor: [p(0, 0), p(a, 0), p(a, h - a), p(w, h - a), p(w, h), p(0, h)],
      walls: [
        [p(half, 0), p(half, h - half), p(w, h - half)],
        [p(a - half, 0), p(a - half, h - a + half), p(w, h - a + half)],
      ],
    };
  }
  const cx = w / 2;
  const l = cx - a / 2;
  const r = cx + a / 2;
  if (t === 'tee') {
    // A run across the top, open at both ends, and an arm down the middle, open at the bottom.
    return {
      floor: [p(0, 0), p(w, 0), p(w, a), p(r, a), p(r, h), p(l, h), p(l, a), p(0, a)],
      walls: [
        [p(0, half), p(w, half)],
        [p(0, a - half), p(l + half, a - half), p(l + half, h)],
        [p(w, a - half), p(r - half, a - half), p(r - half, h)],
      ],
    };
  }
  // The crossroads: two runs crossing in the middle, open at all four ends, a wall round each inside corner.
  const cy = h / 2;
  const top = cy - a / 2;
  const bottom = cy + a / 2;
  return {
    floor: [
      p(l, 0),
      p(r, 0),
      p(r, top),
      p(w, top),
      p(w, bottom),
      p(r, bottom),
      p(r, h),
      p(l, h),
      p(l, bottom),
      p(0, bottom),
      p(0, top),
      p(l, top),
    ],
    walls: [
      [p(0, top + half), p(l + half, top + half), p(l + half, 0)],
      [p(w, top + half), p(r - half, top + half), p(r - half, 0)],
      [p(0, bottom - half), p(l + half, bottom - half), p(l + half, h)],
      [p(w, bottom - half), p(r - half, bottom - half), p(r - half, h)],
    ],
  };
}

/** A corridor's walls as lines a character cannot cross, in canvas px, turned by its rotation about its centre. */
export function corridorWalls(el: Box & { variant?: unknown }): OutlineSegment[] {
  const { walls } = corridorShape(el.width, el.height, el.variant);
  const centre = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const turn = el.rotation ?? 0;
  const at = (q: OutlinePoint) => {
    const p = { x: el.x + q.x, y: el.y + q.y };
    return turn % 360 === 0 ? p : rotatePoint(p, centre, turn);
  };
  const out: OutlineSegment[] = [];
  for (const run of walls)
    for (let i = 1; i < run.length; i++) {
      const a = at(run[i - 1]!);
      const b = at(run[i]!);
      if (a.x !== b.x || a.y !== b.y) out.push({ a, b });
    }
  return out;
}
