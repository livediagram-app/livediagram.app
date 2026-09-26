import { describe, expect, it } from 'vitest';
import { holdsPoint, iou, overlapArea } from './rect';

describe('overlapArea', () => {
  it('is the shared area, 0 when apart or only touching', () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 })).toBe(0);
  });
});

describe('iou', () => {
  it('is 1 for the same box and 0 for disjoint boxes', () => {
    const a = { x: 3, y: 4, w: 20, h: 10 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 100, y: 100, w: 5, h: 5 })).toBe(0);
  });

  it('is intersection over union', () => {
    // 25 shared, 100 + 100 - 25 = 175 in all.
    expect(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBeCloseTo(25 / 175);
  });

  it('scores two empty boxes 0, not NaN', () => {
    const empty = { x: 5, y: 5, w: 0, h: 0 };
    expect(iou(empty, empty)).toBe(0);
  });
});

describe('holdsPoint', () => {
  it('is inclusive of the edges', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(holdsPoint(r, 0, 0)).toBe(true);
    expect(holdsPoint(r, 10, 10)).toBe(true);
    expect(holdsPoint(r, 10.5, 5)).toBe(false);
  });
});
