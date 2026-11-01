import { describe, expect, it } from 'vitest';
import {
  GANTT_ARROW_HEAD,
  GANTT_ARROW_STEP,
  ganttArrowPath,
  ganttArrows,
  ganttMarkEnds,
} from './plan-view-gantt-arrows';
import { blockingIndexOf } from './blocked-by';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import type { GanttRow } from './plan-view-gantt';
import type { Item } from './item';
import { item } from './test-items';

// docs/specs/026-plan/plan-views.md "Dependency arrows": an arrow from each blocker's row to each row it blocks.

const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, 'f-blocked-by'],
  custom: [
    ...(BASE.custom ?? []),
    {
      id: 'f-blocked-by',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
  ],
};
const phases = new Map([['done', 'done' as const]]);
const row = (it: Item, mark: GanttRow['mark'] = 'bar'): GanttRow => ({
  item: it,
  mark,
  ...(mark === 'none' ? {} : { from: 10, to: 14 }),
  done: 0,
  total: 0,
  overdue: false,
  isDone: false,
});

describe('Gantt dependency arrows', () => {
  it('pairs each row with its blockers that are rows with a mark', () => {
    const a = item({ title: 'A', status: 'done' });
    const b = item({ title: 'B', status: 'todo', 'f-blocked-by': [a.id] });
    const c = item({ title: 'C', status: 'todo', 'f-blocked-by': [b.id, 'gone'] });
    const d = item({ title: 'D', status: 'todo', 'f-blocked-by': [a.id] });
    const index = blockingIndexOf([a, b, c, d], [TASK], (s) => s === 'done');
    const entries = [
      { kind: 'lane', top: 0 },
      { kind: 'row', row: row(a), top: 30 },
      { kind: 'row', row: row(b), top: 70 },
      { kind: 'row', row: row(c), top: 110 },
      { kind: 'row', row: row(d, 'none'), top: 150 },
    ];
    const arrows = ganttArrows(entries, index, phases);
    expect(arrows.map((x) => x.done)).toEqual([true, false]);
    expect(arrows.map((x) => [x.from.row.item.id, x.to.row.item.id, x.from.top])).toEqual([
      [a.id, b.id, 30],
      [b.id, c.id, 70],
    ]);
  });

  it('draws none with fewer than two rows or no blockers', () => {
    const a = item({ title: 'A' });
    const index = blockingIndexOf([a], [TASK], () => false);
    expect(ganttArrows([{ row: row(a), top: 0 }], index, phases)).toEqual([]);
    const b = item({ title: 'B' });
    expect(
      ganttArrows(
        [
          { row: row(a), top: 0 },
          { row: row(b), top: 40 },
        ],
        index,
        phases,
      ),
    ).toEqual([]);
  });

  it('finds a mark’s ends: a bar’s days, a diamond’s half width', () => {
    const x = (day: number) => day * 10;
    expect(ganttMarkEnds({ mark: 'bar', from: 2, to: 4 }, x, 7)).toEqual({ left: 20, right: 50 });
    expect(ganttMarkEnds({ mark: 'due', from: 2, to: 2 }, x, 7)).toEqual({ left: 18, right: 32 });
    expect(ganttMarkEnds({ mark: 'start' }, x, 7)).toEqual({ left: -2, right: 12 });
  });

  it('steps out, down and in when there is room', () => {
    const p = ganttArrowPath({ x: 100, y: 20 }, { x: 200, y: 60 }, 40);
    expect(p.d).toBe(`M100 20H${100 + GANTT_ARROW_STEP}V60H${200 - GANTT_ARROW_HEAD}`);
    expect(p.head).toBe('M200 60l-5 -4v8z');
  });

  it('turns back along the row gap when the blocked mark starts first', () => {
    const down = ganttArrowPath({ x: 100, y: 20 }, { x: 60, y: 60 }, 40);
    expect(down.d).toBe('M100 20H108V40H47V60H55');
    const up = ganttArrowPath({ x: 100, y: 60 }, { x: 60, y: 20 }, 40);
    expect(up.d).toBe('M100 60H108V40H47V20H55');
  });
});
