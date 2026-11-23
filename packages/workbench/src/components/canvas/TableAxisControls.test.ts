import { describe, expect, it } from 'vitest';
import { plusDodgeTrack } from './TableAxisControls';

// docs/specs/008-canvas/canvas-and-palette.md Table: a row or column trigger whose centre would land under the
// edge-midpoint quick-connect plus steps aside. Only that one does.

describe('plusDodgeTrack', () => {
  it('picks only the track under the plus when the tracks are short', () => {
    // Three 30px rows on a phone, a 40px clearance: every centre is within reach of the midpoint (45), but only
    // the middle row is under the plus.
    expect(plusDodgeTrack([30, 30, 30], 90, 40)).toBe(1);
  });

  it('picks the nearer of two tracks straddling the midpoint', () => {
    expect(plusDodgeTrack([30, 30], 60, 40)).toBe(0);
    expect(plusDodgeTrack([20, 40], 60, 40)).toBe(1);
  });

  it('picks none when no centre is near the plus', () => {
    expect(plusDodgeTrack([100, 100], 200, 40)).toBe(-1);
  });

  it('follows pinned sizes', () => {
    // Centres at 10, 60, 160: the midpoint is 105, and only the middle one (45 away) is past the clearance.
    expect(plusDodgeTrack([20, 80, 110], 210, 40)).toBe(-1);
    expect(plusDodgeTrack([20, 80, 110], 210, 50)).toBe(1);
  });
});
