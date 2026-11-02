import { describe, expect, it } from 'vitest';
import { segmentDistance } from './segment-geometry';

describe('segmentDistance', () => {
  it('is zero for segments that cross', () => {
    expect(
      segmentDistance({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(0);
  });

  it('measures the closest ends of parallel segments', () => {
    expect(segmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 })).toBe(
      4,
    );
  });

  it('measures from an end to the other segment, past its end', () => {
    expect(segmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 13, y: 4 }, { x: 20, y: 4 })).toBe(
      5,
    );
  });

  it('measures a segment of no length to its point', () => {
    expect(segmentDistance({ x: 3, y: 4 }, { x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});
