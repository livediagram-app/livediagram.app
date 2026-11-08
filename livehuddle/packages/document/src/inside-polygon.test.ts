import { describe, expect, it } from 'vitest';
import { insidePolygon } from './inside-polygon';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe('insidePolygon', () => {
  it('is true inside a closed outline and false outside it', () => {
    expect(insidePolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(insidePolygon({ x: 150, y: 50 }, square)).toBe(false);
    expect(insidePolygon({ x: 50, y: -1 }, square)).toBe(false);
  });

  it('reads a concave outline by even-odd: the notch is outside', () => {
    // A U: the notch between the arms runs from x 40 to 60, down to y 60.
    const u = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 60 },
      { x: 60, y: 60 },
      { x: 60, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(insidePolygon({ x: 50, y: 30 }, u)).toBe(false);
    expect(insidePolygon({ x: 20, y: 30 }, u)).toBe(true);
    expect(insidePolygon({ x: 50, y: 80 }, u)).toBe(true);
  });

  it('holds nothing with fewer than three points', () => {
    expect(insidePolygon({ x: 0, y: 0 }, [])).toBe(false);
    expect(insidePolygon({ x: 5, y: 5 }, square.slice(0, 2))).toBe(false);
  });
});
