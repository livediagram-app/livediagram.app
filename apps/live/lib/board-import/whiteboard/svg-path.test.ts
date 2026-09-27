import { describe, expect, it } from 'vitest';
import { flattenPath } from './svg-path';

describe('flattenPath', () => {
  it('reads absolute moves and lines into one sub-path', () => {
    expect(flattenPath('M 0 0 L 10 0 L 10 10 Z', 2)).toEqual([
      {
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    ]);
  });

  it('reads relative commands, implicit repeats and compact numbers', () => {
    const [sub] = flattenPath('m1,1l2,0 0,2h-2v-2', 2);
    expect(sub!.points).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 1 },
    ]);
    expect(flattenPath('M.5-.5L1e1,2', 2)[0]!.points).toEqual([
      { x: 0.5, y: -0.5 },
      { x: 10, y: 2 },
    ]);
  });

  it('samples cubic beziers at the step and ends on the end point', () => {
    const [sub] = flattenPath('M0 0C0 10 10 10 10 0', 2);
    const last = sub!.points.at(-1)!;
    expect(last).toEqual({ x: 10, y: 0 });
    expect(sub!.points.length).toBeGreaterThan(4);
    const mid = sub!.points[Math.floor(sub!.points.length / 2)]!;
    expect(mid.y).toBeGreaterThan(6);
  });

  it('reads quadratic and smooth curves', () => {
    const [q] = flattenPath('M0 0Q5 10 10 0T20 0', 2);
    expect(q!.points.at(-1)).toEqual({ x: 20, y: 0 });
    const [s] = flattenPath('M0 0C0 5 5 5 5 0S10 -5 10 0', 2);
    expect(s!.points.at(-1)).toEqual({ x: 10, y: 0 });
  });

  it('flattens arcs to their end point', () => {
    const [a] = flattenPath('M0 0A5 5 0 0 1 10 0', 2);
    expect(a!.points.at(-1)!.x).toBeCloseTo(10, 6);
    expect(Math.min(...a!.points.map((p) => p.y))).toBeLessThan(-4);
  });

  it('starts a new sub-path at each move', () => {
    expect(flattenPath('M0 0L1 1M5 5L6 6', 2)).toHaveLength(2);
  });

  it('stops a sub-path at malformed data and keeps what came before', () => {
    const subs = flattenPath('M0 0L1 1L2 x', 2);
    expect(subs).toHaveLength(1);
    expect(subs[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('returns nothing for empty data', () => {
    expect(flattenPath('', 2)).toEqual([]);
  });
});
