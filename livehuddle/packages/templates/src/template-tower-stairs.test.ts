import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildHotelLobby, buildHotelRooftop, buildHotelSuites } from './template-builders-hotel';
import { buildTowerGround, buildTowerLevel2, buildTowerLevel3 } from './template-builders-tower';

// docs/specs/009-elements/stairs.md "In the templates": the Co-working Tower's Stairs stand beside the North Lift in the
// same place on every floor, so a flight lands a floor away where it started; the Hotel keeps its Elevators only.

type Shape = Extract<Element, { type: 'shape' }>;
const stairsOf = (els: readonly Element[]) =>
  els.filter((e): e is Shape => e.type === 'shape' && e.shape === 'stairs');

describe('Stairs in the building templates', () => {
  it('stands one flight in the same place on every Co-working Tower floor', () => {
    // Each floor is centred on its own height, so the place is read against the floor's North Lift.
    const floors = [buildTowerGround, buildTowerLevel2, buildTowerLevel3].map((build) => {
      const els = build(0, 0);
      const lift = els.find((e): e is Shape => e.type === 'shape' && e.label === 'North Lift')!;
      return stairsOf(els).map((s) => [s.x - lift.x, s.y - lift.y]);
    });
    for (const floor of floors) expect(floor).toHaveLength(1);
    expect(new Set(floors.map((f) => f.join())).size).toBe(1);
  });

  it('keeps the Hotel and Suites to its Elevators', () => {
    for (const build of [buildHotelLobby, buildHotelSuites, buildHotelRooftop])
      expect(stairsOf(build(0, 0))).toHaveLength(0);
  });
});
