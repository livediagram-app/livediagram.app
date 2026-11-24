import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { presetSetup } from './presets';
import { planDiagramGraph, planGraphHash } from './plan-diagram-graph';
import { planMake } from './plan-make';
import { BLOCKED_BY, PLAN_TYPES } from './test-plan-types';
import { item } from './test-items';

// liveworkspace's diagrams-and-plans.md "Limits": a 500-card board with about 1,000 links draws, hashes and makes well
// inside a redraw's budget. The budgets are CPU time on a shared runner, generous against the milliseconds measured.
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'done'];

// Each card waits on the two before it: a chain-shaped DAG of 997 links.
function board(cards = 500): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < cards; i++) {
    const blockers = items.slice(Math.max(0, i - 2), i).map((x) => x.id);
    items.push(item({ title: `Card ${i}`, status: STATUSES[i % 5]!, [BLOCKED_BY.id]: blockers }));
  }
  return items;
}

const time = (run: () => void) => {
  const t = performance.now();
  run();
  return performance.now() - t;
};

describe('a 500-card board', () => {
  it('draws as a graph, and hashes, in well under 250 ms', () => {
    const items = new Map(board().map((i) => [i.id, i]));
    let edges = 0;
    const ms = time(() => {
      const g = planDiagramGraph({
        setup: presetSetup('kanban'),
        items,
        types: PLAN_TYPES,
        link: (id) => `https://x/${id}`,
      });
      edges = g.edges.length;
      planGraphHash(g);
    });
    expect(edges).toBe(997);
    expect(ms).toBeLessThan(250);
  });

  it('makes 500 cards with 997 links in well under 250 ms', () => {
    const cards = Array.from({ length: 500 }, (_, i) => ({
      element: `e${i}`,
      id: `n${i}`,
      made: true,
      title: `Shape ${i}`,
      description: '',
      blockedBy: [i > 0 ? `e${i - 1}` : '', i > 1 ? `e${i - 2}` : ''].filter(Boolean),
    }));
    let skipped = -1;
    const ms = time(() => {
      skipped = planMake({
        items: new Map(),
        types: PLAN_TYPES,
        columns: [{ status: 'todo', name: 'To Do' }],
        column: 'To Do',
        type: 'task',
        cards,
      }).skipped;
    });
    expect(skipped).toBe(0);
    expect(ms).toBeLessThan(250);
  });
});
