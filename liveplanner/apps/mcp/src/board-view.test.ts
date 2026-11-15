import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_TYPES, type Item, type ItemTypeDef, type PlanBoardOutline } from '@liveplanner/items';
import type { PlanState } from '@liveplanner/agent-verbs';
import {
  boardView,
  VIEW_BOARD_CARDS,
  VIEW_BOARD_COLUMN_CARDS,
  VIEW_CARD_TITLE_MAX,
} from './board-view';

// What the interactive view draws of a plan (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)").

const person = { id: 'u1', name: 'Ada', color: '#2563eb' };
const item = (key: number, status: string, extra: Partial<Item> = {}): Item => ({
  id: `i${key}`,
  type: 'task',
  key,
  rank: `a${String(key).padStart(6, '0')}`,
  fields: { title: `Card ${key}`, status },
  rev: 1,
  createdAt: key,
  updatedAt: key,
  createdBy: person,
  updatedBy: person,
  ...extra,
});

const columns = [
  { status: 'todo', name: 'To Do', wipLimit: 3 },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done', done: true as const },
];
const board = (over: Partial<PlanBoardOutline> = {}): PlanBoardOutline => ({
  tabId: 't1',
  tabName: 'Sprint',
  elementId: 'b1',
  title: 'Sprint board',
  kind: 'board',
  types: null,
  columns,
  ...over,
});
const odd = { ...ITEM_TYPES[1], id: 'odd', label: 'Odd', color: 'var(--accent)' } as ItemTypeDef;
const state = (items: Item[], boards: PlanBoardOutline[] = [board()]): PlanState => ({
  items,
  plan: {
    boards,
    statuses: columns.map((c) => ({ status: c.status, name: c.name })),
    types: [...ITEM_TYPES, odd],
    itemTypesRev: 1,
  },
});

describe('boardView', () => {
  it('draws each column with its count, WIP limit, done mark and cards in rank order', () => {
    const view = boardView(
      state([item(3, 'todo'), item(1, 'todo'), item(2, 'doing'), item(4, 'done')]),
    );
    expect(view).toMatchObject({
      tabId: 't1',
      name: 'Sprint',
      tabs: [{ id: 't1', name: 'Sprint' }],
    });
    const [b] = view.boards;
    expect(b).toMatchObject({ id: 'b1', title: 'Sprint board' });
    expect(b!.columns.map((c) => [c.name, c.count, c.wipLimit, c.done])).toEqual([
      ['To Do', 2, 3, false],
      ['Doing', 1, null, false],
      ['Done', 1, null, true],
    ]);
    expect(b!.columns[0]!.cards).toEqual([
      { id: 'i1', ref: '#1', title: 'Card 1', color: '#71717a' },
      { id: 'i3', ref: '#3', title: 'Card 3', color: '#71717a' },
    ]);
  });

  it('leaves out trashed, archived and status-less cards, and the cards a board does not take', () => {
    const view = boardView(
      state(
        [
          item(1, 'todo'),
          item(2, 'trash'),
          item(3, 'todo', { fields: { title: 'Gone', status: 'todo', archived: true } }),
          item(4, 'todo', { fields: { title: 'Nowhere' } }),
          item(5, 'todo', { type: 'note' }),
        ],
        [board({ types: ['task'] })],
      ),
    );
    expect(view.boards[0]!.columns[0]!.cards.map((c) => c.id)).toEqual(['i1']);
    expect(view.boards[0]!.columns[0]!.count).toBe(1);
  });

  it('gives a type colour that is not a hex colour as null, and cuts long titles', () => {
    const long = 'x'.repeat(VIEW_CARD_TITLE_MAX + 40);
    const [card] = boardView(
      state([item(1, 'todo', { type: 'odd', fields: { title: long, status: 'todo' } })]),
    ).boards[0]!.columns[0]!.cards;
    expect(card!.color).toBeNull();
    expect(card!.title).toHaveLength(VIEW_CARD_TITLE_MAX);
    expect(card!.title.endsWith('…')).toBe(true);
  });

  it('draws the tab asked for, falls back to the first board tab, and skips All Cards and Archive', () => {
    const boards = [
      board(),
      board({ tabId: 't2', tabName: 'Bugs', elementId: 'b2', title: 'Bugs' }),
      board({ tabId: 't2', tabName: 'Bugs', elementId: 'b3', title: 'More bugs' }),
      board({ tabId: 't3', tabName: 'Everything', elementId: 'b4', kind: 'all-cards' }),
      board({ tabId: 't4', tabName: 'Old', elementId: 'b5', kind: 'archive' }),
    ];
    const s = state([item(1, 'todo')], boards);
    expect(boardView(s).tabs).toEqual([
      { id: 't1', name: 'Sprint' },
      { id: 't2', name: 'Bugs' },
    ]);
    expect(boardView(s, 't2').boards.map((b) => b.id)).toEqual(['b2', 'b3']);
    expect(boardView(s, 't3').tabId).toBe('t1');
    expect(boardView(s, 'gone').boards.map((b) => b.id)).toEqual(['b1']);
  });

  it('is an empty view for a plan without a board', () => {
    expect(boardView(state([item(1, 'todo')], []), 't9')).toEqual({
      tabId: 't9',
      name: '',
      tabs: [],
      boards: [],
    });
    expect(boardView(state([], [])).tabId).toBe('');
  });

  it('orders a sorted board by its sort before taking what fits', () => {
    const view = boardView(
      state(
        [
          item(1, 'todo', { fields: { title: 'Late', status: 'todo', due: '2026-12-01' } }),
          item(2, 'todo', { fields: { title: 'Soon', status: 'todo', due: '2026-11-20' } }),
        ],
        [board({ sortBy: [{ field: 'due', dir: 'asc' }] })],
      ),
    );
    expect(view.boards[0]!.columns[0]!.cards.map((c) => c.title)).toEqual(['Soon', 'Late']);
  });

  it('draws at most what fits a column and the whole view, and counts every card', () => {
    const many = Array.from({ length: 2000 }, (_, i) => item(i + 1, columns[i % 3]!.status));
    const boards = Array.from({ length: 12 }, (_, i) => board({ elementId: `b${i}` }));
    const view = boardView(state(many, boards));
    const counts = view.boards.flatMap((b) => b.columns.map((c) => c.cards.length));
    expect(Math.max(...counts)).toBe(VIEW_BOARD_COLUMN_CARDS);
    expect(counts.reduce((a, n) => a + n, 0)).toBe(VIEW_BOARD_CARDS);
    expect(view.boards.at(-1)!.columns[0]!.cards).toEqual([]);
    expect(view.boards[0]!.columns[0]!.count).toBe(667);
  });

  // The spec's cost test: a 2,000-card board is grouped once and shaped only for what it draws.
  it('builds a 2,000-card board within its CPU budget, and small enough to send', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      item(i + 1, columns[i % 3]!.status, {
        fields: {
          title: `A card with a fairly long title, number ${i}`,
          status: columns[i % 3]!.status,
        },
      }),
    );
    const s = state(many);
    boardView(s);
    let view: ReturnType<typeof boardView> | undefined;
    const ms = cpuMsOf(() => {
      view = boardView(s);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
    expect(JSON.stringify(view).length).toBeLessThan(64 * 1024);
  });
});
