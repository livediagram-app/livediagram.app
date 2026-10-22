import { describe, expect, it } from 'vitest';
import { insidePolygon, segmentDistance } from './segment-geometry';

describe('segmentDistance', () => {
  it('is 0 for crossing segments', () => {
    expect(
      segmentDistance({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(0);
  });

  it('measures the gap between parallel segments', () => {
    expect(segmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 })).toBe(
      4,
    );
  });
});

describe('insidePolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('finds a point inside and one outside', () => {
    expect(insidePolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(insidePolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
