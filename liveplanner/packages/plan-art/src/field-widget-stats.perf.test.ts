import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  boardFields,
  presetSetup,
  type CustomFieldDef,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { fieldSummary } from './field-widget-stats';
import { suggestWidgets } from './widget-suggestions';
import { card } from './test-fixtures';

// docs/specs/026-plan/board-widgets.md "Field widgets": a board of 2,000 cards with a dozen fields reads every field's
// summary, and works out For You, in about 12 ms of CPU, so a header full of field widgets never stalls a drag.
describe('field widgets at the limits', () => {
  const custom: CustomFieldDef[] = [
    { id: 'f-budget', label: 'Budget', kind: 'currency' },
    { id: 'f-hours', label: 'Hours', kind: 'number' },
    { id: 'f-done', label: 'Done', kind: 'percent' },
    { id: 'f-stars', label: 'Stars', kind: 'rating' },
    { id: 'f-effort', label: 'Effort', kind: 'duration' },
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['High', 'Medium', 'Low'] },
    { id: 'f-plat', label: 'Platforms', kind: 'multichoice', options: ['Web', 'iOS', 'Android'] },
    { id: 'f-ok', label: 'Approved', kind: 'checkbox' },
    { id: 'f-launch', label: 'Launch', kind: 'date' },
    { id: 'f-span', label: 'Window', kind: 'daterange' },
  ] as CustomFieldDef[];
  const types: ItemTypeDef[] = ['feature', 'bug'].map((id) => ({
    id,
    label: id,
    newTitle: 'New',
    glyph: 'task',
    color: '#2563eb',
    fields: ['title', 'status', ...custom.map((c) => c.id)],
    custom,
  }));
  const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: ['feature', 'bug'] };
  const fields = boardFields(setup, types);
  const day = (i: number) =>
    `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
  const items = Array.from({ length: 2000 }, (_, i) =>
    card(
      {
        status: ['todo', 'doing', 'done'][i % 3]!,
        'f-budget': i * 10,
        'f-hours': i % 40,
        'f-done': i % 101,
        'f-stars': (i % 5) + 1,
        'f-effort': i % 600,
        'f-sev': ['High', 'Medium', 'Low'][i % 3]!,
        'f-plat': [['Web'], ['Web', 'iOS'], ['Android']][i % 3]!,
        'f-ok': i % 2 === 0,
        'f-launch': day(i),
        'f-span': [day(i), day(i + 3)],
      },
      i % 2 ? 'feature' : 'bug',
    ),
  );
  const now = new Date(2026, 5, 1, 12);

  it('summarises ten fields over 2,000 cards and works out For You within budget', () => {
    const run = () => {
      for (const f of fields) fieldSummary(f, items, { setup, now });
      // A fresh list each pass, so For You's per-list cache never answers.
      suggestWidgets({ setup, items: [...items], types, fields, widgets: [], now });
    };
    expect(fields).toHaveLength(10);
    for (let pass = 0; pass < 3; pass++) run();
    let best = Infinity;
    for (let pass = 0; pass < 5; pass++) best = Math.min(best, cpuMsOf(run));
    // Measured at 12 ms CPU on an M-series laptop (a pass per field); a scan per field per card is many times this.
    expect(best).toBeLessThan(cpuBudgetMs(60));
  });
});
