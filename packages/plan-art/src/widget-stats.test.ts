import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item, type PlanBoardSetup } from '@livediagram/items';
import {
  boardItems,
  boardPeople,
  boardPoints,
  boardTypeCounts,
  dueCounts,
  overWipColumns,
  priorityCounts,
  staleCount,
  topVoted,
  unassignedCount,
} from './widget-stats';

let n = 0;
const ALI = { id: 'ali', name: 'Ali', color: '#123456' };
const SAM = { id: 'sam', name: 'Sam', color: '#654321' };
function item(fields: Item['fields'], type = 'task'): Item {
  n += 1;
  return {
    id: `i${n}`,
    type,
    key: n,
    rank: `r${n}`,
    fields,
    createdBy: ALI,
    updatedBy: ALI,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Item;
}

describe('widget stats', () => {
  // A board taking Notes too, so a Note counts beside the Tasks.
  const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: ['task', 'action', 'note'] };
  const items = [
    item({ title: 'a', status: 'todo', assignee: SAM }),
    item({ title: 'b', status: 'todo', assignee: ALI }, 'note'),
    item({ title: 'c', status: 'doing', assignee: SAM }),
    item({ title: 'd', status: 'archived' }),
  ];

  const shown = (s = setup, list = items) =>
    boardItems(projectBoard(s, new Map(list.map((i) => [i.id, i]))));

  it('counts only the items the board shows', () => {
    expect(shown()).toHaveLength(3);
    // Archived cards stay off an ordinary board's counts, and every card counts on All Cards.
    const archived = item({ title: 'e', status: 'todo', archived: true });
    expect(shown(setup, [...items, archived])).toHaveLength(3);
    expect(shown(presetSetup('all-cards'), items)).toHaveLength(4);
  });

  it('lists people by how many cards they hold', () => {
    expect(boardPeople(shown()).map((p) => p.name)).toEqual(['Sam', 'Ali']);
  });

  it('counts cards per type in the catalogue order', () => {
    expect(boardTypeCounts(shown(), ['note', 'task'])).toEqual([
      { type: 'note', count: 1 },
      { type: 'task', count: 2 },
    ]);
    expect(boardTypeCounts([item({}, 'zzz')], [])).toEqual([{ type: 'zzz', count: 1 }]);
  });

  it('counts the columns over their WIP limit', () => {
    const p = projectBoard(setup, new Map(items.map((i) => [i.id, i])));
    expect(overWipColumns(p)).toBe(p.columns.filter((c) => c.overLimit).length);
  });

  it('counts overdue and due-soon cards, skipping done ones', () => {
    const now = new Date(2026, 9, 5);
    const done = setup.columns.find((c) => c.id === setup.doneColumnId)!.status;
    const due = [
      item({ status: 'todo', due: '2026-10-01' }),
      item({ status: 'todo', due: '2026-10-05' }),
      item({ status: 'todo', due: '2026-10-12' }),
      item({ status: 'todo', due: '2026-10-13' }),
      item({ status: done, due: '2026-09-01' }),
      item({ status: 'todo' }),
    ];
    expect(dueCounts(setup, due, now)).toEqual({ overdue: 1, soon: 2 });
  });
});

describe('more widget stats', () => {
  const setup = presetSetup('kanban');
  const done = setup.columns.find((c) => c.id === setup.doneColumnId)!.status;
  it('adds up points, done and in all', () => {
    const items = [
      item({ status: done, estimate: 3 }),
      item({ status: 'todo', estimate: 5 }),
      item({ status: 'todo' }),
    ];
    expect(boardPoints(setup, items)).toEqual({ done: 3, total: 8, estimated: 2 });
  });

  it('counts priorities, the unassigned, the top voted and the stale', () => {
    const a = item({ priority: 'high', votes: { x: 2 } });
    const b = item({ priority: 'urgent', assignee: SAM, votes: { x: 5, y: 1 } });
    const c = item({ priority: 'high' });
    expect(priorityCounts([a, b, c])).toEqual([
      { priority: 'urgent', count: 1 },
      { priority: 'high', count: 2 },
    ]);
    expect(unassignedCount([a, b, c])).toBe(2);
    expect(topVoted([a, b, c])?.item).toBe(b);
    expect(topVoted([c])).toBeNull();
    const now = new Date(2026, 9, 30);
    const old = { ...item({ status: 'todo' }), updatedAt: new Date(2026, 9, 1).getTime() };
    const oldDone = { ...item({ status: done }), updatedAt: 0 };
    const fresh = { ...item({ status: 'todo' }), updatedAt: new Date(2026, 9, 29).getTime() };
    expect(staleCount(setup, [old, oldDone, fresh], now)).toBe(1);
  });
});
