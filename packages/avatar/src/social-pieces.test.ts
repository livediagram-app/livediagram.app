import { describe, expect, it } from 'vitest';
import {
  isFixedSeatShape,
  isSceneryShape,
  isWallPieceShape,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { seatPoints } from './seats';

// livehuddle's docs/specs/009-elements/social-pieces.md: the seats, the footprints and the wall pieces.
describe('the social pieces', () => {
  it('seats two at a ping-pong table and a bench, six at a picnic table, one in a hammock', () => {
    const cases = [
      ['ping-pong-table', 184, 112, 2],
      ['bench', 136, 64, 2],
      ['picnic-table', 200, 152, 6],
      ['hammock', 152, 80, 1],
    ] as const;
    for (const [shape, width, height, n] of cases) {
      expect(isFixedSeatShape(shape)).toBe(true);
      expect(seatsACharacter(shape)).toBe(true);
      const seats = seatPoints({ x: 0, y: 0, width, height, shape });
      expect(seats, shape).toHaveLength(n);
      for (const s of seats) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('faces the ping-pong players at each other and the picnic diners at the table', () => {
    const pp = seatPoints({ x: 0, y: 0, width: 184, height: 112, shape: 'ping-pong-table' });
    expect(pp.map((s) => s.facing)).toEqual(['right', 'left']);
    const picnic = seatPoints({ x: 0, y: 0, width: 200, height: 152, shape: 'picnic-table' });
    expect(picnic.filter((s) => s.facing === 'down')).toHaveLength(3);
    expect(picnic.filter((s) => s.facing === 'up')).toHaveLength(3);
  });

  it('blocks only at the base of the scenery pieces', () => {
    const cases = [
      ['jukebox', 72, 112],
      ['arcade-machine', 64, 112],
      ['fireplace', 128, 120],
      ['garden-umbrella', 120, 152],
      ['fountain', 136, 120],
      ['pond', 240, 152],
      ['campfire', 80, 72],
    ] as const;
    for (const [shape, width, height] of cases) {
      expect(isSceneryShape(shape), shape).toBe(true);
      const f = officeFootprint({ x: 0, y: 0, width, height, shape })!;
      expect(f, shape).not.toBeNull();
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(width);
      expect(f.y + f.height).toBeLessThanOrEqual(height);
    }
    // The umbrella's canopy is overhead: only its narrow base is in the way.
    const umbrella = officeFootprint({
      x: 0,
      y: 0,
      width: 120,
      height: 152,
      shape: 'garden-umbrella',
    })!;
    expect(umbrella.width).toBeLessThan(30);
  });

  it('hangs the notice board and the world clock on the wall: nothing to walk into or stand on', () => {
    expect(isWallPieceShape('notice-board')).toBe(true);
    expect(isWallPieceShape('world-clock')).toBe(true);
    expect(isWallPieceShape('jukebox')).toBe(false);
    for (const shape of ['notice-board', 'world-clock'])
      expect(officeFootprint({ x: 0, y: 0, width: 100, height: 60, shape })).toBeNull();
  });
});
