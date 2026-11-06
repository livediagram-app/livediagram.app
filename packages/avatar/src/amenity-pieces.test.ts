import { describe, expect, it } from 'vitest';
import {
  isFixedSeatShape,
  isSceneryShape,
  isWallPieceShape,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { elementUnderFeet } from './walk';

// livehuddle's docs/specs/009-elements/office-amenities.md "How each one walks": the footprints, the counter-top and
// wall pieces, and nobody seated.
describe('the office amenities', () => {
  const SCENERY = [
    ['printer', 72, 80],
    ['copier', 104, 128],
    ['lockers', 136, 132],
    ['coat-rack', 56, 128],
    ['umbrella-stand', 40, 64],
    ['kitchen-counter', 112, 88],
    ['kitchen-sink', 112, 88],
    ['fridge', 72, 136],
    ['toilet-cubicle', 96, 152],
    ['washbasin', 72, 112],
  ] as const;

  it('blocks with a footprint in the bottom of each standing piece, never its top', () => {
    for (const [shape, width, height] of SCENERY) {
      expect(isSceneryShape(shape), shape).toBe(true);
      const f = officeFootprint({ x: 0, y: 0, width, height, shape })!;
      expect(f.x, shape).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width, shape).toBeLessThanOrEqual(width);
      expect(f.y, shape).toBeGreaterThanOrEqual(height * 0.4);
      expect(f.y + f.height, shape).toBeLessThanOrEqual(height);
    }
  });

  it('joins kitchen units and cubicles side by side into one barrier', () => {
    for (const shape of ['kitchen-counter', 'kitchen-sink', 'toilet-cubicle']) {
      const a = officeFootprint({ x: 0, y: 0, width: 100, height: 100, shape })!;
      const b = officeFootprint({ x: 100, y: 0, width: 100, height: 100, shape })!;
      expect(a.x + a.width, shape).toBe(b.x);
    }
  });

  it('walks past the hand dryer, and the microwave and kettle on a counter: nothing to block or stand on', () => {
    for (const shape of ['hand-dryer', 'microwave', 'kettle']) {
      expect(isWallPieceShape(shape), shape).toBe(true);
      expect(isSceneryShape(shape), shape).toBe(false);
      expect(officeFootprint({ x: 0, y: 0, width: 60, height: 40, shape }), shape).toBeNull();
      const piece = { id: shape, type: 'shape', x: 0, y: 0, width: 60, height: 40, shape };
      expect(elementUnderFeet([piece], { x: 30, y: 20 }), shape).toBeNull();
    }
  });

  it('seats nobody', () => {
    for (const shape of [...SCENERY.map(([s]) => s), 'hand-dryer', 'microwave', 'kettle']) {
      expect(isFixedSeatShape(shape), shape).toBe(false);
      expect(seatsACharacter(shape), shape).toBe(false);
    }
  });
});
