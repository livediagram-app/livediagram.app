// The lint's cost (docs/specs/024-agents/blueprints/page-lint.md "Performance and limits", LN35). Timed as growth,
// not as a ceiling, and judged without coverage (docs/ci.md "Speed budgets"). The overprint sweep compares only texts
// sharing rows, so a page of texts in rows grows about linearly; four times the texts cost under eight times as much.
// The page is built outside the timing and each sample times several runs, so a sample rises above the timer's noise;
// both sizes are warmed and then timed in turns (cpuGrowthRatio).
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livedesign/design';
import { box, lint, tabOf, text } from './fixtures/build';

// `n` labelled boxes and `n` texts on a grid, as a long wireframe page holds them.
function page(n: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = [(i % 10) * 220, Math.floor(i / 10) * 140];
    els.push(box(`b${i}`, x, y, { label: `Button ${i}` }));
    els.push(text(`t${i}`, x, y + 70, `A caption under item ${i}`));
  }
  return els;
}

// Four times the elements, under eight times the CPU.
const RATIO_CEILING = cpuRatioCeiling(8);

const RUNS_PER_SAMPLE = 5;

// One sample: RUNS_PER_SAMPLE lints of the page.
const sampleOf = (els: Element[]) => {
  const tab = tabOf(...els);
  return () =>
    cpuMsOf(() => {
      for (let run = 0; run < RUNS_PER_SAMPLE; run++) lint(tab);
    });
};

describe('performance', () => {
  it('grows with the tab, not faster: 250 to 1,000 boxes and texts', { timeout: 30_000 }, () => {
    const ratio = cpuGrowthRatio(sampleOf(page(250)), sampleOf(page(1000)), {
      ceiling: RATIO_CEILING,
    });
    expect(ratio).toBeLessThan(RATIO_CEILING);
  });
});
