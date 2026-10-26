import { describe, expect, it } from 'vitest';
import { laneSeamTravel } from './lane-seam-travel';

describe('laneSeamTravel', () => {
  it('reads the screen axis of an upright lane', () => {
    expect(laneSeamTravel(30, 5, 0, false)).toBe(30);
    expect(laneSeamTravel(30, 5, 0, true)).toBe(5);
  });

  it('reads a quarter-turned side strip from the vertical drag', () => {
    // Turned clockwise a quarter, the lane's own x points down the screen.
    expect(laneSeamTravel(0, 40, 90, false)).toBeCloseTo(40);
    expect(laneSeamTravel(40, 0, 90, false)).toBeCloseTo(0);
  });

  it('reads a quarter-turned band from the horizontal drag', () => {
    // Its own y points left on screen, so a drag left grows it.
    expect(laneSeamTravel(-40, 0, 90, true)).toBeCloseTo(40);
  });

  it('reverses a half-turned lane', () => {
    expect(laneSeamTravel(25, 0, 180, false)).toBeCloseTo(-25);
  });
});
