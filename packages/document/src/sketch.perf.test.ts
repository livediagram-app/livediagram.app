import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import { outlineOfBox, outlineOfPath, sketchHatching, sketchSeed, sketchStrokes } from './sketch';

// docs/specs/008-canvas/finish.md "Performance": one element's strokes and hatching under 0.2 ms at an
// ordinary size, a 20000 px element (the largest the Size category allows) under 2 ms. Measured on an M-series
// laptop at about 0.06 ms and 0.3 ms. The limits are those budgets times ten, the headroom the other timing tests
// leave: the coverage job runs this instrumented on a shared runner, where the ordinary shape measured 0.62 ms
// (main, 2026-10-12). Timed in CPU time, not wall-clock, so waiting for a core under turbo's parallel suites
// does not count either (cpu-time.js). Still the fastest of several rounds, so one stall does not fail the
// build, and a real regression (an order of magnitude) still fails it.
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

const seed = sketchSeed('budget');
const sketchBox = (kind: string, w: number, h: number) => () => {
  const outline = outlineOfBox(kind, w, h, 8, 1);
  sketchStrokes(outline, seed);
  sketchHatching(outline.area!, seed, 2);
};

describe('sketch budgets', () => {
  it('an ordinary shape stays under 0.2 ms (x10 for CI and coverage)', () => {
    expect(fastest(sketchBox('square', 400, 300))).toBeLessThan(cpuBudgetMs(2));
    expect(fastest(sketchBox('circle', 400, 300))).toBeLessThan(cpuBudgetMs(2));
    const cloud = () => {
      const o = outlineOfPath(
        'M 89 300 C 7 300, -29 214, 28 165 C -9 95, 69 35, 126 73 C 146 -19, 281 -30, 296 73 C 368 35, 430 116, 374 176 C 430 219, 389 300, 306 300 Z',
      );
      sketchStrokes(o, seed);
      sketchHatching(o.area!, seed, 2);
    };
    expect(fastest(cloud)).toBeLessThan(cpuBudgetMs(2));
  });

  it('the largest shape stays under 2 ms (x10 for CI and coverage)', () => {
    expect(fastest(sketchBox('square', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
    expect(fastest(sketchBox('circle', 20000, 20000), 3, 20)).toBeLessThan(cpuBudgetMs(20));
  });
});
