import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { PlanBoardOutline } from './plan-outline';
import { judgeRemoval, removalBoardsOf } from './removal-guard';
import { item } from './test-items';

// The guard's worst case (docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card removals"): a run's
// first removal counts every board of a large plan, and each removal after judges the run so far.

const STATUSES = ['todo', 'doing', 'review', 'done'];
const boards: PlanBoardOutline[] = Array.from({ length: 10 }, (_, b) => ({
  tabId: `t${b}`,
  tabName: `Tab ${b}`,
  elementId: `b${b}`,
  title: `Board ${b}`,
  kind: 'board',
  types: null,
  columns: STATUSES.map((status) => ({ status, name: status })),
}));
const cards = Array.from({ length: 10_000 }, (_, i) =>
  item({ title: `Card ${i}`, status: STATUSES[i % STATUSES.length]! }),
);

describe('the removal guard at the limits', () => {
  it('counts ten boards of 10,000 cards and judges a 200-card removal quickly', () => {
    let counted = 0;
    let held = false;
    const removed = new Set(cards.slice(0, 200).map((c) => c.id));
    const ms = cpuMsOf(() => {
      const counts = removalBoardsOf(boards, cards);
      counted = counts[0]!.cards.size;
      held = judgeRemoval(counts, removed) !== null;
    });
    expect(counted).toBe(10_000);
    expect(held).toBe(true);
    // Measured at about 20 ms of CPU on an M-series laptop, once per run.
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
