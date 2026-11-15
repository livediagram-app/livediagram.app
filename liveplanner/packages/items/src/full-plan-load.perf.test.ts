import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { projectBoard } from './board';
import type { Item } from './item';
import { ITEMS_MAX } from './limits';
import { presetSetup } from './presets';
import { rankAfter } from './rank';
import { refetchedItemStore, type ItemStoreState } from './store';
import { ALI, SAM } from './test-items';

// A full plan's first load and board (blueprint item-store.md "Performance and limits"): the GET's one JSON array of
// ITEMS_MAX cards of a description, labels, a person and a date each, read in the browser, folded into the store as a load folds it,
// and projected onto a Kanban board with assignee lanes. The worst case the editor meets on opening a plan; CPU time,
// never wall-clock (docs/ci.md "Speed budgets").

const statuses = ['backlog', 'todo', 'doing', 'review', 'done'];
const note =
  'Steps to reproduce, what was expected and what happened instead, with a link or two. '.repeat(3);

function fullPlan(): ItemStoreState {
  const items: Item[] = [];
  let rank: string | null = null;
  for (let i = 0; i < ITEMS_MAX; i++) {
    rank = rankAfter(rank);
    items.push({
      id: `card-${String(i).padStart(5, '0')}`,
      type: i % 4 === 0 ? 'action' : 'task',
      key: i + 1,
      rank,
      fields: {
        title: `Card ${i}: tidy the onboarding copy on the sign-up page`,
        description: note,
        status: statuses[i % statuses.length]!,
        priority: ['low', 'medium', 'high'][i % 3]!,
        labels: [`label-${i % 30}`, `area-${i % 7}`],
        assignee: i % 2 ? SAM : ALI,
        due: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      },
      rev: 3,
      createdAt: 1_700_000_000_000 + i,
      updatedAt: 1_700_000_500_000 + i,
      createdBy: SAM,
      updatedBy: ALI,
    });
  }
  return { items, rev: ITEMS_MAX, nextKey: ITEMS_MAX + 1 };
}

describe('a full plan’s first load', () => {
  const body = JSON.stringify(fullPlan());
  const kanban = { ...presetSetup('kanban'), swimlaneBy: 'assignee' as const };

  it('answers under a kilobyte a card', () => {
    // Measured 3.7 MB at 5,000 cards (0.74 KB a card: a 260-character description, two labels, an assignee, a due
    // date and the author stamps); the budget is 0.8 KB a card.
    expect(body.length).toBeLessThan(ITEMS_MAX * 800);
  });

  it('reads, folds and projects every card within budget', () => {
    let shown = 0;
    const ms = cpuMsOf(() => {
      const fetched = JSON.parse(body) as ItemStoreState;
      const store = refetchedItemStore({ items: [], rev: 0, nextKey: 1 }, fetched, new Set());
      const projection = projectBoard(kanban, new Map(store.items.map((it) => [it.id, it])));
      shown = projection.total;
    });
    expect(shown).toBe(ITEMS_MAX);
    // Measured 35 ms on an M-series Mac at 5,000 cards.
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });

  it('projects the board again, as a change does, within a frame budget', () => {
    const items = new Map(fullPlan().items.map((it) => [it.id, it]));
    projectBoard(kanban, items);
    // The best of three (docs/ci.md "Speed budgets"): a re-projection after a card changes.
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++)
      best = Math.min(
        best,
        cpuMsOf(() => projectBoard(kanban, items)),
      );
    // Measured 6 ms on an M-series Mac at 5,000 cards.
    expect(best).toBeLessThan(cpuBudgetMs(100));
  });
});
