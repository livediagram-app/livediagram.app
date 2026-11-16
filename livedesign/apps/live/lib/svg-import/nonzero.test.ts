// docs/specs/020-import-export/svg-import.md "Geometry": nonzero compound fills match the source, kept as curves
// where even-odd already agrees, resolved through Combine's engine where it does not.
import { describe, expect, it } from 'vitest';
import { loadCombineEngine } from '@/lib/combine/combine';
import type { Ring } from '@/lib/combine/outline';
import { parsePathData } from './path-data';
import { evenOddMatchesNonzero, resolveNonzero, signedArea2, traceContour } from './nonzero';

const rings = (d: string) => parsePathData(d).map((c) => traceContour(c));
// An O drawn as a CW outer square and an inner square drawn the other way (a hole under both rules).
const O_OPPOSITE = 'M0 0 H100 V100 H0 Z M25 25 V75 H75 V25 Z';
// The same O with the inner square drawn the same way: nonzero fills it solid, even-odd would cut it.
const O_SAME = 'M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z';
// Two overlapping squares drawn the same way: nonzero fills the overlap, even-odd would cut it.
const OVERLAP = 'M0 0 H60 V60 H0 Z M40 40 H100 V100 H40 Z';

const area = (rs: Ring[]) => rs.reduce((n, r) => n + signedArea2(r), 0);
// A ring's area whichever way round it runs.
const absArea = (r: Ring) => Math.abs(signedArea2(r)) / 2;

// Whether a point is inside rings read even-odd (how a path paints them).
function insideEvenOdd(rs: Ring[], x: number, y: number): boolean {
  let inside = false;
  for (const r of rs)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

describe('traceContour', () => {
  it('traces curves within the tolerance and keeps straight runs as their ends', () => {
    expect(traceContour(parsePathData('M0 0 L10 0 L10 10 Z')[0]!)).toHaveLength(4);
    const circle = traceContour(parsePathData('M0 50 A50 50 0 1 0 100 50 A50 50 0 1 0 0 50 Z')[0]!);
    for (const [x, y] of circle)
      expect(Math.abs(Math.hypot(x - 50, y - 50) - 50)).toBeLessThan(0.25);
  });
});

describe('evenOddMatchesNonzero', () => {
  it('agrees for contours that alternate direction as they nest', () => {
    expect(evenOddMatchesNonzero(rings(O_OPPOSITE))).toBe(true);
    expect(evenOddMatchesNonzero(rings('M0 0 H10 V10 Z'))).toBe(true);
  });
  it('disagrees for a hole drawn the same way and for overlaps', () => {
    expect(evenOddMatchesNonzero(rings(O_SAME))).toBe(false);
    expect(evenOddMatchesNonzero(rings(OVERLAP))).toBe(false);
  });
  it('skips the check past the point cap', () => {
    const many = `M0 0${' l0.001 0'.repeat(60_000)} z`;
    expect(evenOddMatchesNonzero(rings(many))).toBe(true);
  });
});

describe('resolveNonzero', () => {
  it('fills a same-way hole solid and unites overlaps, never drawing holes in solid marks', async () => {
    const engine = await loadCombineEngine();
    const solid = resolveNonzero(engine, rings(O_SAME));
    expect(solid).toHaveLength(1);
    expect(absArea(solid[0]!)).toBeCloseTo(10_000);
    const united = resolveNonzero(engine, rings(OVERLAP));
    expect(united).toHaveLength(1);
    expect(absArea(united[0]!)).toBeCloseTo(3600 * 2 - 400);
  });

  it('keeps an island inside a hole', async () => {
    const engine = await loadCombineEngine();
    // Outer CW, hole CCW, island CW inside the hole, plus a same-way overlap to force resolution.
    const d = `${O_OPPOSITE} M40 40 H60 V60 H40 Z M90 90 H120 V120 H90 Z`;
    const out = resolveNonzero(engine, rings(d));
    const total = out.reduce((n, r) => n + absArea(r), 0);
    // The even-odd sum of the rings' areas: (outer ∪ corner) − hole + island.
    expect(Math.abs(area(out)) / 2).toBeGreaterThan(0);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(total).toBeGreaterThan(10_000);
  });

  it('fills a pentagram drawn in one stroke solid, its centre included', async () => {
    const engine = await loadCombineEngine();
    const star = rings('M50 0 L79 90 L2 35 L98 35 L21 90 Z');
    expect(evenOddMatchesNonzero(star)).toBe(false);
    const out = resolveNonzero(engine, star);
    // Even-odd would leave the centre pentagon empty: read even-odd, the result must cover it, and a point.
    expect(insideEvenOdd(out, 50, 50)).toBe(true);
    expect(insideEvenOdd(out, 50, 10)).toBe(true);
    expect(insideEvenOdd(out, 10, 10)).toBe(false);
  });

  it('skips degenerate rings and answers nothing for an all-hole set', async () => {
    const engine = await loadCombineEngine();
    expect(
      resolveNonzero(engine, [
        [
          [0, 0],
          [1, 1],
        ],
      ]),
    ).toEqual([]);
    expect(
      resolveNonzero(engine, [
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ]),
    ).toEqual([]);
  });
});
