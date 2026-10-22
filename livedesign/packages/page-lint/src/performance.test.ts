// The lint's cost (docs/specs/024-agents/blueprints/page-lint.md "Performance and limits", LN35). Timed as growth,
// not as a ceiling: coverage instrumentation on a CI runner makes an absolute CPU budget flake, a ratio does not.
// The overprint sweep compares only texts sharing rows, so a page of texts in rows grows about linearly; four times
// the texts cost under eight times as much.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import type { Element } from '@livedesign/document';
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
const RATIO_CEILING = 8;

const fastest = (els: Element[]) =>
  Math.min(...[0, 1, 2].map(() => cpuMsOf(() => lint(tabOf(...els)))));

describe('performance', () => {
  it('grows with the tab, not faster: 250 to 1,000 boxes and texts', { timeout: 30_000 }, () => {
    const small = fastest(page(250));
    const large = fastest(page(1000));
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });
});
