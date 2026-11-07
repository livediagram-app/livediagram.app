import { describe, expect, it } from 'vitest';
import {
  footprintFraction,
  isFixedSeatShape,
  isSceneryShape,
  isWallPieceShape,
  OFFICE_FOOTPRINT_TURNED,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { mirrorFraction } from './facing';
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

// livehuddle's docs/specs/009-elements/furniture-facing.md "A turn": what blocks turns with it.
describe('the office amenities turned', () => {
  const TURNING = [
    'printer',
    'copier',
    'lockers',
    'kitchen-counter',
    'kitchen-sink',
    'fridge',
    'toilet-cubicle',
    'washbasin',
  ] as const;

  it('blocks with each standing piece’s front footprint facing down and from behind, its own on its side', () => {
    for (const shape of TURNING) {
      const turned = OFFICE_FOOTPRINT_TURNED[shape]!;
      const front = footprintFraction(shape)!;
      expect(footprintFraction(shape, 'n'), shape).toEqual(front);
      expect(footprintFraction(shape, 's'), shape).toEqual(front);
      expect(footprintFraction(shape, 'e'), shape).toEqual(turned.side);
      expect(footprintFraction(shape, 'w'), shape).toEqual(mirrorFraction(turned.side));
      for (const f of [turned.side, mirrorFraction(turned.side)]) {
        expect(f.x0, shape).toBeGreaterThanOrEqual(0);
        expect(f.x1, shape).toBeLessThanOrEqual(1);
        expect(f.y1, shape).toBeLessThanOrEqual(1);
        expect(f.x0 < f.x1 && f.y0 < f.y1, shape).toBe(true);
      }
    }
  });

  it('blocks from behind where a piece’s own back footprint says, else where its front does', () => {
    const entries = Object.entries(OFFICE_FOOTPRINT_TURNED);
    const withBack = entries.filter(([, t]) => t!.back);
    expect(withBack.length).toBeGreaterThan(0);
    for (const [shape, t] of entries)
      expect(footprintFraction(shape, 's'), shape).toEqual(
        t!.back ?? footprintFraction(shape, 'n'),
      );
  });

  it('blocks nothing for a piece with no footprint, and a piece that never turns blocks the same at every facing', () => {
    expect(footprintFraction('microwave', 'e')).toBeUndefined();
    const rack = footprintFraction('coat-rack');
    for (const facing of ['n', 'e', 's', 'w'] as const)
      expect(footprintFraction('coat-rack', facing)).toEqual(rack);
  });

  it('stands a bank of lockers on a side wall: narrow, long, blocking along the wall, the mirror on the other', () => {
    // The side drawing is 56 x 204: at the front's scale, a box 56 wide and 204 tall.
    const left = officeFootprint({
      x: 0,
      y: 0,
      width: 56,
      height: 204,
      shape: 'lockers',
      chairFacing: 'e',
    })!;
    expect(left.height).toBeGreaterThan(left.width * 1.5);
    expect(left.y + left.height).toBeLessThanOrEqual(204);
    const right = officeFootprint({
      x: 0,
      y: 0,
      width: 56,
      height: 204,
      shape: 'lockers',
      chairFacing: 'w',
    })!;
    expect(right.x).toBeCloseTo(56 - (left.x + left.width));
    expect(right.width).toBeCloseTo(left.width);
    // Facing up it stands on the same ground as facing down.
    const down = officeFootprint({ x: 0, y: 0, width: 136, height: 132, shape: 'lockers' })!;
    expect(
      officeFootprint({ x: 0, y: 0, width: 136, height: 132, shape: 'lockers', chairFacing: 's' }),
    ).toEqual(down);
  });

  it('joins kitchen units and cubicles end to end down a side wall into one barrier', () => {
    for (const shape of ['kitchen-counter', 'kitchen-sink', 'toilet-cubicle'])
      for (const chairFacing of ['e', 'w'] as const) {
        const a = officeFootprint({ x: 0, y: 0, width: 64, height: 112, shape, chairFacing })!;
        const b = officeFootprint({ x: 0, y: 112, width: 64, height: 112, shape, chairFacing })!;
        expect(a.y + a.height, shape).toBe(b.y);
        expect([a.x, a.width], shape).toEqual([b.x, b.width]);
      }
  });
});
