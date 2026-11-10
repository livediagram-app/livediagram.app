// The lint's cost (docs/specs/024-agents/blueprints/diagram-lint.md "Performance and limits", LN35). The pair check
// is quadratic by design up to LINT_MAX_ARROWS and skipped past it (N2), so the two are timed apart: at the cap, a
// tab of 300 boxes and 300 arrows lints within LINT_BUDGET_CPU_MS; past it, where every check left is linear, four
// times the tab costs under eight times as much. Timed from 75 to 300, inside the cap, the quadratic pair check read
// up to 11 for four times the tab, and the ceiling of 8 failed at random.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from '@livediagram/document';
import { LINT_MAX_ARROWS } from './constants';
import { arrow, box, lint, tabOf } from './fixtures/build';

// `n` boxes on a grid, each joined to its right and lower neighbours until `n` arrows are drawn.
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
// The blueprint's budget for a tab at the arrow cap (LINT_BUDGET_CPU_MS: 50 ms, safe range 20 to 200).
const LINT_BUDGET_CPU_MS = 50;

const RUNS_PER_SAMPLE = 10;

const fastest = (els: Element[]) => {
  const tab = tabOf(...els);
  return Math.min(
    ...[0, 1, 2, 3, 4].map(() =>
      cpuMsOf(() => {
        for (let run = 0; run < RUNS_PER_SAMPLE; run++) lint(tab);
      }),
    ),
  );
};

describe('performance', () => {
  it(
    'lints a tab at the arrow cap, 300 boxes and 300 arrows, within its budget',
    { timeout: 30_000 },
    () => {
      expect(LINT_MAX_ARROWS).toBe(300);
      expect(fastest(grid(300)) / RUNS_PER_SAMPLE).toBeLessThan(cpuBudgetMs(LINT_BUDGET_CPU_MS));
    },
  );

  it(
    'grows with the tab past the arrow cap, not faster: 400 to 1,600 boxes and arrows',
    { timeout: 30_000 },
    () => {
      const small = fastest(grid(400));
      const large = fastest(grid(1600));
      expect(grid(1600).filter((el) => el.type === 'arrow')).toHaveLength(1600);
      expect(large / small).toBeLessThan(RATIO_CEILING);
    },
  );
});
