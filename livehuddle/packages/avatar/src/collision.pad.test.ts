// A wall keeps the whole body out of it (docs/specs/009-elements/fence.md "A wall keeps the whole body out of it"):
// a wall's reach grows by the figure's half-width and the wall's own half-thickness, its pad, so a walk into a wall or
// along it stops with the body at the wall's face; a seat snap and a footprint keep the feet's plain reach; a doorway
// still walks through, stepped or routed, at every Size.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  clearOfFences,
  FENCE_BODY_SHARE,
  FENCE_PAD,
  FENCE_REACH,
  fenceReachFor,
  fenceReachOf,
  fenceSegments,
  fenceStep,
  PICKET_PAD,
  pointSegmentDistance,
  WALL_PAD,
  type FenceSegment,
} from './collision';
import type { FencePoint } from './fence';
import { buildNavGrid, findWalkRoute } from './pathing';
import { AVATAR_SIZE_SCALE } from './size-scale';

const WALL_REACH = FENCE_REACH * FENCE_BODY_SHARE + WALL_PAD;
const room = { id: 'r', type: 'shape', shape: 'room', x: 0, y: 0, width: 400, height: 300 };
// A 96 px Door in the middle of the right wall (x 395), its opening y 102..198.
const door = {
  id: 'd',
  type: 'shape',
  shape: 'door',
  x: 395 - 48,
  y: 150 - 12,
  width: 96,
  height: 24,
  rotation: 90,
};

// Walks from `from` toward `to`, `step` px a frame as the walk loop does, calling `each` with every point it reaches.
function walk(
  from: FencePoint,
  to: FencePoint,
  fences: readonly FenceSegment[],
  reach: number,
  each: (p: FencePoint) => void = () => {},
  step = 4,
): FencePoint {
  let at = from;
  for (let i = 0; i < 600; i++) {
    const d = Math.hypot(to.x - at.x, to.y - at.y);
    if (d < 0.5) break;
    const k = Math.min(1, step / d);
    const next = fenceStep(
      at,
      { x: at.x + (to.x - at.x) * k, y: at.y + (to.y - at.y) * k },
      fences,
      reach,
    );
    if (next.pos.x === at.x && next.pos.y === at.y) break;
    at = next.pos;
    each(at);
  }
  return at;
}

describe('a wall’s pad', () => {
  it('pads every wall by its 3D half-thickness, and no footprint', () => {
    const board = [
      { id: 'f', type: 'shape', shape: 'fence', x: 0, y: 0, width: 240, height: 24 },
      { id: 'g', type: 'shape', shape: 'garden-fence', x: 0, y: 100, width: 240, height: 24 },
      { ...room, id: 'room', y: 400 },
      { id: 'c', type: 'shape', shape: 'corridor', x: 600, y: 0, width: 400, height: 120 },
      { id: 'p', type: 'shape', shape: 'plant', x: 1200, y: 0, width: 56, height: 88 },
    ];
    const lines = fenceSegments(board);
    expect(lines[0]!.pad).toBe(FENCE_PAD);
    expect(lines[1]!.pad).toBe(PICKET_PAD);
    const walls = lines.filter((l) => l.pad === WALL_PAD);
    // The room's four walls and the corridor's two sides.
    expect(walls.length).toBeGreaterThanOrEqual(6);
    expect(lines.filter((l) => l.solid).every((l) => l.pad === undefined)).toBe(true);
  });

  it('grows a wall’s reach to the body’s half-width plus the pad, at every Size', () => {
    const wall: FenceSegment = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, pad: WALL_PAD };
    const pot: FenceSegment = {
      ...wall,
      pad: undefined,
      solid: { x: 0, y: -20, width: 100, height: 20 },
    };
    expect(fenceReachOf(wall, FENCE_REACH)).toBeCloseTo(19 + WALL_PAD);
    expect(fenceReachOf(pot, FENCE_REACH)).toBe(FENCE_REACH);
    for (const scale of Object.values(AVATAR_SIZE_SCALE)) {
      const reach = fenceReachFor(scale);
      expect(fenceReachOf(wall, reach)).toBeCloseTo(reach * FENCE_BODY_SHARE + WALL_PAD);
    }
  });

  it('stops a walk straight at a wall with the body at its face', () => {
    const fences = fenceSegments([room]);
    // Inside the room, walking left at its left wall (x 5).
    const end = walk({ x: 100, y: 150 }, { x: -50, y: 150 }, fences, FENCE_REACH);
    expect(end.x - 5).toBeGreaterThanOrEqual(WALL_REACH - 0.2);
    expect(end.x - 5).toBeLessThan(WALL_REACH + 0.5);
  });

  it('keeps the padded clearance walking sideways along a wall, the whole way', () => {
    const fences = fenceSegments([room]);
    // The back wall: the room's highest level one.
    const back = fences.filter((f) => f.a.y === f.b.y).reduce((m, f) => (f.a.y < m.a.y ? f : m));
    let closest = Infinity;
    // Steered diagonally into the back wall from inside, along it from left to right: it slides along the wall.
    const end = walk({ x: 60, y: 60 }, { x: 340, y: -200 }, fences, FENCE_REACH, (p) => {
      closest = Math.min(closest, pointSegmentDistance(p, back));
    });
    expect(closest).toBeGreaterThanOrEqual(WALL_REACH - 1e-6);
    // It slid along, not stopped where it first met the wall.
    expect(end.x).toBeGreaterThan(200);
  });

  it('walks a doorway straight through, at every Size', () => {
    const fences = fenceSegments([room, door]);
    for (const [size, scale] of Object.entries(AVATAR_SIZE_SCALE)) {
      const reach = fenceReachFor(scale);
      const to = { x: 480, y: 150 };
      const end = walk({ x: 300, y: 150 }, to, fences, reach);
      expect(Math.hypot(end.x - to.x, end.y - to.y), size).toBeLessThan(1);
    }
  });

  it('routes through a padded doorway, every leg clear of the padded reach, at every Size', () => {
    const fences = fenceSegments([room, door]);
    for (const [size, scale] of Object.entries(AVATAR_SIZE_SCALE)) {
      const reach = fenceReachFor(scale);
      const grid = buildNavGrid(fences, reach);
      const from = { x: 600, y: -100 };
      const target = { x: 120, y: 200 };
      const route = findWalkRoute(grid, from, target);
      expect(route, size).not.toBeNull();
      let at = from;
      for (const leg of route!) at = walk(at, leg, fences, reach);
      expect(Math.hypot(at.x - target.x, at.y - target.y), size).toBeLessThan(1);
    }
  });

  it('snaps a seat beside a wall clear of the plain reach only, so it stays on its seat', () => {
    const fences = fenceSegments([room]);
    // A seat 10 px off the left wall's line: the plain reach nudges it to 12.5, never the padded 24.5.
    expect(clearOfFences({ x: 15, y: 150 }, fences, FENCE_REACH, true)).toEqual({
      x: 5 + FENCE_REACH + 0.5,
      y: 150,
    });
    expect(clearOfFences({ x: 15, y: 150 }, fences, FENCE_REACH)).toEqual({
      x: 5 + WALL_REACH + 0.5,
      y: 150,
    });
  });

  it('lets a character inside a wall’s padded reach step away from it, never into it', () => {
    const fences = fenceSegments([room]);
    // 16 px off the left wall: inside its padded reach, outside the plain one.
    const away = fenceStep({ x: 21, y: 150 }, { x: 25, y: 150 }, fences, FENCE_REACH);
    expect(away).toEqual({ pos: { x: 25, y: 150 }, blocked: false });
    const into = fenceStep({ x: 21, y: 150 }, { x: 17, y: 150 }, fences, FENCE_REACH);
    expect(into.pos.x).toBeGreaterThanOrEqual(21 - 1e-6);
  });

  it('keeps a frame’s step cheap on a tab of 500 padded rooms', () => {
    const rooms = Array.from({ length: 500 }, (_, i) => ({
      ...room,
      id: `r${i}`,
      x: (i % 25) * 500,
      y: Math.floor(i / 25) * 400,
    }));
    const fences = fenceSegments(rooms);
    // Sliding along a wall: the most a step does (a refusal, a slide test).
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++)
        fenceStep(
          { x: 100 + (i % 50), y: 5 + WALL_REACH + 1 },
          { x: 104 + (i % 50), y: 0 },
          fences,
        );
    });
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
