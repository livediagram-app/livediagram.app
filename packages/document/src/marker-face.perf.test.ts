import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import { MARKER_FACE_MAX_PARTS } from './marker-face';
import { createShape } from './shape-factory';
import { svgBoxed } from './svg-render';
import { svgMarkerFace } from './svg-render-face-finish';

// docs/specs/008-canvas/finish.md "Performance": a face drawn in marker draws at most MARKER_FACE_MAX_PARTS parts, each
// a marker part (markerFacePart) about the cost of a Marker body. The worst face, every part a coloured-in band, stays
// under 12 ms (x10 for CI and coverage), so one settle of the canvas pass (useFaceFinishPass) on a busy face fits a
// frame budget's worth of idle time; an ordinary concept graphic stays under 2 ms. CPU time, fastest of rounds.
const fastest = (fn: () => void, rounds = 3, perRound = 5): number => {
  fn();
  let best = Infinity;
  for (let r = 0; r < rounds; r++) {
    const ms = cpuMsOf(() => {
      for (let i = 0; i < perRound; i++) fn();
    });
    best = Math.min(best, ms / perRound);
  }
  return best;
};

const PERF_TEST_TIMEOUT_MS = 30_000;

describe('marker face budgets', { timeout: PERF_TEST_TIMEOUT_MS }, () => {
  it(`the busiest face (${MARKER_FACE_MAX_PARTS} coloured bands) stays under 12 ms (x10 for CI and coverage)`, () => {
    const markup = Array.from(
      { length: MARKER_FACE_MAX_PARTS * 2 },
      (_, i) => `<rect x="0" y="${i * 10}" width="300" height="40" rx="8" fill="#38bdf8"/>`,
    ).join('');
    const face = { width: 2000, height: 4000 };
    expect(fastest(() => svgMarkerFace(markup, 'budget', face))).toBeLessThan(cpuBudgetMs(120));
  });

  it('a concept graphic stays under 2 ms (x10 for CI and coverage)', () => {
    for (const kind of ['layer-stack', 'pyramid', 'chevrons', 'cycle', 'hub', 'onion'] as const) {
      const el = { ...createShape(kind, 0, 0), id: 'budget' };
      expect(
        fastest(() => svgBoxed(el, { tabFinish: 'marker' }), 3, 10),
        kind,
      ).toBeLessThan(cpuBudgetMs(20));
    }
  });
});
