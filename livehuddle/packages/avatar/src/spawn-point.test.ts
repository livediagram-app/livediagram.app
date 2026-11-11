import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { FENCE_REACH, fenceSegments, pointSegmentDistance, type FenceSegment } from './collision';
import { officeFootprints } from './office-geometry';
import { freeSpawnPoint, SPAWN_SEARCH_MAX } from './spawn-point';

// docs/specs/009-elements/fence.md "What does not walk" (Work Tracker #610): a new character never appears inside a
// footprint; it appears on the nearest free floor, clear of every wall's reach, below the piece first.

const piece = (shape: string, x: number, y: number, width: number, height: number, extra = {}) => ({
  id: `${shape}-${x}-${y}`,
  type: 'shape' as const,
  shape,
  x,
  y,
  width,
  height,
  ...extra,
});

const inside = (
  p: { x: number; y: number },
  b: { x: number; y: number; width: number; height: number },
) => p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;

function expectFree(p: { x: number; y: number }, fences: readonly FenceSegment[]) {
  for (const f of fences) {
    if (f.solid) expect(inside(p, f.solid)).toBe(false);
    expect(pointSegmentDistance(p, f)).toBeGreaterThanOrEqual(FENCE_REACH);
  }
}

describe('freeSpawnPoint', () => {
  it('moves a spot in a pool’s water to the deck straight below it', () => {
    const pool = piece('swimming-pool', 0, 0, 320, 200);
    const fences = fenceSegments([pool]);
    const at = freeSpawnPoint({ x: 160, y: 120 }, fences);
    expectFree(at, fences);
    expect(at.x).toBeCloseTo(160, 5);
    expect(at.y).toBeGreaterThan(186);
  });

  it('moves a spot in a pond, a car and a drape out of each', () => {
    for (const el of [
      piece('pond', 0, 0, 160, 100),
      piece('car-park', 0, 0, 240, 128),
      piece('stage-curtains', 0, 0, 360, 120),
    ]) {
      const fences = fenceSegments([el]);
      for (const box of officeFootprints(el)) {
        const at = freeSpawnPoint({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, fences);
        expectFree(at, fences);
      }
    }
  });

  it('takes the nearest side, not always below: a spot near a wide pool’s top edge goes above it', () => {
    const pool = piece('swimming-pool', 0, 0, 600, 400);
    const fences = fenceSegments([pool]);
    const at = freeSpawnPoint({ x: 300, y: 20 }, fences);
    expectFree(at, fences);
    expect(at.y).toBeLessThan(14);
  });

  it('moves a spot in the corner of the water just round the corner', () => {
    const pool = piece('swimming-pool', 0, 0, 320, 200);
    const fences = fenceSegments([pool]);
    // 1 px inside the water's bottom-right corner (306, 186).
    const at = freeSpawnPoint({ x: 305, y: 185 }, fences);
    expectFree(at, fences);
    expect(Math.hypot(at.x - 305, at.y - 185)).toBeLessThan(FENCE_REACH + 16);
  });

  it('keeps clear of a room’s wall beside the piece', () => {
    // A pool tucked against a room's front wall: below it is the wall, so the spot goes round to a side.
    const room = piece('room', -200, -200, 720, 420, { roomDoor: 'none' });
    const pool = piece('swimming-pool', 0, 0, 320, 200);
    const fences = fenceSegments([room, pool]);
    const at = freeSpawnPoint({ x: 160, y: 120 }, fences);
    expectFree(at, fences);
  });

  it('leaves a free spot as clearOfFences does: in place, or nudged off a wall beside it', () => {
    const pool = piece('swimming-pool', 0, 0, 320, 200);
    const fences = fenceSegments([pool]);
    const far = { x: 500, y: 500 };
    expect(freeSpawnPoint(far, fences)).toBe(far);
    // Beside the water, outside it, within the reach: nudged straight off.
    expect(freeSpawnPoint({ x: 160, y: 196 }, fences).y).toBeCloseTo(186 + FENCE_REACH + 0.5, 5);
  });

  it('gives up where it was asked when no free floor lies within the search, quickly', () => {
    const huge = piece(
      'swimming-pool',
      0,
      0,
      2 * SPAWN_SEARCH_MAX + 400,
      2 * SPAWN_SEARCH_MAX + 400,
    );
    const fences = fenceSegments([huge]);
    const middle = { x: huge.width / 2, y: huge.height / 2 };
    let at = middle;
    const ms = cpuMsOf(() => {
      at = freeSpawnPoint(middle, fences);
    });
    expect(at).toBe(middle);
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
