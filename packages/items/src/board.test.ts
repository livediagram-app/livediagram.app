import { describe, expect, it } from 'vitest';
import {
  boardShowsType,
  namedStatus,
  cardIsFaceDown,
  columnForStatus,
  normaliseBoardSetup,
  projectBoard,
  votesSpent,
  type PlanBoardSetup,
} from './board';
import {
  isPlanBoardPresetId,
  presetSetup,
  presetSetupOrBlank,
  PLAN_BOARD_PRESET_IDS,
} from './presets';
import { itemIdsShownOnTab } from './tab-items';
import { itemAccessibleName, itemSummary } from './views';
import { ALI, SAM, item } from './test-items';
import type { Item } from './item';

const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe('projectBoard', () => {
  // A Kanban board naming no card types, so it shows every type (the type filter has its own test).
  const { addTypes: _kanbanTypes, ...kanban } = presetSetup('kanban');
  const setup: PlanBoardSetup = { ...kanban, swimlaneBy: 'none' };

  it('places items in columns by status and rank, counts WIP, lists unplaced', () => {
    const items = [
      item({ title: 'a', status: 'doing' }, { rank: 'r' }),
      item({ title: 'b', status: 'doing' }, { rank: 'i' }),
      item({ title: 'c', status: 'doing' }, { rank: 'k' }),
      item({ title: 'd', status: 'doing' }, { rank: 'z' }),
      item({ title: 'e', status: 'done' }),
      item({ title: 'f', status: 'archived' }),
      item({ title: 'g' }),
    ];
    const p = projectBoard(setup, map(items));
    const doing = p.columns.find((c) => c.column.status === 'doing')!;
    expect(doing.lanes[0]!.items.map((i) => i.fields['title'])).toEqual(['b', 'c', 'a', 'd']);
    expect(doing.overLimit).toBe(true);
    expect(p.unplaced.map((i) => i.fields['title'])).toEqual(['f', 'g']);
    expect(p.doneCount).toBe(1);
    expect(p.total).toBe(5);
  });

  // docs/specs/026-plan/plan-board.md "Card types a board shows".
  it('shows only the card types it names, and a hidden card comes back with its type', () => {
    const items = map([
      item({ title: 'task', status: 'todo' }),
      item({ title: 'bug', status: 'todo' }, { type: 'project' }),
      item({ title: 'loose' }, { type: 'project' }),
    ]);
    const titles = (s: PlanBoardSetup) => {
      const p = projectBoard(s, items);
      return {
        shown: p.columns
          .flatMap((c) => c.lanes.flatMap((l) => l.items))
          .map((i) => i.fields['title']),
        unplaced: p.unplaced.map((i) => i.fields['title']),
        total: p.total,
      };
    };
    const only = { ...setup, addTypes: ['task'] };
    expect(titles(only)).toEqual({ shown: ['task'], unplaced: [], total: 1 });
    expect(boardShowsType(only, 'project')).toBe(false);
    const again = { ...setup, addTypes: ['task', 'project'] };
    expect(titles(again).shown).toEqual(['task', 'bug']);
    const { addTypes: _all, ...every } = setup;
    expect(boardShowsType(every as typeof setup, 'project')).toBe(true);
    expect(titles(every).unplaced).toEqual(['loose']);
  });

  // docs/specs/026-plan/plan-board.md "Card types a board shows": a board whose named types were all deleted
  // shows and takes every type again.
  it('shows every type once none of its named types is left in the catalogue', () => {
    const items = map([
      item({ title: 'task', status: 'todo' }),
      item({ title: 'proj', status: 'todo' }, { type: 'project' }),
    ]);
    const stale = { ...setup, addTypes: ['customer-call'] };
    const shown = projectBoard(stale, items)
      .columns.flatMap((c) => c.lanes.flatMap((l) => l.items))
      .map((i) => i.fields['title']);
    expect(shown).toEqual(['task', 'proj']);
    const catalogue = [{ id: 'task' }, { id: 'project' }];
    expect(boardShowsType(stale, 'task', catalogue)).toBe(true);
    // Without the catalogue it can only read the names it stores.
    expect(boardShowsType(stale, 'task')).toBe(false);
    expect(boardShowsType({ addTypes: ['task'] }, 'project', catalogue)).toBe(false);
  });

  it('shows every card, and applies the quick filter (counts ignore it)', () => {
    const items = [
      item(
        { title: 'Login bug', status: 'todo', assignee: SAM, labels: ['auth'] },
        { type: 'bug' },
      ),
      item({ title: 'Docs', status: 'todo', assignee: ALI }, { type: 'task' }),
    ];
    expect(projectBoard(setup, map(items)).total).toBe(2);
    const mine = projectBoard(setup, map(items), { mine: ALI.id });
    const todo = mine.columns.find((c) => c.column.status === 'todo')!;
    expect(todo.count).toBe(2);
    expect(todo.lanes[0]!.items).toHaveLength(1);
    const text = projectBoard(setup, map(items), { text: 'AUTH' });
    expect(text.columns.find((c) => c.column.status === 'todo')!.lanes[0]!.items).toHaveLength(1);
    const key = projectBoard(setup, map(items), { text: `#${items[1]!.key}` });
    expect(
      key.columns.find((c) => c.column.status === 'todo')!.lanes[0]!.items[0]!.fields['title'],
    ).toBe('Docs');
  });

  it('groups swimlanes by assignee with the empty group last', () => {
    const items = [
      item({ title: 'a', status: 'todo', assignee: SAM }),
      item({ title: 'b', status: 'todo', assignee: ALI }),
      item({ title: 'c', status: 'todo' }),
    ];
    const p = projectBoard({ ...setup, swimlaneBy: 'assignee' }, map(items));
    expect(p.lanes.map((l) => l.label)).toEqual(['Ali', 'Sam Lee', 'No assignee']);
    expect(p.lanes[0]).toMatchObject({ field: 'assignee', value: ALI });
  });

  it('groups by type, priority and parent', () => {
    const epic = item({ title: 'Epic', status: 'x' }, { type: 'project' });
    const items = [
      epic,
      item({ title: 'a', status: 'todo', priority: 'low', parent: epic.id }, { type: 'note' }),
      item({ title: 'b', status: 'todo', priority: 'urgent' }, { type: 'task' }),
      item({ title: 'c', status: 'todo' }, { type: 'mystery' }),
    ];
    expect(
      projectBoard({ ...setup, swimlaneBy: 'type' }, map(items)).lanes.map((l) => l.label),
    ).toEqual(['Task', 'Note', 'mystery']);
    expect(
      projectBoard({ ...setup, swimlaneBy: 'priority' }, map(items)).lanes.map((l) => l.label),
    ).toEqual(['Urgent', 'Low', 'No priority']);
    expect(
      projectBoard({ ...setup, swimlaneBy: 'parent' }, map(items)).lanes.map((l) => l.label),
    ).toEqual(['Epic', 'No parent']);
  });

  it("gives a project's lane its own Colour, and no other lane one", () => {
    const red = item({ title: 'Red', status: 'x', color: '#dc2626' }, { type: 'project' });
    const plain = item({ title: 'Plain', status: 'x' }, { type: 'project' });
    const items = [
      red,
      plain,
      item({ title: 'a', status: 'todo', parent: red.id }),
      item({ title: 'b', status: 'todo', parent: plain.id }),
      item({ title: 'c', status: 'todo' }),
    ];
    const lanes = projectBoard({ ...setup, swimlaneBy: 'parent' }, map(items)).lanes;
    expect(lanes.map((l) => l.colour)).toEqual(['#dc2626', undefined, undefined]);
  });

  it('offers the empty lane on an empty board', () => {
    expect(
      projectBoard({ ...setup, swimlaneBy: 'assignee' }, new Map()).lanes.map((l) => l.label),
    ).toEqual(['No assignee']);
    expect(projectBoard(setup, new Map()).lanes).toHaveLength(1);
  });

  it("counts the viewer's spent votes and decides face-down", () => {
    const a = item({ title: 'a', status: 'went-well', votes: { me: 2, you: 1 } }, { type: 'note' });
    const retro = presetSetup('retro');
    const p = projectBoard(retro, map([a]));
    expect(votesSpent(p, 'me')).toBe(2);
    expect(cardIsFaceDown(a, retro, 'other')).toBe(true);
    expect(cardIsFaceDown(a, retro, a.createdBy.id)).toBe(false);
    expect(cardIsFaceDown(a, { hideWriting: false }, 'other')).toBe(false);
  });
});

describe('the To-do List preset (docs/specs/026-plan/plan-board.md "The To-do List board")', () => {
  it('runs Actions from To Do to Done, on Compact cards, with Completion and Due Soon', () => {
    const todo = presetSetup('todo');
    expect(todo.columns.map((c) => c.name)).toEqual(['To Do', 'Done']);
    expect(todo.doneColumnId).toBe('done');
    expect(todo.addTypes).toEqual(['action']);
    expect(todo.cardSize).toBe('compact');
    expect(todo.widgets).toEqual(['progress', 'due']);
    expect(isPlanBoardPresetId('todo')).toBe(true);
  });
});

describe('normaliseBoardSetup', () => {
  it('accepts every preset unchanged', () => {
    for (const id of PLAN_BOARD_PRESET_IDS)
      expect(normaliseBoardSetup(presetSetup(id))).toEqual(presetSetup(id));
  });

  it('drops bad columns and fields, keeps the first of a duplicate status', () => {
    const s = normaliseBoardSetup({
      title: 7,
      columns: [
        { id: 'a', status: 'todo', name: 'To do', wipLimit: 0, color: 'red' },
        { id: 'b', status: 'todo', name: 'Dup' },
        { id: 'a', status: 'x' },
        'junk',
        { id: 'c', status: 'done', name: '', wipLimit: 4, color: '#00ff00' },
      ],
      swimlaneBy: 'colour',
      scope: { types: ['bug', 3], label: 'ux' },
      cardFields: ['key', 'nope'],
      voting: { on: true, budget: 500 },
      doneColumnId: 'zzz',
      hideWriting: 'yes',
    });
    // A scope an older board stored is read past: every board shows every card.
    expect(s).toEqual({
      title: 'Board',
      columns: [
        { id: 'a', status: 'todo', name: 'To do' },
        { id: 'c', status: 'done', name: 'done', wipLimit: 4, color: '#00ff00' },
      ],
      swimlaneBy: 'none',
      cardFields: ['key'],
      voting: { on: true },
      hideWriting: false,
    });
    expect(columnForStatus(s!, 'done')?.id).toBe('c');
  });

  it('keeps a Minimal or Compact card size, and reads anything else as Detailed', () => {
    const cols = [{ id: 'a', status: 's', name: 'A' }];
    expect(normaliseBoardSetup({ columns: cols, cardSize: 'compact' })?.cardSize).toBe('compact');
    expect(normaliseBoardSetup({ columns: cols, cardSize: 'minimal' })?.cardSize).toBe('minimal');
    expect(normaliseBoardSetup({ columns: cols, cardSize: 'detailed' })).not.toHaveProperty(
      'cardSize',
    );
    expect(normaliseBoardSetup({ columns: cols, cardSize: 'huge' })).not.toHaveProperty('cardSize');
  });

  it('reads a set-up with no usable column as a board waiting for its first', () => {
    expect(normaliseBoardSetup(null)).toBeNull();
    expect(normaliseBoardSetup({})).toBeNull();
    expect(normaliseBoardSetup({ columns: [] })?.columns).toEqual([]);
    expect(normaliseBoardSetup({ columns: [{ id: 'a' }] })?.columns).toEqual([]);
    expect(normaliseBoardSetup({ columns: [{ id: 'a', status: 's' }] })?.cardFields).toContain(
      'key',
    );
  });
});

describe('itemIdsShownOnTab', () => {
  it("collects a card's item, and every item once a board is on the tab", () => {
    const bug = item({ title: 'b', status: 'new', labels: ['bug'] }, { type: 'task' });
    const task = item({ title: 't', status: 'todo' }, { type: 'task' });
    const loose = item({ title: 'l' }, { type: 'note' });
    const ids = itemIdsShownOnTab(
      [
        { shape: 'plan-board', planBoard: presetSetup('bug-triage') },
        { shape: 'plan-card', planCard: { itemId: loose.id } },
        { shape: 'plan-board', planBoard: 'broken' },
        { shape: 'square' },
      ],
      [bug, task, loose],
    );
    expect([...ids].sort()).toEqual([bug.id, task.id, loose.id].sort());
    expect([
      ...itemIdsShownOnTab([{ shape: 'plan-card', planCard: { itemId: loose.id } }], [bug, loose]),
    ]).toEqual([loose.id]);
    expect(itemIdsShownOnTab([], [bug]).size).toBe(0);
  });
});

describe('item text', () => {
  it('names and summarises an item', () => {
    const a = item(
      { title: 'Fix login', assignee: SAM, priority: 'high' },
      { type: 'project', key: 12 },
    );
    expect(itemAccessibleName(a)).toBe(
      '#12 Fix login, Project, assigned to Sam Lee, high priority',
    );
    expect(itemSummary(a)).toBe('#12 [project] Fix login (@Sam Lee, !high)');
    expect(itemSummary(item({ title: 'x' }, { key: 3 }))).toBe('#3 [task] x');
  });
});

describe('presets', () => {
  it('reads a tile preset, falling back to the blank board', () => {
    expect(presetSetupOrBlank('retro').title).toBe('Retro');
    expect(presetSetupOrBlank('nope')).toEqual(presetSetup('blank'));
    expect(presetSetupOrBlank(undefined)).toEqual(presetSetup('blank'));
    expect(isPlanBoardPresetId('kanban')).toBe(true);
  });
});

// docs/specs/026-plan/plan-board.md "A state no board names": a card whose state's board or column is gone groups
// as No status, keeping the state itself.
describe('namedStatus', () => {
  it('reads a state no board names as none, and every state without names', () => {
    const names = new Map([['todo', 'To do']]);
    const gone = item({ title: 'G', status: 'next~ab12' });
    expect(namedStatus(item({ title: 'T', status: 'todo' }), names)).toBe('todo');
    expect(namedStatus(gone, names)).toBeUndefined();
    expect(namedStatus(gone)).toBe('next~ab12');
    expect(gone.fields['status']).toBe('next~ab12');
  });
});
