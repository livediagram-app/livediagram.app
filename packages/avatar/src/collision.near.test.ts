import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  fenceReachFor,
  fenceSegments,
  fencesNear,
  fenceStep,
  sameFences,
  type FenceSegment,
} from './collision';

const line = (ax: number, ay: number, bx: number, by: number): FenceSegment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
});

describe('fencesNear', () => {
  it('keeps the fences whose box comes within the radius, in order, and drops the rest', () => {
    const near = line(0, 10, 100, 10);
    const far = line(500, 500, 600, 500);
    const nearToo = line(5, -20, 5, -5);
    expect(fencesNear({ x: 0, y: 0 }, 15, [near, far, nearToo])).toEqual([near, nearToo]);
  });

  it('keeps a far edge of a footprint the walker stands inside, and drops it from outside', () => {
    const edge: FenceSegment = { ...line(0, 0, 1000, 0), solid: { x: 0, y: 0, width: 1000, height: 1000 } };
    expect(fencesNear({ x: 500, y: 500 }, 20, [edge])).toEqual([edge]);
    expect(fencesNear({ x: 500, y: 1500 }, 20, [edge])).toEqual([]);
  });
});

describe('fencesNear on a big list', () => {
  // 100 short lines in a row, 300 px apart, so the grid answers; one wall long enough to sit outside it.
  const row = Array.from({ length: 100 }, (_, i) => line(i * 300, 0, i * 300 + 50, 0));
  const long = line(-1e6, 1000, 1e6, 1000);
  const edge: FenceSegment = { ...line(0, 5000, 4000, 5000), solid: { x: 0, y: 5000, width: 4000, height: 4000 } };
  const fences = [...row, long, edge, line(10, 5, 20, 5)];

  it('finds the same fences as a scan of the whole list, in order', () => {
    const scan = (from: { x: number; y: number }, radius: number) =>
      fences.filter((f) => fencesNear(from, radius, [f]).length > 0);
    for (const from of [
      { x: 0, y: 0 },
      { x: 3000, y: 990 },
      { x: 2000, y: 7000 },
      { x: 29_990, y: -5 },
      { x: -50_000, y: -50_000 },
    ])
      expect(fencesNear(from, 20, fences)).toEqual(scan(from, 20));
  });

  it('scans the list for a reach wider than the grid helps with', () => {
    expect(fencesNear({ x: 0, y: 0 }, 1e6, fences)).toEqual(fences);
  });
});

describe('sameFences', () => {
  const solid = { x: 0, y: 0, width: 10, height: 10 };
  it('matches the same list and a fresh list of the same lines', () => {
    const p = [line(0, 0, 1, 1), { ...line(2, 2, 3, 3), solid }];
    expect(sameFences(p, p)).toBe(true);
    expect(sameFences(p, [line(0, 0, 1, 1), { ...line(2, 2, 3, 3), solid: { ...solid } }])).toBe(true);
  });

  it('tells apart a moved line, another length and a footprint gained, lost or moved', () => {
    const p = [{ ...line(0, 0, 1, 1), solid }];
    expect(sameFences(p, [])).toBe(false);
    expect(sameFences(p, [{ ...line(0, 0, 1, 2), solid }])).toBe(false);
    expect(sameFences(p, [line(0, 0, 1, 1)])).toBe(false);
    expect(sameFences([line(0, 0, 1, 1)], p)).toBe(false);
    expect(sameFences(p, [{ ...line(0, 0, 1, 1), solid: { ...solid, x: 1 } }])).toBe(false);
    expect(sameFences(p, [{ ...line(0, 0, 1, 1), solid: { ...solid, y: 1 } }])).toBe(false);
    expect(sameFences(p, [{ ...line(0, 0, 1, 1), solid: { ...solid, width: 1 } }])).toBe(false);
    expect(sameFences(p, [{ ...line(0, 0, 1, 1), solid: { ...solid, height: 1 } }])).toBe(false);
  });
});

describe('fenceStep on a big board', () => {
  // A 100-room office with 2,000 pieces of scenery: about 10,000 wall lines. Every walking frame steps once, and a step
  // into a wall tests up to nine points; before, each tested every line on the board (5 ms a frame at this size).
  const elements = [
    ...Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      type: 'shape',
      shape: 'room',
      x: (i % 10) * 500,
      y: Math.floor(i / 10) * 400,
      width: 460,
      height: 360,
      roomDoor: 's',
    })),
    ...Array.from({ length: 2000 }, (_, i) => ({
      id: `p${i}`,
      type: 'shape',
      shape: i % 2 ? 'plant' : 'bookshelf',
      x: (i * 37) % 5000,
      y: (i * 53) % 4000,
      width: 56,
      height: 88,
    })),
  ];
  const fences = fenceSegments(elements);
  const reach = fenceReachFor(1);

  it('walks free where no fence is near', () => {
    expect(fenceStep({ x: 9000, y: 9000 }, { x: 9004, y: 9000 }, fences, reach)).toEqual({
      pos: { x: 9004, y: 9000 },
      blocked: false,
    });
  });

  it('steps into a wall within budget', () => {
    const into = () => {
      for (let i = 0; i < 1000; i++)
        fenceStep({ x: 10 + reach + 0.5, y: 200 }, { x: 6, y: 197 }, fences, reach);
    };
    into();
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(into));
    expect(fences.length).toBeGreaterThan(5000);
    // 1,000 steps: about 1,000 ms before, a few ms after.
    expect(best).toBeLessThan(cpuBudgetMs(100));
  });
});
