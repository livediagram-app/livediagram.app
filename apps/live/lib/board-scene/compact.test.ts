import { describe, expect, it } from 'vitest';
import type { Element, FreehandElement, PathElement } from '@livediagram/document';
import {
  LANDED_POINT_TOLERANCE_PX,
  MAX_POINT_DECIMALS,
  compactLanded,
  pointDecimals,
  roundTo,
} from './compact';

// docs/specs/020-import-export/board-scene.md "Compact output".
describe('pointDecimals', () => {
  it.each([
    [0.5, 1],
    [1, 1],
    [10, 2],
    [100, 3],
    [1_000, 4],
    [4_000, 5],
    [100_000, 6],
  ])('a %s px box takes %s decimals', (size, d) => {
    expect(pointDecimals(size)).toBe(d);
  });

  it('holds the error bound at every size, and takes the fewest decimals that do', () => {
    for (const size of [0.01, 1, 7, 99.9, 100, 100.1, 1234.5, 99_999, 1e6]) {
      const d = pointDecimals(size);
      expect(0.5 * 10 ** -d * size).toBeLessThanOrEqual(LANDED_POINT_TOLERANCE_PX + 1e-12);
      if (d > 0) expect(0.5 * 10 ** -(d - 1) * size).toBeGreaterThan(LANDED_POINT_TOLERANCE_PX);
    }
  });

  it('stays in range for broken and enormous sizes', () => {
    expect(pointDecimals(0)).toBe(0);
    expect(pointDecimals(Number.NaN)).toBe(MAX_POINT_DECIMALS);
    expect(pointDecimals(1e30)).toBe(MAX_POINT_DECIMALS);
  });
});

const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 10.123456,
  y: 20.987654,
  width: 4000,
  height: 3000.000001,
  points: [
    { nx: 0.123456789, ny: 0.987654321 },
    { nx: 1 / 3, ny: 2 / 3 },
  ],
  closed: false,
  penWidth: 1.5,
  streamline: 0,
  pressures: [0.123456, 0.9876543],
  ...over,
});

describe('compactLanded', () => {
  it('rounds a stroke’s points within the tolerance at its size, pressures to 1/1000', () => {
    const [out] = compactLanded([stroke()]) as FreehandElement[];
    expect(out!.points[0]).toEqual({ nx: 0.12346, ny: 0.98765 });
    expect(out!.pressures).toEqual([0.123, 0.988]);
    expect({ x: out!.x, y: out!.y, width: out!.width, height: out!.height }).toEqual({
      x: 10.12,
      y: 20.99,
      width: 4000,
      height: 3000,
    });
    // The drawn error, in canvas px, stays under the tolerance.
    const source = stroke();
    source.points.forEach((p, i) => {
      expect(Math.abs(p.nx - out!.points[i]!.nx) * source.width).toBeLessThanOrEqual(
        LANDED_POINT_TOLERANCE_PX,
      );
      expect(Math.abs(p.ny - out!.points[i]!.ny) * source.height).toBeLessThanOrEqual(
        LANDED_POINT_TOLERANCE_PX,
      );
    });
  });

  it('keeps a tiny stroke’s shape: few decimals, still within the tolerance', () => {
    const [out] = compactLanded([
      stroke({ width: 2, height: 1, points: [{ nx: 0.123456, ny: 0.987654 }] }),
    ]) as FreehandElement[];
    expect(out!.points[0]).toEqual({ nx: 0.12, ny: 0.99 });
  });

  it('drops a zero streamline and full opacity, which the renderer reads as their absence', () => {
    const [out] = compactLanded([stroke({ opacity: 1 })]) as FreehandElement[];
    expect('streamline' in out!).toBe(false);
    expect('opacity' in out!).toBe(false);
    const [kept] = compactLanded([stroke({ streamline: 0.5, opacity: 0.4 })]) as FreehandElement[];
    expect(kept).toMatchObject({ streamline: 0.5, opacity: 0.4 });
  });

  it('rounds a path’s nodes and handles at its size', () => {
    const path: PathElement = {
      id: 'p',
      type: 'path',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      closed: false,
      nodes: [
        { nx: 0.11111, ny: 0.22222, mode: 'mirrored', handleOut: { nx: 0.33333, ny: 0.44444 } },
        { nx: 1, ny: 1, mode: 'corner', handleIn: { nx: 0.55555, ny: 0.66666 } },
      ],
    };
    const [out] = compactLanded([path]) as PathElement[];
    expect(out!.nodes[0]).toEqual({
      nx: 0.111,
      ny: 0.222,
      mode: 'mirrored',
      handleOut: { nx: 0.333, ny: 0.444 },
    });
    expect(out!.nodes[1]!.handleIn).toEqual({ nx: 0.556, ny: 0.667 });
  });

  it('rounds an arrow’s free ends to the box precision, leaving pinned ones alone', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 1.23456, y: 2.34567 },
      to: { kind: 'pinned', elementId: 'b', anchor: 'e' },
    } as Element;
    const [out] = compactLanded([arrow]);
    expect(out).toMatchObject({ from: { kind: 'free', x: 1.23, y: 2.35 }, to: { kind: 'pinned' } });
  });

  it('returns what it cannot shorten as it is', () => {
    const sticky = { id: 'n', type: 'sticky', x: 1, y: 2, width: 10, height: 10 } as Element;
    expect(compactLanded([sticky])[0]).toEqual(sticky);
  });
});

describe('roundTo', () => {
  it('rounds half away from zero, and turns -0 into 0', () => {
    expect(roundTo(0.125, 2)).toBe(0.13);
    expect(roundTo(-0.0001, 2)).toBe(0);
    expect(Object.is(roundTo(-0.0001, 2), -0)).toBe(false);
  });
});
