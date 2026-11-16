// docs/specs/020-import-export/svg-import.md "Geometry" and "Trust and limits": path data read left to right into
// cubic contours, every command, and a CPU-time budget on a huge path string.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Contour, Pt, Segment } from './geometry';
import { parsePathData } from './path-data';
import { NumberScanner, numberList } from './number-scan';

const ends = (c: Contour) => [c.start, ...c.segments.map((s) => s.to)].map((p) => [p.x, p.y]);

// A point along a cubic.
function at(p0: Pt, s: Segment, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
    y: u * u * u * p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y,
  };
}

describe('NumberScanner', () => {
  it('reads numbers that run together, signs, fractions and exponents', () => {
    expect(numberList('1.5.5-2+3e2 4E-1,5')).toEqual([1.5, 0.5, -2, 300, 0.4, 5]);
  });
  it('stops at the first thing that is not a number', () => {
    expect(numberList('1 2 x 3')).toEqual([1, 2]);
    expect(numberList('')).toEqual([]);
  });
  it('leaves an exponent without digits alone', () => {
    const scan = new NumberScanner('2e');
    expect(scan.number()).toBe(2);
    expect(scan.peek()).toBe('e');
  });
  it('reads no number from a lone sign or point, and flags one character at a time', () => {
    expect(new NumberScanner('-').number()).toBeNull();
    expect(new NumberScanner('.').number()).toBeNull();
    const flags = new NumberScanner('102');
    expect([flags.flag(), flags.flag(), flags.flag()]).toEqual([true, false, null]);
    expect(new NumberScanner('').take()).toBe('');
  });
});

describe('parsePathData', () => {
  it('reads absolute lines, horizontal and vertical runs, and closes with a straight segment', () => {
    const [c] = parsePathData('M10 10 L20 10 H30 V20 Z');
    expect(ends(c!)).toEqual([
      [10, 10],
      [20, 10],
      [30, 10],
      [30, 20],
      [10, 10],
    ]);
    expect(c!.closed).toBe(true);
    expect(c!.segments.every((s) => s.line)).toBe(true);
  });

  it('reads relative commands, and pairs after a move as lines', () => {
    const [c] = parsePathData('m5 5 10 0 0 10 h-10 v-10z');
    expect(ends(c!)).toEqual([
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
      [5, 5],
    ]);
  });

  it('keeps each subpath, a move-only one left out, and a relative move after Z from the start', () => {
    const cs = parsePathData('M0 0 L10 0 L10 10 Z m2 2 l3 0 l0 3 z M50 50');
    expect(cs).toHaveLength(2);
    expect(cs[1]!.start).toEqual({ x: 2, y: 2 });
  });

  it('reflects the previous control point for S and T', () => {
    const [c] = parsePathData('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
    expect(c!.segments[1]!.c1).toEqual({ x: 10, y: -10 });
    const [q] = parsePathData('M0 0 Q5 10 10 0 T20 0');
    // The reflected quadratic control is (15, -10); raised to a cubic its first handle is 2/3 of the way there.
    expect(q!.segments[1]!.c1.x).toBeCloseTo(10 + (5 * 2) / 3);
    expect(q!.segments[1]!.c1.y).toBeCloseTo((-10 * 2) / 3);
  });

  it('takes the pen as the first control for an S or T with no curve before it', () => {
    const [c] = parsePathData('M1 1 S5 5 9 1 M0 0 T4 0');
    expect(c!.segments[0]!.c1).toEqual({ x: 1, y: 1 });
  });

  it('raises a quadratic to the cubic that draws it exactly', () => {
    const [c] = parsePathData('M0 0 Q50 100 100 0');
    const mid = at({ x: 0, y: 0 }, c!.segments[0]!, 0.5);
    // A quadratic's midpoint is (p0 + 2q + p1) / 4.
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(50);
  });

  it('reads arcs with flags run together, within 0.25 px of the circle', () => {
    const [c] = parsePathData('M0 50a50 50 0 10100 0a50 50 0 10-100 0z', 4);
    expect(c!.segments.length).toBeGreaterThanOrEqual(4);
    let p0 = c!.start;
    for (const s of c!.segments) {
      if (s.line) break;
      for (let t = 0; t <= 1; t += 0.1) {
        const p = at(p0, s, t);
        // Drawn at 4 px per unit, so the radius lands at 200 px.
        expect(Math.abs(Math.hypot(p.x - 50, p.y - 50) - 50) * 4).toBeLessThan(0.25);
      }
      p0 = s.to;
    }
  });

  it('draws a zero-radius arc as a line and an arc to its own start as nothing', () => {
    const [c] = parsePathData('M0 0 A0 5 0 0 1 10 0 A5 5 0 0 1 10 0 L20 0');
    expect(c!.segments).toHaveLength(2);
    expect(c!.segments[0]!.line).toBe(true);
  });

  it('stops at an error and keeps what came before', () => {
    expect(ends(parsePathData('M0 0 L10 0 L10 # 20 20')[0]!)).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(parsePathData('10 10 L 5 5')).toEqual([]);
    expect(parsePathData('M0 0 L10 0 Z 5 5')).toHaveLength(1);
    expect(parsePathData('M0 0 A5 5 0 2 1 10 0')).toEqual([]);
    expect(parsePathData('M0 0 L10')).toEqual([]);
  });

  it('reads a huge path string in linear time', () => {
    const d = `M0 0${' l1 1'.repeat(100_000)}`;
    const spaces = `M0 0 L${' '.repeat(200_000)}1 1`;
    const digits = `M${'9'.repeat(100_000)} 0`;
    let count = 0;
    const ms = cpuMsOf(() => {
      count = parsePathData(d)[0]!.segments.length;
      parsePathData(spaces);
      parsePathData(digits);
    });
    expect(count).toBe(100_000);
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
