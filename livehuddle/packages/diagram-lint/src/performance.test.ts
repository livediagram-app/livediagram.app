// The lint's cost (docs/specs/024-agents/blueprints/diagram-lint.md "Performance and limits", LN35). Timed as
// growth, not as a ceiling, and judged without coverage (docs/ci.md "Speed budgets"). A tab of 300 boxes and 300
// stored arrows costs about 2 ms here, under LINT_BUDGET_CPU_MS; four times the tab costs under eight times as much.
// A stored arrow is a retired element no check reads (part 4 of the element engine), but its line still counts toward
// the extent, which once indexed the tab per arrow (quadratic). A run is now well under a millisecond on the small
// tab, so each sample times several runs to rise above the timer's noise, and the two sizes are warmed and timed in
// turns (cpuGrowthRatio), so neither pays for the first compile or a collection alone (the growth read 0.66 to 7.06
// timed one after the other).
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livehuddle/document';
import { arrow, box, lint, tabOf } from './fixtures/build';

// `n` boxes on a grid, each with a stored arrow to its right and lower neighbours until `n` arrows are drawn.
function grid(n: number): Element[] {
  const side = Math.ceil(Math.sqrt(n));
  const els: Element[] = [];
  for (let i = 0; i < n; i++)
    els.push(box(`b${i}`, (i % side) * 220, Math.floor(i / side) * 140, { label: `Step ${i}` }));
  let drawn = 0;
  for (let i = 0; i < n && drawn < n; i++) {
    if ((i + 1) % side !== 0 && i + 1 < n) {
      const label = drawn % 5 === 0 ? { label: 'next' } : {};
      els.push(arrow(`r${i}`, `b${i}`, `b${i + 1}`, ['e', 'w'], label));
      drawn++;
    }
    if (i + side < n && drawn < n) {
      els.push(arrow(`d${i}`, `b${i}`, `b${i + side}`, ['s', 'n']));
      drawn++;
    }
  }
  return els;
}

// Four times the elements, under eight times the CPU.
const RATIO_CEILING = cpuRatioCeiling(8);

const RUNS_PER_SAMPLE = 10;

// One sample: RUNS_PER_SAMPLE lints of a tab built outside the timing.
const sample = (tab: ReturnType<typeof tabOf>) => () =>
  cpuMsOf(() => {
    for (let run = 0; run < RUNS_PER_SAMPLE; run++) lint(tab);
  });

describe('performance', () => {
  it('grows with the tab, not faster: 75 to 300 boxes and arrows', { timeout: 30_000 }, () => {
    expect(grid(300).filter((el) => el.type === 'arrow')).toHaveLength(300);
    const small = sample(tabOf(...grid(75)));
    const large = sample(tabOf(...grid(300)));
    expect(cpuGrowthRatio(small, large, { ceiling: RATIO_CEILING })).toBeLessThan(RATIO_CEILING);
  });
});
