import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  fenceReachFor,
  fenceSegments,
  fenceStep,
  shutDoorLines,
  type FenceSegment,
} from './collision';
import { avatarScale } from './config';
import type { FencePoint } from './fence';
import { buildNavGrid, clearWalk, findWalkPath, NAV_CELL, NAV_MAX_CELLS } from './pathing';

// docs/specs/008-canvas/avatar-mode.md "Finding the way": a click-walk routes round what blocks a step.

const REACH = fenceReachFor(avatarScale('regular'));
const shape = (
  id: string,
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
  more = {},
) => ({
  id,
  type: 'shape' as const,
  shape: kind,
  x,
  y,
  width: w,
  height: h,
  ...more,
});

// Walks the route the way the walk loop does (13px steps, each through fenceStep): where the feet end up.
function walkRoute(from: FencePoint, route: FencePoint[], fences: FenceSegment[], reach = REACH) {
  let pos = from;
  for (const to of route) {
    for (let i = 0; i < 2000; i++) {
      const dx = to.x - pos.x;
      const dy = to.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) break;
      const t = Math.min(13, d);
      const step = fenceStep(
        pos,
        { x: pos.x + (dx / d) * t, y: pos.y + (dy / d) * t },
        fences,
        reach,
      );
      if (step.blocked && Math.hypot(step.pos.x - pos.x, step.pos.y - pos.y) < 0.01) return pos;
      pos = step.pos;
    }
  }
  return pos;
}

function route(elements: Parameters<typeof fenceSegments>[0], from: FencePoint, to: FencePoint) {
  const fences = fenceSegments(elements);
  const grid = buildNavGrid(fences, REACH, shutDoorLines(elements));
  const path = findWalkPath(grid, from, to);
  return { fences, grid, path, end: walkRoute(from, path, fences) };
}

const near = (a: FencePoint, b: FencePoint, d = 1) => Math.hypot(a.x - b.x, a.y - b.y) <= d;

describe('findWalkPath', () => {
  // A 400 by 300 room, its doorway in the middle of its front (bottom) wall.
  const room = shape('room', 'room', 0, 0, 400, 300);

  it('walks a straight line when nothing is in the way, and when no wall stands anywhere', () => {
    expect(route([room], { x: 200, y: 500 }, { x: 200, y: 150 }).path).toEqual([
      { x: 200, y: 150 },
    ]);
    expect(findWalkPath(null, { x: 0, y: 0 }, { x: 9, y: 9 })).toEqual([{ x: 9, y: 9 }]);
    expect(buildNavGrid([], REACH)).toBeNull();
  });

  it('goes round to the doorway and in, clicked inside from behind the back wall', () => {
    const from = { x: 200, y: -150 };
    const to = { x: 200, y: 150 };
    const { path, end, fences } = route([room], from, to);
    expect(path.length).toBeGreaterThan(2);
    expect(path.at(-1)).toEqual(to);
    expect(near(end, to)).toBe(true);
    // Straight legs between corners, never a cell-by-cell staircase.
    expect(path.length).toBeLessThan(8);
    // Every leg keeps the reach clear of every wall, bar the feet's own start.
    let at = from;
    for (const p of path) {
      expect(clearWalk(at, p, fences, REACH - 1)).toBe(true);
      at = p;
    }
  });

  it('goes in through a Door piece, and stops just outside the walls once it is shut', () => {
    // A room with no built-in doorway and a Door in the middle of its right wall (x 395).
    const shut = shape('room', 'room', 0, 0, 400, 300, { roomDoor: 'none' });
    const door = shape('d', 'door', 395 - 48, 150 - 12, 96, 24, { rotation: 90 });
    const from = { x: -150, y: 150 };
    const to = { x: 200, y: 150 };
    const open = route([shut, door], from, to);
    expect(near(open.end, to)).toBe(true);
    // In through the door on the far side, not over the near wall.
    expect(open.path.some((p) => p.x > 395)).toBe(true);
    const closed = route([shut, { ...door, doorClosed: true } as typeof door], from, to);
    // Just outside the shut door (on the walker's side), within a click's reach of it, so the next click opens it:
    // not the wall nearest the click (the back wall, y 31).
    const end = closed.path.at(-1)!;
    expect(end.x).toBeGreaterThan(395 + REACH);
    expect(end.x).toBeLessThan(395 + 48);
    expect(Math.abs(end.y - 150)).toBeLessThan(NAV_CELL);
    expect(near(closed.end, end)).toBe(true);
  });

  it('heads for the shut door nearest the walker when a room has two, and the nearest wall when it has none', () => {
    const shut = shape('room', 'room', 0, 0, 400, 300, { roomDoor: 'none' });
    const right = shape('d1', 'door', 395 - 48, 150 - 12, 96, 24, {
      rotation: 90,
      doorClosed: true,
    });
    const left = shape('d2', 'door', 5 - 48, 150 - 12, 96, 24, { rotation: 90, doorClosed: true });
    const end = route([shut, right, left], { x: -150, y: 150 }, { x: 300, y: 150 }).path.at(-1)!;
    expect(end.x).toBeLessThan(5 - REACH);
    expect(end.x).toBeGreaterThan(5 - 48);
    // Doorless: the wall nearest the click (its back, line y 31).
    const bare = route([shut], { x: -150, y: 150 }, { x: 200, y: 150 }).path.at(-1)!;
    expect(bare.y).toBeLessThan(31 - REACH);
    expect(bare.y).toBeGreaterThan(31 - REACH - 2 * NAV_CELL);
  });

  it('walks out of a shut room to the nearest point inside it, never jittering', () => {
    const shut = shape('room', 'room', 0, 0, 400, 300, { roomDoor: 'none' });
    const { path, end } = route([shut], { x: 200, y: 150 }, { x: 200, y: 600 });
    const last = path.at(-1)!;
    expect(last.y).toBeLessThan(300);
    expect(near(end, last)).toBe(true);
  });

  it('finds its way into an L-shaped Room Builder room through its Door', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 1 },
      { x: 0, y: 1 },
    ];
    const l = shape('l', 'room', 0, 0, 400, 400, { roomOutline: outline });
    // On the bottom wall of the lower leg, (0, 400) to (200, 400).
    const door = shape('d', 'door', 100 - 48, 400 - 12, 96, 24);
    const to = { x: 350, y: 100 };
    const { path, end } = route([l, door], { x: 350, y: 500 }, to);
    expect(near(end, to)).toBe(true);
    // In through the door, not over the arm's wall.
    expect(path.some((p) => p.x < 200 && p.y > 400)).toBe(true);
  });

  it('walks round a piece of scenery in the way, and to the nearest point beside one clicked inside', () => {
    const bar = shape('bar', 'bar', 0, 0, 400, 100);
    const to = { x: 200, y: 200 };
    const round = route([bar], { x: 200, y: -60 }, to);
    expect(near(round.end, to)).toBe(true);
    expect(round.path.length).toBeGreaterThan(1);
    const pond = shape('pond', 'pond', 0, 0, 300, 200);
    const inside = route([pond], { x: 150, y: 400 }, { x: 150, y: 100 });
    // Beside the water's nearest edge (its top, y 20), never in it.
    const last = inside.path.at(-1)!;
    expect(last.y).toBeLessThan(0.1 * 200 - REACH);
    expect(near(inside.end, last)).toBe(true);
  });

  it('routes a click outside the board round from outside it, and back', () => {
    const { end } = route([room], { x: 200, y: -2000 }, { x: 200, y: 150 });
    expect(near(end, { x: 200, y: 150 })).toBe(true);
    const out = route([room], { x: 200, y: 150 }, { x: 3000, y: -3000 });
    expect(near(out.end, { x: 3000, y: -3000 })).toBe(true);
  });

  it('starts from feet standing within a wall’s reach without walking through it', () => {
    // Just inside the back wall (its line y 31), as clearOfFences leaves a character, clicked just behind it.
    const from = { x: 200, y: 31 + REACH + 0.5 };
    const { path, end } = route([room], from, { x: 200, y: -60 });
    expect(path.length).toBeGreaterThan(2);
    expect(near(end, { x: 200, y: -60 })).toBe(true);
  });

  it('keeps a vast board under NAV_MAX_CELLS by taking coarser cells', () => {
    const grid = buildNavGrid(
      fenceSegments([
        shape('f', 'fence', 0, 0, 40_000, 24),
        shape('g', 'fence', 0, 30_000, 240, 24),
      ]),
      REACH,
    )!;
    expect(grid.cols * grid.rows).toBeLessThanOrEqual(NAV_MAX_CELLS * 1.01);
    expect(grid.cell).toBeGreaterThan(NAV_CELL);
  });
});

// 100 rooms (10 by 10, each with its doorway) plus 400 pieces of scenery: the big board of the budget.
function bigBoard() {
  const els: ReturnType<typeof shape>[] = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      const x = c * 640;
      const y = r * 480;
      els.push(shape(`r${r}${c}`, 'room', x, y, 480, 320));
      for (let k = 0; k < 4; k++)
        els.push(shape(`p${r}${c}${k}`, 'plant', x + 60 + k * 90, y + 120, 56, 88));
    }
  return els;
}

describe('findWalkPath on a big board', () => {
  const els = bigBoard();
  const fences = fenceSegments(els);
  let grid = buildNavGrid(fences, REACH);

  it('builds its grid once in a few frames, and answers the worst query well under a frame', () => {
    const build = cpuMsOf(() => {
      grid = buildNavGrid(fences, REACH);
    });
    // Measured 12 to 14 ms on a laptop (2,100 fence lines, 118,604 cells); built once per change to the walls, in idle
    // time. CI's coverage run measured 232 ms, so the budget allows for instrumentation and still fails a quadratic
    // build, which runs to seconds at this size.
    expect(build).toBeLessThan(cpuBudgetMs(150));
    // Corner to corner across the board, from behind one room's back wall into the far room.
    const from = { x: 240, y: -40 };
    const to = { x: 9 * 640 + 240, y: 9 * 480 + 160 };
    const path = findWalkPath(grid, from, to);
    expect(near(walkRoute(from, path, fences), to)).toBe(true);
    // Unreachable (a shut room in the far corner): the nearest point outside, as cheap.
    const shut = els.map((e) => (e.id === 'r99' ? { ...e, roomDoor: 'none' } : e));
    const shutGrid = buildNavGrid(fenceSegments(shut), REACH);
    const runs = 20;
    const query = cpuMsOf(() => {
      for (let i = 0; i < runs; i++) findWalkPath(grid, from, { x: to.x - i, y: to.y });
    });
    const unreachable = cpuMsOf(() => {
      for (let i = 0; i < runs; i++) findWalkPath(shutGrid, from, { x: to.x - i, y: to.y });
    });
    // Measured about 1.4 ms and 1.1 ms a query (the first, before the JIT warms, about 5.5 ms). CI's coverage run
    // measured 14.4 ms, so the budget allows for instrumentation; a search gone exponential still blows past it.
    expect(Math.max(query, unreachable) / runs).toBeLessThan(cpuBudgetMs(10));
  });
});
