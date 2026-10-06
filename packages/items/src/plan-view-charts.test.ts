import { describe, expect, it } from 'vitest';
import {
  calendarModel,
  priorityMatrixModel,
  shiftMonth,
  statusMixModel,
  workloadModel,
} from './plan-view-charts';
import { ALI, SAM, item } from './test-items';

const phases = new Map([
  ['todo', 'todo' as const],
  ['doing', 'doing' as const],
  ['done', 'done' as const],
]);

describe('due calendar', () => {
  it('lays the month out in Monday weeks with the cards due each day', () => {
    const a = item({ title: 'a', due: '2026-10-05' });
    const b = item({ title: 'b', due: '2026-10-05', status: 'done' });
    const c = item({ title: 'c', due: '2026-09-28' });
    const d = item({ title: 'd', due: '2026-12-01' });
    const e = item({ title: 'e', due: '2026-10-05', archived: true });
    const m = calendarModel([b, a, c, d, e], phases, 2026, 9);
    expect(m.label).toBe('October 2026');
    // Sep 28 (Monday) to Nov 1 (Sunday).
    expect(m.weeks).toHaveLength(5);
    expect(m.weeks.every((w) => w.length === 7)).toBe(true);
    expect(m.weeks[0]![0]).toMatchObject({ date: 28, inMonth: false });
    const fifth = m.weeks[1]![0]!;
    expect(fifth.date).toBe(5);
    expect(fifth.cards.map((x) => [x.item.fields['title'], x.done])).toEqual([
      ['a', false],
      ['b', true],
    ]);
    // A spill-over day shows its cards but the month counts only its own.
    expect(m.weeks[0]![0]!.cards).toHaveLength(1);
    expect(m.due).toBe(2);
  });

  it('steps months across a year', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('workload', () => {
  it('counts each person by phase, most first, Unassigned last', () => {
    const cards = [
      item({ title: '1', assignee: ALI, status: 'doing' }),
      item({ title: '2', assignee: SAM, status: 'done' }),
      item({ title: '3', assignee: SAM }),
      item({ title: '4' }),
      item({ title: '5', assignee: SAM, archived: true }),
    ];
    const m = workloadModel(cards, phases);
    expect(m.rows.map((r) => [r.person?.name ?? null, r.counts, r.total])).toEqual([
      ['Sam Lee', { todo: 1, doing: 0, done: 1 }, 2],
      ['Ali', { todo: 0, doing: 1, done: 0 }, 1],
      [null, { todo: 1, doing: 0, done: 0 }, 1],
    ]);
    expect(m.max).toBe(2);
    expect(m.total).toBe(4);
    expect(workloadModel([], phases)).toEqual({ rows: [], max: 0, total: 0 });
  });
});

describe('status breakdown', () => {
  it('orders statuses as the boards name them, then others, then No status', () => {
    const names = new Map([
      ['todo', 'To do'],
      ['done', 'Done'],
    ]);
    const cards = [
      item({ title: '1', status: 'done' }),
      item({ title: '2' }),
      item({ title: '3', status: 'review~ab12' }),
      item({ title: '4', status: 'todo' }),
      item({ title: '5', status: 'todo' }),
    ];
    const m = statusMixModel(cards, names);
    expect(m.slices.map((s) => [s.label, s.count])).toEqual([
      ['To do', 2],
      ['Done', 1],
      ['Review', 1],
      ['No status', 1],
    ]);
    expect(m.total).toBe(5);
  });
});

describe('priority by status', () => {
  it('counts priority by phase, No Priority last', () => {
    const cards = [
      item({ title: '1', priority: 'urgent', status: 'doing' }),
      item({ title: '2', priority: 'urgent', status: 'doing' }),
      item({ title: '3', priority: 'low', status: 'done' }),
      item({ title: '4' }),
    ];
    const m = priorityMatrixModel(cards, phases);
    expect(m.rows.map((r) => r.priority)).toEqual(['urgent', 'high', 'medium', 'low', null]);
    expect(m.rows[0]!.counts).toEqual({ todo: 0, doing: 2, done: 0 });
    expect(m.rows[3]!.counts.done).toBe(1);
    expect(m.rows[4]!.counts.todo).toBe(1);
    expect(m.max).toBe(2);
    expect(m.total).toBe(4);
  });
});
