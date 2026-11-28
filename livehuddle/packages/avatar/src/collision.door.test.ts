// Nobody is ever stuck at a door (docs/specs/009-elements/room-builder.md "Opening on their own"): a Door on a wall is
// always a way through, a door saved shut while doors were swung by hand included, at every Size, walked straight
// at from an angle or routed to from anywhere outside.
import { describe, expect, it } from 'vitest';
import { fenceReachFor, fenceSegments, fenceStep } from './collision';
import type { FencePoint } from './fence';
import { buildNavGrid, findWalkPath } from './pathing';
import { AVATAR_SIZE_SCALE } from './size-scale';

const room = {
  id: 'r',
  type: 'shape',
  shape: 'room',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  roomDoor: 'none',
};
// A Door in the middle of the right wall (x 395), its opening y 102..198, saved shut in the old way.
const door = {
  id: 'd',
  type: 'shape',
  shape: 'door',
  x: 395 - 48,
  y: 150 - 12,
  width: 96,
  height: 24,
  rotation: 90,
  doorClosed: true,
};
const fences = fenceSegments([room, door]);
const STEP = 4;

// Walks from `from` through each point in turn, a step at a time as the walk loop does; where it ends.
function walk(from: FencePoint, legs: readonly FencePoint[], reach: number): FencePoint {
  let at = from;
  for (const to of legs) {
    for (let i = 0; i < 400; i++) {
      const d = Math.hypot(to.x - at.x, to.y - at.y);
      if (d < 0.5) break;
      const k = Math.min(1, STEP / d);
      const next = fenceStep(
        at,
        { x: at.x + (to.x - at.x) * k, y: at.y + (to.y - at.y) * k },
        fences,
        reach,
      );
      if (next.pos.x === at.x && next.pos.y === at.y) break;
      at = next.pos;
    }
  }
  return at;
}

describe('a door never stops a walk', () => {
  for (const [size, scale] of Object.entries(AVATAR_SIZE_SCALE)) {
    const reach = fenceReachFor(scale);

    // Up to 45 degrees: a wall keeps the whole body out of it (fence.md), and a 96 px doorway crossed steeper than that
    // is narrower than a Tall body, which slides along the wall instead.
    it(`lets a ${size} character walk straight through, up to 45 degrees off square`, () => {
      for (const deg of [-45, -30, 0, 30, 45]) {
        const a = (deg * Math.PI) / 180;
        const dir = { x: -Math.cos(a), y: Math.sin(a) };
        const from = { x: 395 - dir.x * 70, y: 150 - dir.y * 70 };
        const to = { x: 395 + dir.x * 90, y: 150 + dir.y * 90 };
        const end = walk(from, [to], reach);
        expect(Math.hypot(end.x - to.x, end.y - to.y), `${size} at ${deg} degrees`).toBeLessThan(1);
      }
    });

    it(`routes a ${size} character in from anywhere outside`, () => {
      const grid = buildNavGrid(fences, reach);
      const target = { x: 120, y: 200 };
      for (const from of [
        { x: 600, y: 150 },
        { x: 500, y: -120 },
        { x: -150, y: 150 },
        { x: 200, y: 480 },
      ]) {
        const end = walk(from, findWalkPath(grid, from, target), reach);
        expect(
          Math.hypot(end.x - target.x, end.y - target.y),
          `${size} from ${from.x},${from.y}`,
        ).toBeLessThan(1);
      }
    });
  }
});
