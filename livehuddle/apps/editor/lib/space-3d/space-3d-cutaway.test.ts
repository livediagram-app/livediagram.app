import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { SpaceWall } from './space-3d-walls';
import { spaceWalls } from './space-3d-walls';
import {
  SPACE_CUT_DEPTH,
  SPACE_CUT_HALF_WIDTH,
  SPACE_ROOM_NEAR,
  areaMovedFar,
  cutAwayIds,
  spaceRooms,
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

describe('rooms open up as you come near (3d-view.md "Walls in front of you are cut away")', () => {
  // A 200 by 160 room at the origin: back wall y 0, front wall y 160, sides at x 0 and 200.
  const room = { id: 'r', x: 0, y: 0, width: 200, height: 160 };
  const walls = [
    wall('r:0', 0, 0, 200, 0),
    wall('r:1', 200, 0, 200, 160),
    wall('r:2', 0, 160, 200, 160),
    wall('r:3', 0, 0, 0, 160),
  ];

  it('fades the front wall while you stand inside, and keeps the back and sides', () => {
    const cut = cutAwayIds(walls, { x: 100, y: 40 }, 0, [room]);
    expect(cut.has('r:2')).toBe(true);
    expect(cut.has('r:0')).toBe(false);
    expect(cut.has('r:1')).toBe(false);
    expect(cut.has('r:3')).toBe(false);
  });

  it('fades it while you walk near, not once you are past SPACE_ROOM_NEAR', () => {
    expect(cutAwayIds(walls, { x: 100, y: 160 + SPACE_ROOM_NEAR - 10 }, 0, [room]).has('r:2')).toBe(
      true,
    );
    expect(cutAwayIds(walls, { x: 600, y: 600 }, 0, [room]).has('r:2')).toBe(false);
  });

  it('fades the wall on the camera side when turned: from behind, the back wall', () => {
    const cut = cutAwayIds(walls, { x: 100, y: 120 }, 2, [room]);
    expect(cut.has('r:0')).toBe(true);
    expect(cut.has('r:2')).toBe(false);
  });

  it("takes a doorway on the front edge as the room's own", () => {
    const door = { ...wall('door:0', 80, 160, 120, 160), kind: 'doorway' as const };
    expect(cutAwayIds([...walls, door], { x: 100, y: 40 }, 0, [room]).has('door:0')).toBe(true);
  });

  it('lists rooms and pods, unturned, and nothing else', () => {
    const rooms = spaceRooms([
      { id: 'a', type: 'shape', shape: 'room', x: 1, y: 2, width: 3, height: 4 },
      { id: 'b', type: 'shape', shape: 'office-pod', x: 0, y: 0, width: 5, height: 5 },
      { id: 'c', type: 'shape', shape: 'room', rotation: 90, x: 0, y: 0, width: 5, height: 5 },
      { id: 'd', type: 'shape', shape: 'desk', x: 0, y: 0, width: 5, height: 5 },
      { id: 'e', type: 'text' },
    ]);
    expect(rooms.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rooms[0]).toEqual({ id: 'a', x: 1, y: 2, width: 3, height: 4 });
  });
});
