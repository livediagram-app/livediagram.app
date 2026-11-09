import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ShapeElement } from '@liveplanner/project';
import { PLAN_VIEW_IDS } from '@liveplanner/items';
import { planViewArt } from './plan-view-art';
import { artData, card, shape } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export" and "Limits": the worst Dashboard image (12 rows of 4 views, each over a
// project's 2,000 cards) draws its pictures well inside a second, so the preview never stalls the dialog.
describe('plan view pictures at the limits', () => {
  it('draws 48 views over 2,000 cards within budget', () => {
    const statuses = ['todo', 'doing', 'done'];
    const cards = Array.from({ length: 2000 }, (_, i) =>
      card(
        {
          title: `Card ${i}`,
          status: statuses[i % 3]!,
          priority: (['urgent', 'high', 'medium', 'low'] as const)[i % 4]!,
          due: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
          start: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
        },
        i % 5 === 0 ? 'project' : 'task',
      ),
    );
    const data = artData(cards);
    const views = Array.from({ length: 48 }, (_, i) =>
      shape(`v${i}`, 'plan-view', {
        width: 340,
        height: 320,
        planView: { view: PLAN_VIEW_IDS[i % PLAN_VIEW_IDS.length] },
      }),
    ) as ShapeElement[];
    let size = 0;
    const ms = cpuMsOf(() => {
      for (const v of views) size += planViewArt(v, data, 'light').length;
    });
    expect(size).toBeGreaterThan(0);
    // Measured at 67 ms on an M-series laptop; a loaded CI runner gets four times that.
    expect(ms).toBeLessThan(1500);
  });

  // A Gantt in swimlanes groups every row into its lane before drawing those that fit (plan-views.md "Swimlanes").
  it('draws 48 Gantts in swimlanes over 2,000 projects within budget', () => {
    const statuses = ['todo', 'doing', 'done'];
    const cards = Array.from({ length: 2000 }, (_, i) =>
      card(
        {
          title: `Project ${i}`,
          status: statuses[i % 3]!,
          priority: (['urgent', 'high', 'medium', 'low'] as const)[i % 4]!,
          due: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
          start: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
        },
        'project',
      ),
    );
    const data = artData(cards);
    const views = Array.from({ length: 48 }, (_, i) =>
      shape(`v${i}`, 'plan-view', {
        width: 340,
        height: 320,
        planView: { view: 'gantt', swimlaneBy: i % 2 ? 'status' : 'priority' },
      }),
    ) as ShapeElement[];
    let size = 0;
    const ms = cpuMsOf(() => {
      for (const v of views) size += planViewArt(v, data, 'light').length;
    });
    expect(size).toBeGreaterThan(0);
    // Measured at 110 ms of CPU on an M-series laptop (105 to 137 ms drawn without lanes); cpuBudgetMs triples it on CI.
    expect(ms).toBeLessThan(cpuBudgetMs(300));
  });
});
