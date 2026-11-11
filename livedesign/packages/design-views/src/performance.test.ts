// The views' cost grows with the tab, not faster (docs/specs/024-agents/blueprints/design-views.md
// "Performance and limits"). Timed as growth, not as a ceiling: an absolute time depends on the machine,
// a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets"). Four times the elements in the same containers
// should cost about four to five times as much (n log n); a quadratic step would cost sixteen.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling. Each size is warmed and
// then the two are timed in turns (cpuGrowthRatio), never one after the other.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livedesign/design';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';
import { outlineView } from './outline';
import { showSelectedView } from './show-selected';

const FRAMES = 10;
const GROWTH = 8;
const RATIO_CEILING = cpuRatioCeiling(24);
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

// One sample of a tab's renders, full and fitted to the MCP budget, the model built in each as a call builds it.
const renderMs = (tab: ReturnType<typeof tabOf>) => () =>
  cpuMsOf(() => {
    outlineView(buildViewModel(tab));
    outlineView(buildViewModel(tab), { budget: 8000 });
  });

// The growth from `small` to `large` (each one sample's CPU time), held under the ceiling.
function expectLinear(small: () => number, large: () => number): void {
  expect(cpuGrowthRatio(small, large, { ceiling: RATIO_CEILING })).toBeLessThan(RATIO_CEILING);
}

describe('views as tabs grow', () => {
  it(
    'cost about linearly more, never quadratically',
    () => {
      const small = tabOf(120);
      const large = tabOf(120 * GROWTH);
      expect(large.elements.length).toBeGreaterThan(GROWTH * (small.elements.length - FRAMES));
      expectLinear(renderMs(small), renderMs(large));
    },
    TIMEOUT_MS,
  );
});

// `n` frames, each holding one box: n containers for a budget to collapse one by one.
function framesOf(n: number) {
  const elements: Element[] = [];
  for (let i = 0; i < n; i++) {
    elements.push(shapeAt('frame', `fr-${i}`, i * 1000, 0, 500, 500, { label: `Frame ${i}` }));
    elements.push(shapeAt('square', `bx-${i}`, i * 1000 + 50, 50, 100, 50, { label: `Box ${i}` }));
  }
  return { id: 'frames', name: 'Frames', elements };
}

// One sample of `view` over `n` containers, the model built outside the timing.
const viewMs = (n: number, view: (model: ReturnType<typeof buildViewModel>) => unknown) => {
  const model = buildViewModel(framesOf(n));
  return () => cpuMsOf(() => void view(model));
};

describe('views over many containers or a whole selection', () => {
  // Fitting collapsed containers one by one rebuilt the fit and its elision per step: 1.2 s for 4,000 frames,
  // now about 30 ms (1.3 s and 0.13 s with the model built, at the MCP budget).
  it(
    'fit many containers to a budget about linearly',
    () => {
      // A budget small enough that both sizes collapse every container, so both take the same path.
      const fit = (model: ReturnType<typeof buildViewModel>) =>
        outlineView(model, { budget: 2000 });
      expectLinear(viewMs(500, fit), viewMs(500 * GROWTH, fit));
    },
    TIMEOUT_MS,
  );

  // Showing each selected element scanned every arrow and the whole tab's origin: 3.4 s for a select-all of
  // 8,000 elements, now about 80 ms.
  it(
    'show a whole selection about linearly',
    () => {
      const show = (model: ReturnType<typeof buildViewModel>) =>
        showSelectedView(model, model.printed);
      expectLinear(viewMs(250, show), viewMs(250 * GROWTH, show));
    },
    TIMEOUT_MS,
  );
});
