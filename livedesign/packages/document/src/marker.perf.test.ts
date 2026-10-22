import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import { markerElementPaint } from './marker-element';
import { createShape } from './shape-factory';

// docs/specs/008-canvas/finish.md "Performance": Marker is held to Sketch's budgets (sketch.perf.test.ts), one
// element's strokes and colouring under 0.2 ms at an ordinary size and under 2 ms at the largest, x10 for CI and
// coverage, timed in CPU time as the fastest of several rounds. A Marker paint is a whole element (outline, colouring,
// ink layers), several times Sketch's strokes alone, so a round is 50 paints, not Sketch's 200: at 200, four kinds
// under the coverage job's instrumentation ran past vitest's 5 s test timeout on CI (#914, #916) while every
// measurement stayed within budget. 50 still averages out a stall within a round.
const fastest = (fn: () => void, rounds = 5, perRound = 50): number => {
  for (let i = 0; i < 20; i++) fn();
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

// Backstop, not budget: the assertions are the budgets; this only keeps a slow shared runner from failing the
// test on its wall-clock run time.
const PERF_TEST_TIMEOUT_MS = 30_000;

describe('marker budgets', { timeout: PERF_TEST_TIMEOUT_MS }, () => {
  it('an ordinary shape stays under 0.2 ms (x10 for CI and coverage)', () => {
    for (const kind of ['square', 'circle', 'cloud', 'cylinder'] as const)
      expect(fastest(paint(kind, 400, 300)), kind).toBeLessThan(cpuBudgetMs(2));
  });

  it('the largest shape stays under 2 ms (x10 for CI and coverage)', () => {
    expect(fastest(paint('square', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
    expect(fastest(paint('circle', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
  });
});
