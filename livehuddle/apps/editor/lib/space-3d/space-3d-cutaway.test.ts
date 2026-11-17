import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { SpaceWall } from './space-3d-walls';
import { spaceWalls } from './space-3d-walls';
import {
  SPACE_CUT_DEPTH,
  SPACE_CUT_HALF_WIDTH,
  areaMovedFar,
  cutAwayIds,
  viewArea,
  wallsInArea,
} from './space-3d-cutaway';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): SpaceWall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  kind: 'wall',
  height: 60,
  shade: 0,
});

describe('the cut-away rule (docs/specs/008-canvas/3d-view.md "Walls in front of you are cut away")', () => {
  const feet = { x: 500, y: 300 };

  it('fades a wall just in front of your feet, between you and the camera', () => {
    expect(cutAwayIds([wall('front', 400, 340, 600, 340)], feet)).toEqual(new Set(['front']));
  });

  it('never cuts a row of grass, too low to hide anyone', () => {
    expect(cutAwayIds([{ ...wall('blades', 400, 340, 600, 340), kind: 'grass' }], feet)).toEqual(
      new Set(),
    );
  });

  it('keeps walls behind you, beside you and far in front of you standing', () => {
    const walls = [
      wall('behind', 400, 260, 600, 260),
      wall('beside', 500 + SPACE_CUT_HALF_WIDTH + 5, 300, 500 + SPACE_CUT_HALF_WIDTH + 5, 500),
      wall('far', 400, 300 + SPACE_CUT_DEPTH + 5, 600, 300 + SPACE_CUT_DEPTH + 5),
    ];
    expect(cutAwayIds(walls, feet)).toEqual(new Set());
  });

  it('fades a wall that only crosses the box, and an upright wall running through it', () => {
    const walls = [wall('diagonal', 300, 500, 700, 320), wall('upright', 520, 200, 520, 700)];
    expect(cutAwayIds(walls, feet)).toEqual(new Set(['diagonal', 'upright']));
  });

  it('fades nothing without feet', () => {
    expect(cutAwayIds([wall('front', 400, 340, 600, 340)], null).size).toBe(0);
  });
});

describe('the drawn area', () => {
  const size = { width: 1200, height: 800 };

  it('is round the middle of the view, deeper ahead than behind', () => {
    const area = viewArea({ zoom: 1, offset: { x: 0, y: 0 } }, size);
    expect(area.centre).toEqual({ x: 600, y: 400 });
    expect(area.centre.y - area.top).toBeGreaterThan(area.bottom - area.centre.y);
    expect(area.right - area.centre.x).toBe(area.centre.x - area.left);
  });

  it('keeps the walls that reach into it', () => {
    const area = viewArea({ zoom: 1, offset: { x: 0, y: 0 } }, size);
    const walls = [
      wall('in', 0, 0, 100, 0),
      wall('out', 99999, 0, 100000, 0),
      wall('across', -99999, 400, 99999, 400),
    ];
    expect(wallsInArea(walls, area).map((w) => w.id)).toEqual(['in', 'across']);
  });

  it('is chosen again after a long walk, a zoom or a resize, not after a step', () => {
    const at = (x: number, zoom = 1, s = size) => viewArea({ zoom, offset: { x: -x, y: 0 } }, s);
    expect(areaMovedFar(at(0), at(40))).toBe(false);
    expect(areaMovedFar(at(0), at(2000))).toBe(true);
    expect(areaMovedFar(at(0), at(0, 1.5))).toBe(true);
    expect(areaMovedFar(at(0), at(0, 1, { width: 400, height: 800 }))).toBe(true);
    const y = viewArea({ zoom: 1, offset: { x: 0, y: -2000 } }, size);
    expect(areaMovedFar(at(0), y)).toBe(true);
  });

  it('cuts away on a large board within a step budget', () => {
    // Twenty Virtual Offices side by side: the walls every pose is checked against.
    const board = Array.from({ length: 20 }, (_, i) =>
      buildTemplate('virtual-office', i * 2000, 0),
    ).flat();
    const walls = spaceWalls(board);
    expect(walls.length).toBeGreaterThan(400);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) cutAwayIds(walls, { x: 500 + i, y: 300 });
    });
    // 100 poses: well under a millisecond each.
    expect(ms).toBeLessThan(100);
  });
});
