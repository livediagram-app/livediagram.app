import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item, type PlanBoardSetup } from '@liveplanner/items';
import {
  boardItems,
  boardPeople,
  boardPoints,
  boardTime,
  boardTypeCounts,
  dueCounts,
  overWipColumns,
  percentDone,
  priorityCounts,
  staleCount,
  topVoted,
  unassignedCount,
  timeFieldOf,
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

  // Every done column is finished (docs/specs/026-plan/plan-board.md "Done columns"): Won't Do, found by its name, too.
  it('never counts a card in any done column as overdue or stale', () => {
    const board: PlanBoardSetup = {
      ...setup,
      columns: [...setup.columns, { id: 'wont', status: 'wont-do', name: "Won't Do" }],
    };
    const now = new Date(2026, 9, 30);
    const after = { ...item({ status: 'wont-do', due: '2026-10-01' }), updatedAt: 0 };
    const open = { ...item({ status: 'todo', due: '2026-10-01' }), updatedAt: 0 };
    expect(dueCounts(board, [after, open], now)).toEqual({ overdue: 1, soon: 0 });
    expect(staleCount(board, [after, open], now)).toBe(1);
    // Its points count as done too.
    const pointed = { ...after, fields: { ...after.fields, estimate: 3 } };
    expect(boardPoints(board, [pointed, open])).toMatchObject({ done: 3, total: 3 });
    // No done column: every card is not done.
    const noDone = { ...board, columns: board.columns.map((c) => ({ ...c, done: false })) };
    expect(staleCount(noDone, [after, open], now)).toBe(2);
  });
});

// docs/specs/026-plan/board-widgets.md "Widget kinds": Completion never reads finished, or untouched, when it is not.
describe('percentDone', () => {
  it('rounds the share done', () => {
    expect(percentDone(1, 4)).toBe(25);
    expect(percentDone(2, 3)).toBe(67);
  });
  it('reads 100 only when everything is done, and 0 only when nothing is', () => {
    expect(percentDone(199, 200)).toBe(99);
    expect(percentDone(200, 200)).toBe(100);
    expect(percentDone(1, 300)).toBe(1);
    expect(percentDone(0, 300)).toBe(0);
    expect(percentDone(0, 0)).toBe(0);
  });
});

// The Time widget (docs/specs/026-plan/board-widgets.md "Time").
describe('board time', () => {
  const plain = { id: 'f-est', label: 'Planned', kind: 'duration' as const };
  const spent = { id: 'f-spent', label: 'Time Spent', kind: 'duration' as const, timeSpent: true };
  const tracked = {
    id: 'tracked',
    label: 'Tracked',
    newTitle: 'New',
    glyph: 'task' as const,
    color: '#71717a',
    fields: ['title', 'f-est', 'f-spent'],
    custom: [plain, spent],
  };
  const planned = { ...tracked, id: 'planned', fields: ['title', 'f-est'] };
  const none = { ...tracked, id: 'none', fields: ['title'] };
  const types = [tracked, planned, none];
  const time = (entries: number[], running: number) =>
    ({
      people: {},
      entries: entries.map((minutes, i) => ({ id: `entry${i}00`, by: 'sam', minutes, at: i })),
      running: Array.from({ length: running }, (_, i) => ({
        id: `timer${i}00`,
        by: `p${i}`,
        start: 1,
      })),
    }) as unknown as Item['fields'][string];

  it('reads the first Time Spent field, else the first Duration', () => {
    expect(timeFieldOf(tracked)?.id).toBe('f-spent');
    expect(timeFieldOf(planned)?.id).toBe('f-est');
    expect(timeFieldOf(none)).toBeUndefined();
    expect(timeFieldOf(undefined)).toBeUndefined();
  });

  it('adds the minutes, counts the cards holding some and the timers running', () => {
    const items = [
      item({ 'f-spent': time([60, 30], 2), 'f-est': 999 }, 'tracked'),
      item({ 'f-spent': time([], 1) }, 'tracked'),
      item({ 'f-est': 45 }, 'planned'),
      item({}, 'planned'),
      item({ 'f-est': 10 }, 'none'),
      item({ 'f-est': 10 }, 'gone'),
    ];
    expect(boardTime(items, types)).toEqual({ minutes: 135, counted: 2, running: 3 });
    expect(boardTime([], types)).toEqual({ minutes: 0, counted: 0, running: 0 });
  });
});
