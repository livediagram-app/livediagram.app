// The views' cost grows with the tab, not faster (docs/specs/024-agents/blueprints/document-views.md
// "Performance and limits"). Timed as growth, not as a ceiling: an absolute time depends on the machine
// and on coverage instrumentation, a ratio does not. Four times the elements in the same containers
// should cost about four to five times as much (n log n); a quadratic step would cost sixteen.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import type { Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';
import { outlineView } from './outline';

const FRAMES = 10;
const GROWTH = 8;
const RATIO_CEILING = 24;
const RUNS = 5;
// Sized to time tens of milliseconds a render; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// `FRAMES` frames, each holding `perFrame` boxes joined pairwise by arrows.
function tabOf(perFrame: number) {
  const elements: Element[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const [fx, fy] = [frame * 100_000, 0];
    elements.push(shapeAt('frame', `frame-${frame}`, fx, fy, 90_000, 90_000));
    for (let i = 0; i < perFrame; i++) {
      elements.push(
        shapeAt(
          'square',
          `n-${frame}-${i}`,
          fx + (i % 60) * 240 + 20,
          fy + Math.floor(i / 60) * 200 + 40,
        ),
      );
      if (i % 2 === 1)
        elements.push(arrowBetween(`a-${frame}-${i}`, `n-${frame}-${i - 1}`, `n-${frame}-${i}`));
    }
  }
  return { id: 'growth', name: 'Growth', elements };
}

// The fastest of a few renders, full and fitted to the MCP budget: the least noisy estimate.
function fastestRender(tab: ReturnType<typeof tabOf>): number {
  let fastest = Infinity;
  for (let run = 0; run < RUNS; run++) {
    const spent = cpuMsOf(() => {
      outlineView(buildViewModel(tab));
      outlineView(buildViewModel(tab), { budget: 8000 });
    });
    fastest = Math.min(fastest, spent);
  }
  return fastest;
}

describe('views as tabs grow', () => {
  it(
    'cost about linearly more, never quadratically',
    () => {
      const small = tabOf(120);
      const large = tabOf(120 * GROWTH);
      fastestRender(small);
      const ratio = fastestRender(large) / fastestRender(small);
      expect(large.elements.length).toBeGreaterThan(GROWTH * (small.elements.length - FRAMES));
      expect(ratio).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );
});
