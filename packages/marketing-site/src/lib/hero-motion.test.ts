import { describe, expect, it } from 'vitest';
import { cursorRide, polylinePath, polylineStops } from './hero-motion';

// docs/specs/019-marketing/marketing-site.md "Hero": a cursor's path and stops come from the layout.
describe('the hero cursors’ motion paths', () => {
  it('draws the points as one polyline', () => {
    expect(
      polylinePath([
        [0, 0],
        [30, 40],
        [30, 100],
      ]),
    ).toBe('M0 0 L30 40 L30 100');
  });

  it('places each stop at its share of the length, the last at 100%', () => {
    expect(
      polylineStops([
        [0, 0],
        [30, 40],
        [30, 100],
      ]),
    ).toEqual([45.45, 100]);
  });

  it('hands the keyframes the path and the stops as --p1, --p2 ...', () => {
    const ride = cursorRide([
      [0, 0],
      [0, 10],
      [0, 40],
    ]);
    expect(ride).toEqual({ offsetPath: "path('M0 0 L0 10 L0 40')", '--p1': '25%', '--p2': '100%' });
  });
});
