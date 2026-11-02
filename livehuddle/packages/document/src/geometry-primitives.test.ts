import { describe, expect, it } from 'vitest';
import {
  boundsOfPoints,
  clamp,
  distToSegment,
  pointInRect,
  rectsIntersect,
  unionRects,
  type Rect,
} from './index';

describe('clamp', () => {
  it('pins a value into the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('lets the lower bound win an inverted range', () => {
    // A popover wider than the viewport sits at the leading margin.
    expect(clamp(50, 8, -20)).toBe(8);
  });
});

describe('rectsIntersect', () => {
  const a: Rect = { x: 0, y: 0, width: 10, height: 10 };

  it('is true for overlapping rects', () => {
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it('is exclusive: rects that only share an edge do not intersect', () => {
    expect(rectsIntersect(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsIntersect(a, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
  });
});

describe('pointInRect', () => {
  const r: Rect = { x: 0, y: 0, width: 10, height: 10 };

  it('is inclusive: a point on the edge is inside', () => {
    expect(pointInRect(r, { x: 10, y: 10 })).toBe(true);
    expect(pointInRect(r, { x: 0, y: 5 })).toBe(true);
  });

  it('is false outside', () => {
    expect(pointInRect(r, { x: 10.01, y: 5 })).toBe(false);
  });
});

describe('distToSegment', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it('is zero for a point on the segment', () => {
    expect(distToSegment({ x: 5, y: 0 }, a, b)).toBe(0);
  });

  it('is the perpendicular distance for a point beside the segment', () => {
    expect(distToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
  });

  it('clamps past the endpoints (distance to the nearer end)', () => {
    expect(distToSegment({ x: 20, y: 0 }, a, b)).toBeCloseTo(10);
    expect(distToSegment({ x: -5, y: 0 }, a, b)).toBeCloseTo(5);
  });

  it('handles a degenerate zero-length segment as point distance', () => {
    expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('unionRects', () => {
  it('returns null for no rects', () => {
    expect(unionRects([])).toBeNull();
  });

  it('returns a lone rect unchanged', () => {
    const only: Rect = { x: 10, y: 20, width: 30, height: 40 };
    expect(unionRects([only])).toEqual(only);
  });

  it('takes the outermost edges across disjoint and overlapping rects', () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 50, height: 30 },
        { x: 80, y: 100, width: 20, height: 40 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 100, height: 140 });
    expect(
      unionRects([
        { x: 0, y: 0, width: 60, height: 60 },
        { x: 40, y: 40, width: 60, height: 60 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('reads any iterable, such as a Map of drag start bounds', () => {
    const starts = new Map([['a', { x: -5, y: 0, width: 10, height: 10 }]]);
    expect(unionRects(starts.values())).toEqual({ x: -5, y: 0, width: 10, height: 10 });
  });
});

describe('boundsOfPoints', () => {
  it('returns null for no points', () => {
    expect(boundsOfPoints([])).toBeNull();
  });

  it('spans every point', () => {
    expect(
      boundsOfPoints([
        { x: 3, y: -2 },
        { x: -1, y: 7 },
        { x: 4, y: 0 },
      ]),
    ).toEqual({ x: -1, y: -2, width: 5, height: 9 });
  });
});
