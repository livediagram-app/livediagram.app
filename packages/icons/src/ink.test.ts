import { describe, expect, it } from 'vitest';

import { inkInsets, primsBounds } from './ink';

describe('primsBounds', () => {
  it('unions every prim kind', () => {
    expect(
      primsBounds([
        { t: 'path', d: 'M4 4L20 20' },
        { t: 'circle', cx: 12, cy: 2, r: 1 },
        { t: 'rect', x: 2, y: 3, w: 4, h: 5 },
        { t: 'line', x1: 1, y1: 10, x2: 3, y2: 10 },
        { t: 'ellipse', cx: 12, cy: 22, rx: 3, ry: 1 },
        { t: 'polyline', points: '18 6 23 6' },
      ]),
    ).toEqual({ minX: 1, minY: 1, maxX: 23, maxY: 23 });
  });

  it('is null for no geometry', () => {
    expect(primsBounds([])).toBeNull();
  });
});

describe('inkInsets', () => {
  it('measures the blank margin per side in rendered px, stroke included', () => {
    // A 13px arrow drawn 3.5..12.5 on a 16 grid, 1.5px on-screen stroke:
    // ink 3.5 - 0.92 units each side -> margin (3.5 * 13/16) - 0.75 = 2.09px.
    const b = { minX: 3.5, minY: 3.5, maxX: 12.5, maxY: 12.5 };
    expect(inkInsets(b, { units: 16, sizePx: 13, strokePx: 1.5 })).toEqual({
      l: 2.09,
      r: 2.09,
      t: 2.09,
      b: 2.09,
    });
  });

  it('never goes below zero', () => {
    const b = { minX: 0, minY: 0, maxX: 24, maxY: 24 };
    expect(inkInsets(b, { units: 24, sizePx: 24, strokePx: 2 })).toEqual({
      l: 0,
      r: 0,
      t: 0,
      b: 0,
    });
  });

  it('is asymmetric where the drawing is', () => {
    const b = { minX: 2, minY: 4, maxX: 20, maxY: 22 };
    expect(inkInsets(b, { units: 24, sizePx: 24, strokePx: 0 })).toEqual({
      l: 2,
      r: 4,
      t: 4,
      b: 2,
    });
  });
});
