import { describe, expect, it } from 'vitest';
import { SURFACE_MAX_SIDE, visiblePart } from './surface-painter';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('visiblePart', () => {
  const screen = { width: 1000, height: 800 };
  const page = { width: 500, height: 250 };
  const photo = { width: 4000, height: 2000 };

  it('covers the whole sheet when it is all on screen', () => {
    const v = visiblePart(rect(100, 100, 500, 250), screen, page, photo, 2)!;
    expect(v.css).toEqual({ x: 0, y: 0, width: 500, height: 250 });
    expect(v.view).toEqual({ x: 0, y: 0, width: 4000, height: 2000 });
    expect([v.w, v.h]).toEqual([1000, 500]);
    expect(v.perPx).toBeCloseTo(0.125, 6);
  });

  it('draws only the part on screen, at the screen’s resolution, capped', () => {
    // Zoomed in: the sheet is 20000 px wide on screen, its left quarter... off the left edge.
    const v = visiblePart(rect(-5000, -2000, 20000, 10000), screen, page, photo, 2)!;
    expect(v.view.x).toBeCloseTo(1000, 6);
    expect(v.view.width).toBeCloseTo(200, 6);
    expect(v.css.x).toBeCloseTo(125, 6);
    expect(Math.max(v.w, v.h)).toBeLessThanOrEqual(SURFACE_MAX_SIDE);
    expect(v.perPx).toBe(5);
  });

  it('answers nothing for a sheet off screen', () => {
    expect(visiblePart(rect(2000, 0, 100, 100), screen, page, photo, 1)).toBeNull();
  });
});
