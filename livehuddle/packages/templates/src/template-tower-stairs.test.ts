import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildHotelLobby, buildHotelRooftop, buildHotelSuites } from './template-builders-hotel';
import { buildTowerGround, buildTowerLevel2, buildTowerLevel3 } from './template-builders-tower';

// docs/specs/009-elements/stairs.md "In the templates": the Co-working Tower's Stairs stand beside the North Lift in the
// same place on every floor, so a flight lands a floor away where it started; the Hotel has one beside each floor's lift.

type Shape = Extract<Element, { type: 'shape' }>;
// How far below a flight's foot a character steps off (stairsFootPoint: the spawn gap and a standing figure).
const STEP_OFF = 160;
type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
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

  it('stands one flight on every Hotel and Suites floor beside its lift, open floor below it to step off onto', () => {
    // Work Tracker #641: a guest can walk up as well as ride. The lifts stand in a different place on each floor, so
    // the Stairs do too; with one flight a floor, a climb always lands on that floor's.
    for (const build of [buildHotelLobby, buildHotelSuites, buildHotelRooftop]) {
      const els = build(0, 0);
      const flights = stairsOf(els);
      expect(flights).toHaveLength(1);
      const s = flights[0]!;
      const lift = els.find((e): e is Shape => e.type === 'shape' && e.shape === 'elevator')!;
      // Beside the lift: within two lifts' widths of it.
      const gap = Math.max(
        s.x - (lift.x + lift.width),
        lift.x - (s.x + s.width),
        s.y - (lift.y + lift.height),
        lift.y - (s.y + s.height),
      );
      expect(gap).toBeLessThanOrEqual(lift.width * 2);
      // The strip a character steps off into, a figure's height below the flight, holds nothing to stand on.
      const below = { x: s.x, y: s.y + s.height, width: s.width, height: STEP_OFF };
      for (const e of els)
        if (e.type === 'shape' && !['room', 'stairs'].includes(e.shape))
          expect(meets(e, below), `${e.shape} at ${e.x},${e.y}`).toBe(false);
    }
  });
});
