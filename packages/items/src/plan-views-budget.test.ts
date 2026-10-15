import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import {
  calendarModel,
  priorityMatrixModel,
  statusMixModel,
  breakdownModel,
} from './plan-view-charts';
import { ganttModel } from './plan-view-gantt';
import { SAM, item } from './test-items';

// docs/specs/026-plan/plan-views.md: every view reads the whole store (ITEMS_MAX cards), once per change.
describe('plan view budgets', () => {
  it('builds every view over a full store well within a frame budget each', () => {
    const phases = new Map([
      ['todo', 'todo' as const],
      ['doing', 'doing' as const],
      ['done', 'done' as const],
    ]);
    const statuses = ['todo', 'doing', 'done'];
    const many = Array.from({ length: 2000 }, (_, n) => {
      const it = item({
        title: `Card ${n}`,
        status: statuses[n % 3]!,
        priority: n % 2 ? 'high' : 'low',
        assignee: SAM,
        start: '2026-09-01',
        due: `2026-10-${String((n % 28) + 1).padStart(2, '0')}`,
      });
      return n % 10 === 0 ? { ...it, type: 'project' } : it;
    });
    // Timed in CPU time (cpuMsOf), not wall time: a parallel run starved it past 250ms of wall clock once.
    const ms = cpuMsOf(() => {
      ganttModel(many, phases, new Date(2026, 9, 5), ['project']);
      calendarModel(many, phases, 2026, 9);
      breakdownModel(many, phases, { by: 'assignee' });
      statusMixModel(many);
      priorityMatrixModel(many, phases);
    });
    // 13ms locally for all five; the budget leaves room for a slow CI runner.
    expect(ms).toBeLessThan(250);
  });
});
