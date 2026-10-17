import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { markerElementPaint } from './marker-element';
import { createShape } from './shape-factory';

// docs/specs/008-canvas/finish.md "Performance": Marker is held to Sketch's budgets (sketch.perf.test.ts), one
// element's strokes and colouring under 0.2 ms at an ordinary size and under 2 ms at the largest, x10 for CI and
// coverage, timed in CPU time as the fastest of several rounds.
const fastest = (fn: () => void, rounds = 5, perRound = 200): number => {
  for (let i = 0; i < 50; i++) fn();
  let best = Infinity;
  for (let r = 0; r < rounds; r++) {
    const ms = cpuMsOf(() => {
      for (let i = 0; i < perRound; i++) fn();
    });
    best = Math.min(best, ms / perRound);
  }
  return best;
};

const paint = (kind: 'square' | 'circle' | 'cloud' | 'cylinder', w: number, h: number) => {
  const el = { ...createShape(kind, 0, 0), id: 'budget', width: w, height: h };
  return () => markerElementPaint(el, '#dbeafe');
};

describe('marker budgets', () => {
  it('an ordinary shape stays under 0.2 ms (x10 for CI and coverage)', () => {
    for (const kind of ['square', 'circle', 'cloud', 'cylinder'] as const)
      expect(fastest(paint(kind, 400, 300)), kind).toBeLessThan(cpuBudgetMs(2));
  });

  it('the largest shape stays under 2 ms (x10 for CI and coverage)', () => {
    expect(fastest(paint('square', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
    expect(fastest(paint('circle', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
  });
});
