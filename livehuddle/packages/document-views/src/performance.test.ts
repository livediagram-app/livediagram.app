// The views' cost grows with the tab, not faster (docs/specs/024-agents/blueprints/document-views.md
// "Performance and limits"). Timed as growth, not as a ceiling: an absolute time depends on the machine,
// a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets"). Four times the elements in the same containers
// should cost about four to five times as much (n log n); a quadratic step would cost sixteen.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';
import { outlineView } from './outline';
import { showSelectedView } from './show-selected';

const FRAMES = 10;
const GROWTH = 8;
const RATIO_CEILING = cpuRatioCeiling(24);
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

// One sample: a render full and fitted to an agent's 8,000-token budget, of a tab built outside the timing.
const renderMs = (tab: ReturnType<typeof tabOf>) => () =>
  cpuMsOf(() => {
    outlineView(buildViewModel(tab));
    outlineView(buildViewModel(tab), { budget: 8000 });
  });

// The growth from `small` to `large` (each one sample's CPU time), warmed and timed in turns.
const growth = (small: () => number, large: () => number) =>
  cpuGrowthRatio(small, large, { ceiling: RATIO_CEILING });

describe('views as tabs grow', () => {
  it(
    'cost about linearly more, never quadratically',
    () => {
      const small = tabOf(120);
      const large = tabOf(120 * GROWTH);
      expect(large.elements.length).toBeGreaterThan(GROWTH * (small.elements.length - FRAMES));
      expect(growth(renderMs(small), renderMs(large))).toBeLessThan(RATIO_CEILING);
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
    elements.push(shapeAt('square', `bx-${i}`, i * 1000 + 50, 50, 100, 50, { label: `Box ${i}` }));
  }
  return { id: 'frames', name: 'Frames', elements };
}

describe('views over many containers or a whole selection', () => {
  // Cutting lines to a budget measures each step from prefix sums, never re-joining the outline: linear in its lines.
  it(
    'fit a long outline to a budget about linearly',
    () => {
      // A budget small enough that both sizes cut lines, so both take the same path.
      const time = (n: number) => {
        const model = buildViewModel(framesOf(n));
        return () => cpuMsOf(() => outlineView(model, { budget: 2000 }));
      };
      expect(growth(time(500), time(500 * GROWTH))).toBeLessThan(RATIO_CEILING);
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
        return () => cpuMsOf(() => showSelectedView(model, model.printed));
      };
      expect(growth(time(250), time(250 * GROWTH))).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );
});
