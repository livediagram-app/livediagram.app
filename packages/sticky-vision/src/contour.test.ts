import { describe, expect, it } from 'vitest';
import {
  convexityDefects,
  largestRegion,
  simplifyClosed,
  traceOuterContour,
  type Point,
} from './contour';

// Outlines of a blob of paper: the tools that find the NOTCHES where two
// notes lapped over each other meet. Every shape here is drawn by the test.

function canvas(width: number, height: number) {
  const bin = new Uint8Array(width * height);
  const fill = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) bin[yy * width + xx] = 1;
  };
  return { bin, width, height, fill };
}

describe('traceOuterContour', () => {
  it('walks the border of a filled rectangle once, touching every edge', () => {
    const c = canvas(20, 12);
    c.fill(3, 2, 10, 6);
    const contour = traceOuterContour(c.bin, c.width, c.height);
    const xs = contour.map((p) => p.x);
    const ys = contour.map((p) => p.y);
    expect(Math.min(...xs)).toBe(3);
    expect(Math.max(...xs)).toBe(12);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(7);
    // The perimeter of a 10x6 block traced through pixel centres.
    expect(contour.length).toBe(2 * (9 + 5));
    // Every point is a border pixel: set, with an unset 4-neighbour or the frame.
    for (const p of contour) {
      expect(c.bin[p.y * c.width + p.x]).toBe(1);
    }
  });

  it('returns nothing for an empty mask and one point for a single pixel', () => {
    const c = canvas(5, 5);
    expect(traceOuterContour(c.bin, c.width, c.height)).toEqual([]);
    c.fill(2, 2, 1, 1);
    expect(traceOuterContour(c.bin, c.width, c.height)).toEqual([{ x: 2, y: 2 }]);
  });

  it('follows an L shape round its inside corner', () => {
    const c = canvas(12, 12);
    c.fill(1, 1, 4, 10);
    c.fill(1, 7, 10, 4);
    const contour = traceOuterContour(c.bin, c.width, c.height);
    expect(contour).toContainEqual({ x: 4, y: 6 });
    expect(contour).toContainEqual({ x: 10, y: 10 });
  });
});

describe('largestRegion', () => {
  it('keeps only the biggest 8-connected region', () => {
    const c = canvas(20, 10);
    c.fill(1, 1, 3, 3);
    c.fill(8, 1, 6, 6);
    const kept = largestRegion(c.bin, c.width, c.height);
    expect(kept[2 * c.width + 2]).toBe(0);
    expect(kept[3 * c.width + 10]).toBe(1);
    expect(kept.reduce((a, v) => a + v, 0)).toBe(36);
  });
});

describe('simplifyClosed', () => {
  it('reduces a traced rectangle to its four corners', () => {
    const c = canvas(30, 20);
    c.fill(2, 2, 20, 12);
    const poly = simplifyClosed(traceOuterContour(c.bin, c.width, c.height), 1);
    expect(poly).toHaveLength(4);
    const corners = new Set(poly.map((p) => `${p.x},${p.y}`));
    expect(corners).toEqual(new Set(['2,2', '21,2', '21,13', '2,13']));
  });
});

describe('convexityDefects', () => {
  const traced = (fill: (c: ReturnType<typeof canvas>) => void, w = 60, h = 40): Point[] => {
    const c = canvas(w, h);
    fill(c);
    return traceOuterContour(c.bin, c.width, c.height);
  };

  it('finds no notch in a rectangle', () => {
    const contour = traced((c) => c.fill(5, 5, 30, 20));
    expect(convexityDefects(contour, 2)).toEqual([]);
  });

  it('finds the two notches where two offset notes meet', () => {
    // Two 20x20 notes side by side, the right one dropped by 6: a notch at
    // the top of the seam and one at the bottom.
    const contour = traced((c) => {
      c.fill(5, 5, 20, 20);
      c.fill(25, 11, 20, 20);
    });
    const notches = convexityDefects(contour, 3);
    expect(notches).toHaveLength(2);
    const sorted = [...notches].sort((a, b) => a.at.y - b.at.y);
    expect(sorted[0]!.at).toEqual({ x: 25, y: 11 });
    expect(sorted[1]!.at).toEqual({ x: 24, y: 24 });
    for (const n of notches) expect(n.depth).toBeGreaterThan(3);
  });

  it('ignores notches shallower than asked for', () => {
    const contour = traced((c) => {
      c.fill(5, 5, 20, 20);
      c.fill(25, 6, 20, 20);
    });
    expect(convexityDefects(contour, 3)).toEqual([]);
  });
});
