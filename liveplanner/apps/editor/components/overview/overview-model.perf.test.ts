import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Tab } from '@liveplanner/project';
import { ACTIVITY_MAX } from './overview-activity';
import { overviewModelOf, type OverviewInput } from './overview-model';
import { TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

// docs/specs/026-plan/plan-overview.md "Performance": the whole Overview derives from what the editor holds, once per
// change, so a plan at the item store's limit must derive inside a frame.

const ITEM_STORE_LIMIT = 2_000;
const OVERVIEW_BUDGET_MS = 16;
const WARM_UP_PASSES = 3;
const STATUSES = ['todo', 'doing', 'done'];

function biggestPlan(): OverviewInput {
  const cards = Array.from({ length: ITEM_STORE_LIMIT }, (_, i) =>
    card(`${i + 1}`, {
      type: TYPES[i % TYPES.length]!.id,
      rank: `r${String(i).padStart(5, '0')}`,
      createdAt: i * 1_000,
      updatedAt: i * 1_000 + (i % 4 === 0 ? 500 : 0),
      fields: {
        status: i % 50 === 0 ? 'trash' : STATUSES[i % STATUSES.length]!,
        statusSince: i * 1_000 + 500,
        start: '2026-01-01',
        due: `2026-02-${String((i % 27) + 1).padStart(2, '0')}`,
        ...(i % 40 === 0 ? { archived: true } : {}),
      },
    }),
  );
  const tabs: Tab[] = [
    ...Array.from({ length: 8 }, (_, i) =>
      boardTab(
        `b${i}`,
        `Board ${i}`,
        i === 7 ? { archive: true } : i % 2 ? { addTypes: ['bug'] } : {},
      ),
    ),
    {
      id: 'gantt',
      name: 'Timeline',
      kind: 'dashboard',
      dashboard: {
        rows: [
          {
            id: 'r',
            height: 400,
            fill: true,
            slots: [{ id: 's', span: 12, content: { type: 'element', elementId: 'g' } }],
          },
        ],
      },
      elements: [
        {
          id: 'g',
          type: 'shape',
          shape: 'plan-view',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          planView: { view: 'gantt' },
        },
      ],
    } as unknown as Tab,
  ];
  return {
    tabs,
    items: itemsOf(cards),
    types: TYPES,
    loadedTabIds: new Set(tabs.map((t) => t.id)),
    owner: { id: 'owner', name: 'Ana Moreno', color: '#b4461c' },
    present: [],
    createdAt: 1,
  };
}

describe('Overview derivation budget', () => {
  const plan = biggestPlan();
  // Named with the budget it holds here, so a CI failure names CI's.
  it(`derives a plan of ${ITEM_STORE_LIMIT} cards inside ${cpuBudgetMs(OVERVIEW_BUDGET_MS)} ms`, () => {
    // Untimed warm-ups, then CPU time, not wall time (tab-cleanup.perf.test.ts says why).
    for (let pass = 0; pass < WARM_UP_PASSES; pass++) overviewModelOf(plan);
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void overviewModelOf(plan))));
    expect(best).toBeLessThan(cpuBudgetMs(OVERVIEW_BUDGET_MS));
    const model = overviewModelOf(plan);
    expect(model.activity).toHaveLength(ACTIVITY_MAX);
    expect(model.tabTiles).toHaveLength(9);
  });
});
