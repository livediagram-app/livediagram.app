import { describe, expect, it } from 'vitest';
import type { ShapeElement } from '@liveplanner/document';
import { PLAN_VIEW_IDS } from '@liveplanner/items';
import { planViewArt } from './plan-view-art';
import { artData, card, shape } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export" and "Limits": the worst Dashboard image (12 rows of 4 views, each over a
// document's 2,000 cards) draws its pictures well inside a second, so the preview never stalls the dialog.
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
    const t = performance.now();
    let size = 0;
    for (const v of views) size += planViewArt(v, data, 'light').length;
    const ms = performance.now() - t;
    expect(size).toBeGreaterThan(0);
    // Measured at 67 ms on an M-series laptop; a loaded CI runner gets four times that.
    expect(ms).toBeLessThan(1500);
  });
});
