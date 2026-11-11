import { describe, expect, it } from 'vitest';
import { inheritedSnap, paintedBaseline } from './optical-snap';

describe('paintedBaseline', () => {
  it('rounds the layout baseline to the nearest whole CSS pixel', () => {
    expect(paintedBaseline(708.46875)).toBe(708);
    expect(paintedBaseline(28.53125)).toBe(29);
    expect(paintedBaseline(31)).toBe(31);
  });

  it('rounds a baseline exactly half way down the pixel up', () => {
    expect(paintedBaseline(29.5)).toBe(30);
  });
});

describe('inheritedSnap', () => {
  it('is zero for a shape on a whole pixel', () => {
    expect(inheritedSnap(707.90625, 690)).toBe(0);
  });

  it('is the shift a fractional position adds to the snap a whole pixel would give', () => {
    // The Share dialog's avatar: a 28px disc at y + 0.5625, its 11px initials' baseline 17.906px down.
    // On a whole pixel the baseline snaps 0.094px down; here it snaps 0.469px up.
    expect(inheritedSnap(708.46875, 690.5625)).toBeCloseTo(-0.5625, 10);
  });

  it('keeps the snap that comes from the shape itself out of the result', () => {
    // Same local baseline (17.906px down), any whole-pixel top: nothing is inherited.
    expect(inheritedSnap(17.90625, 0)).toBe(0);
    expect(inheritedSnap(1017.90625, 1000)).toBe(0);
  });

  it('depends on the fractional part of the position only', () => {
    expect(inheritedSnap(20.46875, 2.5625)).toBeCloseTo(inheritedSnap(708.46875, 690.5625), 10);
  });

  it('can push the reading either way', () => {
    // Rounds 0.469px down here, but 0.281px up on a whole pixel: the fraction moves it 0.75px down.
    expect(inheritedSnap(28.53125, 20.25)).toBeCloseTo(0.75, 10);
  });
});
