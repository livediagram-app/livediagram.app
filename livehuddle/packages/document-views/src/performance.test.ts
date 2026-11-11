// The views' cost grows with the tab, not faster (docs/specs/024-agents/blueprints/document-views.md
// "Performance and limits"). Timed as growth, not as a ceiling: an absolute time depends on the machine,
// a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets"). Four times the elements in the same containers
// should cost about four to five times as much (n log n); a quadratic step would cost sixteen.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
import { describe, expect, it } from 'vitest';
import { cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';
import { outlineView } from './outline';
import { showSelectedView } from './show-selected';

const FRAMES = 10;
const GROWTH = 8;
const RATIO_CEILING = cpuRatioCeiling(24);
const RUNS = 5;
// Sized to time tens of milliseconds a render; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// `FRAMES` stored boundaries (retired, part 3 of the element engine), each under `perFrame` boxes joined pairwise by
// arrows.
function tabOf(perFrame: number) {
  const elements: Element[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const [fx, fy] = [frame * 100_000, 0];
    elements.push(retiredShapeAt('boundary', `frame-${frame}`, fx, fy, 90_000, 90_000));
    for (let i = 0; i < perFrame; i++) {
      elements.push(
        shapeAt(
          'signpost',
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

// The fastest of a few renders, full and fitted to an agent's 8,000-token budget: the least noisy estimate.
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

// `n` stored boundaries, each under one box: 2n outline lines for a budget to cut.
function framesOf(n: number) {
  const elements: Element[] = [];
  for (let i = 0; i < n; i++) {
    elements.push(
      retiredShapeAt('boundary', `fr-${i}`, i * 1000, 0, 500, 500, { label: `Frame ${i}` }),
    );
    elements.push(
      shapeAt('signpost', `bx-${i}`, i * 1000 + 50, 50, 100, 50, { label: `Box ${i}` }),
    );
  }
  return { id: 'frames', name: 'Frames', elements };
}

const fastestOf = (work: () => void) => {
  let fastest = Infinity;
  for (let run = 0; run < RUNS; run++) fastest = Math.min(fastest, cpuMsOf(work));
  return fastest;
};

describe('views over many containers or a whole selection', () => {
  // Cutting lines to a budget measures each step from prefix sums, never re-joining the outline: linear in its lines.
  it(
    'fit a long outline to a budget about linearly',
    () => {
      // A budget small enough that both sizes cut lines, so both take the same path.
      const time = (n: number) => {
        const model = buildViewModel(framesOf(n));
        return fastestOf(() => outlineView(model, { budget: 2000 }));
      };
      time(500);
      expect(time(500 * GROWTH) / time(500)).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );

  // Showing each selected element scanned every arrow and the whole tab's origin: 3.4 s for a select-all of
  // 8,000 elements, now about 80 ms.
  it(
    'show a whole selection about linearly',
    () => {
      const time = (n: number) => {
        const model = buildViewModel(framesOf(n));
        return fastestOf(() => showSelectedView(model, model.printed));
      };
      time(250);
      expect(time(250 * GROWTH) / time(250)).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );
});
