import { describe, expect, it } from 'vitest';
import { svgAspect, thumbnailWidths } from './thumbnail';

describe('svgAspect', () => {
  it('reads the viewBox, then width and height, else 4:3', () => {
    expect(svgAspect('<svg viewBox="0 0 800 400">')).toBe(2);
    expect(svgAspect('<svg width="300" height="300">')).toBe(1);
    expect(svgAspect('<svg>')).toBeCloseTo(4 / 3);
  });
});

describe('thumbnailWidths', () => {
  it('halves from 1600 and ends on the 220 px floor', () => {
    expect(thumbnailWidths()).toEqual([1600, 800, 400, 220]);
    expect(thumbnailWidths(220)).toEqual([220]);
  });
});
