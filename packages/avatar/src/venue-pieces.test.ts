import { describe, expect, it } from 'vitest';
import { fenceReachFor, fenceSegments, fenceStep } from './collision';
import { avatarScale } from './config';
import {
  isFixedSeatShape,
  isSceneryShape,
  isWallPieceShape,
  officeFootprint,
  POOL_DECK,
  poolDeck,
  seatsACharacter,
} from './office-geometry';
import { elementUnderFeet } from './walk';

// livehuddle's docs/specs/009-elements/venue-pieces.md "How each one walks": the footprints, the pool's water, the
// curtains as a hanging piece, and nobody seated.
const REACH = fenceReachFor(avatarScale('regular'));
const piece = (shape: string, x: number, y: number, width: number, height: number) => ({
  id: shape,
  type: 'shape' as const,
  shape,
  x,
  y,
  width,
  height,
});

// A straight walk the way the walk loop takes it (13 px steps through fenceStep): where the feet stop.
function walk(els: ReturnType<typeof piece>[], from: { x: number; y: number }, to: typeof from) {
  const fences = fenceSegments(els);
  let pos = from;
  for (let i = 0; i < 400; i++) {
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) break;
    const t = Math.min(13, d);
    const step = fenceStep(
      pos,
      { x: pos.x + (dx / d) * t, y: pos.y + (dy / d) * t },
      fences,
      REACH,
    );
    if (step.blocked && Math.hypot(step.pos.x - pos.x, step.pos.y - pos.y) < 0.01) break;
    pos = step.pos;
  }
  return pos;
}

describe('the venue pieces', () => {
  const SCENERY = [
    ['pillar', 48, 152],
    ['column', 64, 168],
    ['car-park', 240, 128],
    ['bike-rack', 136, 80],
    ['podium', 56, 88],
  ] as const;

  it('blocks with a footprint in the bottom of each standing piece, never its top', () => {
    for (const [shape, width, height] of SCENERY) {
      expect(isSceneryShape(shape), shape).toBe(true);
      const f = officeFootprint({ x: 0, y: 0, width, height, shape })!;
      expect(f.x, shape).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width, shape).toBeLessThanOrEqual(width);
      expect(f.y, shape).toBeGreaterThanOrEqual(height * 0.3);
      expect(f.y + f.height, shape).toBeLessThanOrEqual(height);
    }
  });

  it('joins pillars and car parks side by side into one barrier', () => {
    for (const shape of ['pillar', 'car-park']) {
      const a = officeFootprint({ x: 0, y: 0, width: 100, height: 100, shape })!;
      const b = officeFootprint({ x: 100, y: 0, width: 100, height: 100, shape })!;
      expect(a.x + a.width, shape).toBe(b.x);
    }
  });

  it('makes the pool’s water its footprint: the pool less its deck, at any size', () => {
    expect(isSceneryShape('swimming-pool')).toBe(true);
    expect(
      officeFootprint({ x: 10, y: 20, width: 320, height: 200, shape: 'swimming-pool' }),
    ).toEqual({
      x: 10 + POOL_DECK,
      y: 20 + POOL_DECK,
      width: 320 - 2 * POOL_DECK,
      height: 200 - 2 * POOL_DECK,
    });
    // A small pool's deck is a tenth of its shorter side; one shrunk to nothing has no water left.
    expect(poolDeck(80, 60)).toBe(6);
    expect(officeFootprint({ x: 0, y: 0, width: 80, height: 60, shape: 'swimming-pool' })).toEqual({
      x: 6,
      y: 6,
      width: 68,
      height: 48,
    });
    expect(poolDeck(0, 40)).toBe(0);
  });

  it('stops a character at the pool’s rim, on its deck, never in the water', () => {
    const pool = piece('swimming-pool', 0, 0, 320, 200);
    const end = walk([pool], { x: 160, y: 400 }, { x: 160, y: 100 });
    // Stopped below the water's front edge (y 186), on the deck or in front of it.
    expect(end.y).toBeGreaterThan(200 - POOL_DECK);
    expect(end.y).toBeLessThan(260);
  });

  it('walks between and in front of the stage curtains: nothing to block or stand on', () => {
    expect(isWallPieceShape('stage-curtains')).toBe(true);
    expect(isSceneryShape('stage-curtains')).toBe(false);
    const curtains = piece('stage-curtains', 0, 0, 360, 120);
    expect(officeFootprint(curtains)).toBeNull();
    expect(elementUnderFeet([curtains], { x: 180, y: 100 })).toBeNull();
    const end = walk([curtains], { x: 20, y: 200 }, { x: 20, y: 60 });
    expect(Math.round(end.y)).toBe(60);
  });

  it('seats nobody', () => {
    for (const shape of [...SCENERY.map(([s]) => s), 'swimming-pool', 'stage-curtains']) {
      expect(isFixedSeatShape(shape), shape).toBe(false);
      expect(seatsACharacter(shape), shape).toBe(false);
    }
  });
});
