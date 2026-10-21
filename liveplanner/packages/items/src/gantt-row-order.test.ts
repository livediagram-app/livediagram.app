import { describe, expect, it } from 'vitest';
import {
  GANTT_ROW_ORDER_MAX,
  ganttOrderRows,
  ganttReorder,
  isGanttRowOrder,
} from './gantt-row-order';
import { isPlanViewSettings } from './plan-views';

// docs/specs/026-plan/plan-views.md "Row order".
const row = (id: string) => ({ item: { id } });
const ids = (rows: { item: { id: string } }[]) => rows.map((r) => r.item.id);

describe('a Gantt chart’s row order', () => {
  it('puts the named rows first in its order, the rest after as they came', () => {
    const rows = ['item-a', 'item-b', 'item-c', 'item-d'].map(row);
    expect(ids(ganttOrderRows(rows, ['item-c', 'item-a']))).toEqual([
      'item-c',
      'item-a',
      'item-b',
      'item-d',
    ]);
    expect(ids(ganttOrderRows(rows, undefined))).toEqual(ids(rows));
    // A stale id is ignored.
    expect(ids(ganttOrderRows(rows, ['item-gone', 'item-d']))).toEqual([
      'item-d',
      'item-a',
      'item-b',
      'item-c',
    ]);
  });

  it('moves a row to a place in its lane, dropping stale ids', () => {
    const all = ['item-a', 'item-b', 'item-c', 'item-d'];
    expect(ganttReorder(all, all, 'item-a', 2)).toEqual(['item-b', 'item-c', 'item-a', 'item-d']);
    expect(ganttReorder(all, all, 'item-d', 0)).toEqual(['item-d', 'item-a', 'item-b', 'item-c']);
    expect(ganttReorder(all, all, 'item-b', 9)).toEqual(['item-a', 'item-c', 'item-d', 'item-b']);
    expect(ganttReorder(all, all, 'item-b', 1)).toBeNull();
    expect(ganttReorder(all, all, 'item-gone', 0)).toBeNull();
  });

  it('never moves a row out of its lane', () => {
    // Lanes: [a, b] then [c, d]; moving c to the lane's top lands it before d's lane-mate, not among a and b.
    const all = ['item-a', 'item-b', 'item-c', 'item-d'];
    expect(ganttReorder(all, ['item-c', 'item-d'], 'item-d', 0)).toEqual([
      'item-a',
      'item-b',
      'item-d',
      'item-c',
    ]);
    expect(ganttReorder(all, ['item-a', 'item-b'], 'item-a', 5)).toEqual([
      'item-b',
      'item-a',
      'item-c',
      'item-d',
    ]);
  });

  it('is validated as card ids, none repeated, within its cap', () => {
    expect(isGanttRowOrder(['item-a', 'item-b'])).toBe(true);
    expect(isGanttRowOrder(['item-a', 'item-a'])).toBe(false);
    expect(isGanttRowOrder(['not an id!'])).toBe(false);
    expect(isGanttRowOrder('item-a')).toBe(false);
    expect(
      isGanttRowOrder(Array.from({ length: GANTT_ROW_ORDER_MAX + 1 }, (_, i) => `item-${i}`)),
    ).toBe(false);
    expect(isPlanViewSettings({ view: 'gantt', rowOrder: ['item-a'] })).toBe(true);
    expect(isPlanViewSettings({ view: 'gantt', rowOrder: ['item-a', 'item-a'] })).toBe(false);
  });
});
