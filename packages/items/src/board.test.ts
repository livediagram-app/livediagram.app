import { describe, expect, it } from 'vitest';
import {
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
  const setup: PlanBoardSetup = { ...presetSetup('kanban'), swimlaneBy: 'none' };

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

  it('rejects a set-up with no usable column', () => {
    expect(normaliseBoardSetup(null)).toBeNull();
    expect(normaliseBoardSetup({ columns: [] })).toBeNull();
    expect(normaliseBoardSetup({ columns: [{ id: 'a' }] })).toBeNull();
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
