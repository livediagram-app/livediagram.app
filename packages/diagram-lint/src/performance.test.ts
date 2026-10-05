// The lint's cost (docs/specs/024-agents/blueprints/diagram-lint.md "Performance and limits", LN35): a tab of
// 300 boxes and 300 arrows, the pair checks and the label pass included, within LINT_BUDGET_CPU_MS of CPU,
// and growing with the tab, not faster.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import type { Element } from '@livediagram/document';
import { LINT_BUDGET_CPU_MS } from './constants';
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

const fastest = (els: Element[]) =>
  Math.min(...[0, 1, 2].map(() => cpuMsOf(() => lint(tabOf(...els)))));

describe('performance', () => {
  it(
    `lints 300 boxes and 300 arrows within ${LINT_BUDGET_CPU_MS} ms of CPU`,
    { timeout: 30_000 },
    () => {
      const els = grid(300);
      expect(els.filter((el) => el.type === 'arrow')).toHaveLength(300);
      expect(fastest(els)).toBeLessThan(LINT_BUDGET_CPU_MS);
    },
  );
});
