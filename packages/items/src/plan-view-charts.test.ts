import { describe, expect, it } from 'vitest';
import {
  breakdownModel,
  calendarModel,
  priorityMatrixModel,
  statusMixModel,
} from './plan-view-charts';
import { shiftMonth } from './plan-view-dates';
import { ITEM_TYPES } from './item-types';
import {
  breakdownGroupingOf,
  viewChosenTypes,
  viewEligibleTypes,
  viewNeeds,
  viewShownTypes,
} from './plan-views';
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

describe('cards by field, by assignee', () => {
  it('counts each person by phase, most first, No assignee last', () => {
    const cards = [
      item({ title: '1', assignee: ALI, status: 'doing' }),
      item({ title: '2', assignee: SAM, status: 'done' }),
      item({ title: '3', assignee: SAM }),
      item({ title: '4' }),
      item({ title: '5', assignee: SAM, archived: true }),
    ];
    const m = breakdownModel(cards, phases, { by: 'assignee' });
    expect(m.rows.map((r) => [r.person?.name ?? null, r.counts, r.total])).toEqual([
      ['Sam Lee', { todo: 1, doing: 0, done: 1 }, 2],
      ['Ali', { todo: 0, doing: 1, done: 0 }, 1],
      [null, { todo: 1, doing: 0, done: 0 }, 1],
    ]);
    expect(m.max).toBe(2);
    expect(m.total).toBe(4);
    expect(breakdownModel([], phases, { by: 'assignee' })).toEqual({ rows: [], max: 0, total: 0 });
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

// docs/specs/026-plan/plan-views.md "Cards by Field".
describe('cards by field', () => {
  it('groups by any field, the empty group last', () => {
    const cards = [
      item({ title: '1', priority: 'high' }),
      item({ title: '2', priority: 'low' }),
      item({ title: '3', priority: 'high' }),
      item({ title: '4' }),
    ];
    const m = breakdownModel(cards, new Map(), { by: 'priority' });
    expect(m.rows.map((r) => [r.label, r.total])).toEqual([
      ['High', 2],
      ['Low', 1],
      ['No priority', 1],
    ]);
    expect(m.rows.at(-1)!.empty).toBe(true);
    expect(m.total).toBe(4);
  });

  it('groups by assignee unless told otherwise, busiest first', () => {
    expect(breakdownGroupingOf({})).toEqual({ by: 'assignee', field: undefined });
    expect(breakdownGroupingOf({ swimlaneBy: 'none' })).toEqual({
      by: 'assignee',
      field: undefined,
    });
    expect(breakdownGroupingOf({ swimlaneBy: 'field', swimlaneField: 'c-size' })).toEqual({
      by: 'field',
      field: 'c-size',
    });
    const cards = [
      item({ title: 'a', assignee: SAM }),
      item({ title: 'b', assignee: ALI }),
      item({ title: 'c', assignee: ALI }),
    ];
    expect(breakdownModel(cards, new Map(), { by: 'assignee' }).rows[0]!.person).toEqual(ALI);
  });
});

// docs/specs/026-plan/plan-views.md "Card types for every view".
describe('the card types a view shows', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const note = {
    ...ITEM_TYPES.find((t) => t.id === 'note')!,
    fields: ['title', 'status', 'description'],
  };
  const types = [task, note];

  it('lists only the types offering what the view needs', () => {
    expect(viewNeeds('calendar')).toEqual(['due']);
    expect(viewEligibleTypes('calendar', types).map((t) => t.id)).toEqual(['task']);
    expect(viewEligibleTypes('metric:count', types).map((t) => t.id)).toEqual(['task', 'note']);
  });

  it('shows every type it can until it names some, and the Gantt chart keeps Project', () => {
    expect(viewShownTypes('metric:count', undefined, types)).toEqual(['task', 'note']);
    expect(viewShownTypes('metric:count', { types: ['note'] }, types)).toEqual(['note']);
    expect(viewShownTypes('calendar', { types: ['note', 'task'] }, types)).toEqual(['task']);
    expect(viewChosenTypes('gantt', undefined, types)).toEqual(['project']);
  });
});
