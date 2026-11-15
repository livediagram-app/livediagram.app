import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  FLOW_DAYS_MAX,
  FLOW_NO_STATUS,
  flowCountsOf,
  flowDayOf,
  type FlowCountRow,
} from './flow-counts';
import { TRASH_STATUS } from './board-model';

// The flow counts' reading (docs/specs/026-plan/items.md "Flow counts"): each day of a range reads its own rows, else
// the last stored day before it; the Trash and other card types are left out.

const row = (day: number, status: string, cards: number, type = 'task'): FlowCountRow => ({
  day,
  type,
  status,
  cards,
});

describe('flowDayOf', () => {
  it('numbers whole UTC days from 1970', () => {
    expect(flowDayOf(0)).toBe(0);
    expect(flowDayOf(86_400_000 - 1)).toBe(0);
    expect(flowDayOf(Date.UTC(2026, 10, 15, 23, 59))).toBe(Date.UTC(2026, 10, 15) / 86_400_000);
  });
});

describe('flowCountsOf', () => {
  it('carries the last stored day forward over days with no row of their own', () => {
    const counts = flowCountsOf(
      [row(10, 'todo', 3), row(10, 'doing', 1), row(12, 'todo', 2), row(12, 'doing', 2)],
      10,
      14,
    );
    expect(counts).toMatchObject({ fromDay: 10, days: 5, countedFrom: 0 });
    expect(counts.byStatus.get('todo')).toEqual([3, 3, 2, 2, 2]);
    expect(counts.byStatus.get('doing')).toEqual([1, 1, 2, 2, 2]);
  });

  it('starts from the last stored day before the range', () => {
    const counts = flowCountsOf([row(3, 'todo', 4), row(12, 'todo', 1)], 10, 12);
    expect(counts.byStatus.get('todo')).toEqual([4, 4, 1]);
    expect(counts.countedFrom).toBe(0);
  });

  it('a status absent on a stored day reads 0 that day (a full day holds every count)', () => {
    const counts = flowCountsOf([row(1, 'todo', 2), row(1, 'done', 1), row(2, 'done', 3)], 1, 3);
    expect(counts.byStatus.get('todo')).toEqual([2, 0, 0]);
    expect(counts.byStatus.get('done')).toEqual([1, 3, 3]);
  });

  it('marks the days before counting began, which read 0', () => {
    const counts = flowCountsOf([row(13, 'todo', 2)], 10, 14);
    expect(counts.countedFrom).toBe(3);
    expect(counts.byStatus.get('todo')).toEqual([0, 0, 0, 2, 2]);
  });

  it('answers no counts when the plan had none by the end of the range', () => {
    expect(flowCountsOf([], 10, 14)).toEqual({
      fromDay: 10,
      days: 5,
      countedFrom: null,
      byStatus: new Map(),
    });
    expect(flowCountsOf([row(20, 'todo', 1)], 10, 14).countedFrom).toBeNull();
  });

  it('leaves out the Trash, other card types, and a status empty across the range', () => {
    const counts = flowCountsOf(
      [
        row(1, 'todo', 2),
        row(1, 'todo', 5, 'bug'),
        row(1, TRASH_STATUS, 7),
        row(1, FLOW_NO_STATUS, 1),
        row(1, 'gone', 0),
      ],
      1,
      2,
      new Set(['task']),
    );
    expect([...counts.byStatus.keys()]).toEqual(['todo', FLOW_NO_STATUS]);
    expect(counts.byStatus.get('todo')).toEqual([2, 2]);
  });

  it('sums the types it shows, and reads a count below zero as 0', () => {
    const counts = flowCountsOf(
      [row(1, 'todo', 2), row(1, 'todo', 3, 'bug'), row(2, 'todo', -4)],
      1,
      2,
    );
    expect(counts.byStatus.get('todo')).toEqual([5, 0]);
  });

  it('keeps at most FLOW_DAYS_MAX days, the newest, and none for a range that ends before it starts', () => {
    const counts = flowCountsOf([row(0, 'todo', 1)], 0, 999);
    expect(counts.days).toBe(FLOW_DAYS_MAX);
    expect(counts.fromDay).toBe(999 - FLOW_DAYS_MAX + 1);
    expect(flowCountsOf([row(0, 'todo', 1)], 5, 4)).toMatchObject({ days: 0, countedFrom: null });
  });

  // A worst case the plan can store: every one of 180 days changed, with 2,000 cards each in a status of its own
  // (ITEMS_MAX distinct type and status pairs, far past a real plan's dozen or two).
  it('reads 180 days of a 2,000-card plan within budget', () => {
    const rows: FlowCountRow[] = [];
    for (let day = 0; day < FLOW_DAYS_MAX; day++)
      for (let s = 0; s < 2000; s++) rows.push(row(day, `s${s}`, 1));
    let counts = flowCountsOf([], 0, 0);
    const ms = cpuMsOf(() => {
      counts = flowCountsOf(rows, 0, FLOW_DAYS_MAX - 1);
    });
    expect(counts.byStatus.size).toBe(2000);
    expect(ms).toBeLessThan(cpuBudgetMs(300));
  });
});
