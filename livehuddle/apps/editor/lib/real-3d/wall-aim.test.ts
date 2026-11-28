import { describe, expect, it } from 'vitest';
import type { SpaceWall } from '@/lib/space-3d/space-3d-walls';
import { wallHitAlong } from './wall-aim';
import { WALL_RISE } from './models/kit';

// Two level walls 152 tall: a room's front wall at y 300 and its back wall at y 100. The camera looks from the
// bottom of the plan (y large), high up, down into the room.
const wall = (id: string, y: number, kind: SpaceWall['kind'] = 'wall'): SpaceWall => ({
  id,
  a: { x: 0, y },
  b: { x: 400, y },
  kind,
  height: 152,
  shade: 0,
});
const walls = [wall('front', 300), wall('back', 100)];
const none = new Set<string>();
// A sight line from (200, 600, 400) down towards the floor at (200, 0): it crosses the front wall at z 200 (over its
// 182 px top), so it meets the back wall at z 67.
const from = { x: 200, y: 600, z: 400 };
const dir = { x: 0, y: -600, z: -400 };

describe('wallHitAlong (wall-pieces.md "Aimed at a wall in 3D")', () => {
  it('meets the first wall standing in the sight line, with a point on the camera side', () => {
    const hit = wallHitAlong(walls, none, from, dir);
    expect(hit?.at.y).toBeCloseTo(100);
    expect(hit!.toward.y).toBeGreaterThan(100);
  });

  it('meets the nearer wall when the sight line is low enough to hit it', () => {
    const low = { x: 200, y: 600, z: 300 };
    const hit = wallHitAlong(walls, none, low, { x: 0, y: -600, z: -300 });
    // At y 300 the line is at z 150, under the front wall's top.
    expect(hit?.at.y).toBeCloseTo(300);
    expect(hit!.toward.y).toBeGreaterThan(300);
  });

  it('passes over a wall cut down and through a doorway under its lintel', () => {
    const low = { x: 200, y: 600, z: 300 };
    const d = { x: 0, y: -600, z: -300 };
    expect(wallHitAlong(walls, new Set(['front']), low, d)?.at.y).toBeCloseTo(100);
    const door = [wall('front', 300, 'doorway'), wall('back', 100)];
    // z 150 at the doorway: in its 96 x 1.2 = 115 to 182 lintel band, so it is met.
    expect(wallHitAlong(door, none, low, d)?.at.y).toBeCloseTo(300);
    // Lower, through the opening: the back wall.
    const under = { x: 200, y: 600, z: 150 };
    expect(wallHitAlong(door, none, under, { x: 0, y: -600, z: -150 })?.at.y).toBeCloseTo(100);
    expect(152 * WALL_RISE).toBeCloseTo(182.4);
  });

  it('meets nothing past a fence or off the walls', () => {
    expect(wallHitAlong([wall('f', 300, 'fence')], none, from, dir)).toBeNull();
    expect(wallHitAlong(walls, none, { x: 900, y: 600, z: 400 }, dir)).toBeNull();
  });
});
