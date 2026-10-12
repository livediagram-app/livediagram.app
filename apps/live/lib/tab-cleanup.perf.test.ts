import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livediagram/document';
import { cleanupElements, type CleanupKind } from './tab-cleanup';

// docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits": a Tidy Up hover runs one cleanup over
// the whole tab, so the worst case a hand-drawn diagram reaches must stay inside one hover's budget.

const TIDY_PREVIEW_WORST_CASE_NODES = 300;
const TIDY_PREVIEW_BUDGET_MS = 100;

// A branching graph drawn untidily: each node links to the next and, every third one, back across.
function bigDiagram(n: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < n; i++)
    els.push({
      ...createShape('square', (i * 137) % 2000, (i * 89) % 1400),
      id: `n${i}`,
    } as Element);
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
    it(`${kind} lays out ${TIDY_PREVIEW_WORST_CASE_NODES} nodes inside ${TIDY_PREVIEW_BUDGET_MS} ms`, () => {
      cleanupElements(els, kind);
      const runs: number[] = [];
      for (let r = 0; r < 3; r++) {
        const t = performance.now();
        cleanupElements(els, kind);
        runs.push(performance.now() - t);
      }
      const best = Math.min(...runs);
      expect(best).toBeLessThan(TIDY_PREVIEW_BUDGET_MS);
    });
  }
});
