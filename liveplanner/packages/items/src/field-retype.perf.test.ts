import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { PlanBoardSetup } from './board';
import { builtInCardsOf, builtInRetypePatches, retypeBuiltInIn } from './built-in-field-retype';
import { boardWithoutFieldFilters, viewWithoutFieldFilters } from './field-filter-removal';
import { fieldRetypeImpact, type ImpactBoard, type ImpactView } from './field-retype-impact';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { item } from './test-items';
import { ITEMS_MAX } from './limits';

// The retype of a built-in on a full plan (blueprint item-types.md "Performance and limits"): 2,000 cards (ITEMS_MAX)
// and 10 tabs, each with 4 boards (2 saved filters each) and 4 views (a filter each). The scan reads no card; the
// values pass is one pass over the cards.
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'estimate', 'due'],
};
const TABS = 10;
const days = Array.from(
  { length: 100 },
  (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}-1${i % 10}`,
);
const cards = Array.from({ length: ITEMS_MAX }, (_, i) =>
  item({
    title: `Card ${i}`,
    status: 'todo',
    priority: i % 3 ? 'high' : 'low',
    due: days[i % 100]!,
  }),
);
const boards: ImpactBoard[] = [];
const views: ImpactView[] = [];
for (let t = 0; t < TABS; t += 1)
  for (let b = 0; b < 4; b += 1) {
    const setup: PlanBoardSetup = {
      title: `Board ${t}.${b}`,
      columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
      swimlaneBy: 'priority',
      sortBy: [{ field: 'priority', dir: 'desc' }],
      cardFields: [],
      hideWriting: false,
      savedFilters: [
        { id: 'a', name: 'High', priority: 'high' },
        { id: 'b', name: 'Chip', filters: [{ by: 'priority', key: 'high' }] },
      ],
    };
    boards.push({ title: setup.title, setup });
    views.push({ view: 'search', settings: { filters: [{ by: 'priority', key: 'high' }] } });
  }

describe('retyping a built-in on a 2,000-card, 10-tab plan', () => {
  it('scans the plan, counts the filters and works out every value within budget', () => {
    const def = {
      id: 'f-urgency',
      label: 'Urgency',
      kind: 'multichoice' as const,
      options: ['High', 'Low'],
    };
    const after = [retypeBuiltInIn(TASK, 'priority', def)];
    const target = { field: 'priority', builtIn: true, typesAfter: after };
    let lines = 0;
    let removed = 0;
    let patches = 0;
    const scanMs = cpuMsOf(() => {
      lines = fieldRetypeImpact({
        field: 'priority',
        name: 'Priority',
        typeId: 'task',
        boards,
        views,
        forms: [],
        types: [TASK],
      }).length;
      for (const b of boards) removed += boardWithoutFieldFilters(b.setup, target).removed;
      for (const v of views) removed += viewWithoutFieldFilters(v.settings, target).removed;
    });
    const valuesMs = cpuMsOf(() => {
      patches = builtInRetypePatches(
        'priority',
        def,
        'f-urgency',
        cards,
        builtInCardsOf('task', 'priority', [TASK]),
      ).patches.length;
    });
    // The numbers the PR quotes.
    console.info(`retype scan ${scanMs.toFixed(2)} ms, values ${valuesMs.toFixed(2)} ms`);
    expect(lines).toBeGreaterThan(80);
    expect(removed).toBe(TABS * 4 * 3);
    expect(patches).toBe(ITEMS_MAX);
    expect(scanMs).toBeLessThan(cpuBudgetMs(50));
    expect(valuesMs).toBeLessThan(cpuBudgetMs(100));
  });
});
