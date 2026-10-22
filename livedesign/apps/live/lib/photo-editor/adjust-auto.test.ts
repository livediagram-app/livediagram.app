import { describe, expect, it } from 'vitest';
import { histogramOf } from '@livedesign/photo-engine';
import { solid } from './photo-test-utils';
import { autoCurves, autoLevels } from './adjust-auto';
import { cancelNeutral, pickNeutral, takeNeutral } from './neutral-pick';

// docs/specs/031-photo/photo-adjustments.md "The adjustments": Levels' and Curves' Auto, White Balance's
// picker.
const dull = () => {
  const r = solid(16, 1, [0, 0, 0, 255]);
  for (let x = 0; x < 16; x++) r.data.set([60 + x * 8, 80 + x * 6, 70 + x * 7, 255], x * 4);
  return r;
};

describe('Auto', () => {
  it('stretches each channel to its own range, as Levels or as each channel’s curve', () => {
    const h = histogramOf(dull(), 1);
    const levels = autoLevels(h);
    expect(levels.red.inBlack).toBe(60);
    expect(levels.red.inWhite).toBe(180);
    const curves = autoCurves(h);
    expect(curves.rgb).toEqual([
      [0, 0],
      [255, 255],
    ]);
    expect(curves.green).toEqual([
      [80, 0],
      [170, 255],
    ]);
  });
});

describe('the neutral picker', () => {
  it('takes the next press once, and nothing when none is waiting or it was let go', () => {
    expect(takeNeutral([1, 2, 3])).toBe(false);
    const got: number[][] = [];
    pickNeutral((rgb) => got.push(rgb));
    expect(takeNeutral([10, 20, 30])).toBe(true);
    expect(takeNeutral([10, 20, 30])).toBe(false);
    expect(got).toEqual([[10, 20, 30]]);
    pickNeutral((rgb) => got.push(rgb));
    cancelNeutral();
    expect(takeNeutral([1, 1, 1])).toBe(false);
    pickNeutral((rgb) => got.push(rgb));
    expect(takeNeutral(null)).toBe(true);
    expect(got).toHaveLength(1);
  });
});
