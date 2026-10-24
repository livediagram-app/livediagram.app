import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createPinnedArrow, createShape, type Element } from '@livedocuments/document';
import { cleanupElements, type CleanupKind } from './tab-cleanup';

// docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits": a Tidy Up hover runs one cleanup over
// the whole tab, so the worst case a hand-drawn diagram reaches must stay inside one hover's budget.

const TIDY_PREVIEW_WORST_CASE_NODES = 300;
const TIDY_PREVIEW_BUDGET_MS = 100;
const WARM_UP_PASSES = 3;

// A branching graph drawn untidily: each node links to the next and, every third one, back across.
function bigDiagram(n: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < n; i++)
    els.push({
      ...createShape('square', (i * 137) % 2000, (i * 89) % 1400),
      id: `n${i}`,
    });
  for (let i = 1; i < n; i++) {
    els.push({
      ...createPinnedArrow(`n${Math.floor((i - 1) / 2)}`, 's', `n${i}`, 'n'),
      id: `t${i}`,
    });
    if (i % 3 === 0)
      els.push({ ...createPinnedArrow(`n${i}`, 'e', `n${(i * 7) % n}`, 'w'), id: `x${i}` });
  }
  return els;
}

describe('Tidy Up hover budget', () => {
  const els = bigDiagram(TIDY_PREVIEW_WORST_CASE_NODES);
  for (const kind of [
    'smart',
    'flow-down',
    'flow-right',
    'tree',
    'mindmap',
    'align',
  ] as CleanupKind[]) {
    // Named with the budget it holds here, so a CI failure names CI's.
    it(`${kind} lays out ${TIDY_PREVIEW_WORST_CASE_NODES} nodes inside ${cpuBudgetMs(TIDY_PREVIEW_BUDGET_MS)} ms`, () => {
      // Untimed warm-ups first: `cpuUsage` bills the whole process, so while V8 still compiles and
      // collects on its background threads a pass pays for them (on a CI runner under coverage one warm-up
      // left Smart at 105 to 109 ms; it is about 20 ms locally). Then CPU time, not wall time: the
      // parallel suite starves a wall-clock budget (#586). Same pattern as mind-connector-route.perf.test.ts.
      for (let pass = 0; pass < WARM_UP_PASSES; pass++) cleanupElements(els, kind);
      const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void cleanupElements(els, kind))));
      // The hover budget as written on a developer's machine; CI's coverage-instrumented runners get
      // CI_CPU_HEADROOM, as Smart measures about 100 ms there against 24 ms locally.
      expect(best).toBeLessThan(cpuBudgetMs(TIDY_PREVIEW_BUDGET_MS));
    });
  }
});
