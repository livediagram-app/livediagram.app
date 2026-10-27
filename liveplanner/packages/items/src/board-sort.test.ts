import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { item } from './test-items';
import {
  BOARD_SORT_LEVELS_MAX,
  boardSortFieldOf,
  boardSortFieldsOf,
  boardSortLabel,
  boardSortNamed,
  boardSortText,
  defaultBoardSortDir,
  normaliseBoardSort,
  sortCards,
  withBoardSortPick,
  type BoardSortLevel,
} from './board-sort';
import { normaliseBoardSetup, projectBoard, type PlanBoardSetup } from './board';
import { reshapeBoard } from './board-place';

// docs/specs/026-plan/plan-board.md "The board set-up": Sort Cards.
const deal: ItemTypeDef = {
  id: 'deal',
  label: 'Deal',
  newTitle: 'New deal',
  glyph: 'star',
  color: '#16a34a',
  fields: [
    'title',
    'status',
    'priority',
    'due',
    'f-value',
    'f-stage',
    'f-fit',
    'f-close',
    'f-note',
  ],
  custom: [
    { id: 'f-value', label: 'Value', kind: 'currency' },
    { id: 'f-stage', label: 'Stage', kind: 'choice', options: ['Lead', 'Pitch', 'Won'] },
    { id: 'f-fit', label: 'Fit', kind: 'rating' },
    { id: 'f-close', label: 'Close', kind: 'date' },
    { id: 'f-note', label: 'Note', kind: 'text' },
    // Not in its fields: offered by no type.
    { id: 'f-old', label: 'Old', kind: 'number' },
  ],
};
// The same id as a number in one type and a date in another.
const odd: ItemTypeDef = {
  ...deal,
  id: 'odd',
  label: 'Odd',
  fields: ['title', 'status', 'f-value', 'f-count'],
  custom: [
    { id: 'f-value', label: 'Value', kind: 'date' },
    { id: 'f-count', label: 'Count', kind: 'number' },
  ],
};
const types = [...ITEM_TYPES, deal, odd];
const titles = (cards: readonly { fields: Record<string, unknown> }[]) =>
  cards.map((c) => c.fields['title']);
const by = (...levels: [string, 'asc' | 'desc'][]): BoardSortLevel[] =>
  levels.map(([field, dir]) => ({ field, dir }));

describe('Sort Cards', () => {
  it('lists the fields a board can sort by, built-ins its types have first, each once', () => {
    expect(boardSortFieldsOf([deal, odd]).map((f) => `${f.id}:${f.kind}`)).toEqual([
      'priority:priority',
      'due:date',
      'f-value:currency',
      'f-stage:choice',
      'f-fit:rating',
      'f-close:date',
      'f-count:number',
    ]);
    expect(boardSortFieldsOf(ITEM_TYPES).map((f) => f.id)).toEqual(
      expect.arrayContaining(['priority', 'estimate', 'start', 'due']),
    );
    expect(boardSortFieldsOf([])).toEqual([]);
  });

  it('finds a field by id, offered or not, and none for a kind it cannot sort', () => {
    expect(boardSortFieldOf('estimate', [])).toMatchObject({ label: 'Estimate' });
    expect(boardSortFieldOf('f-old', types)).toMatchObject({ label: 'Old', kind: 'number' });
    expect(boardSortFieldOf('f-note', types)).toBeUndefined();
    expect(boardSortFieldOf('f-gone', types)).toBeUndefined();
  });

  it('names each direction by its kind, and starts Priority and Rating on Highest First', () => {
    expect(boardSortLabel('date', 'asc')).toBe('Earliest First');
    expect(boardSortLabel('date', 'desc')).toBe('Latest First');
    expect(boardSortLabel('choice', 'asc')).toBe('In Option Order');
    expect(boardSortLabel('choice', 'desc')).toBe('Reverse Option Order');
    expect(boardSortLabel('priority', 'desc')).toBe('Highest First');
    expect(boardSortLabel(undefined, 'asc')).toBe('Lowest First');
    expect(defaultBoardSortDir('priority')).toBe('desc');
    expect(defaultBoardSortDir('rating')).toBe('desc');
    expect(defaultBoardSortDir('date')).toBe('asc');
    expect(defaultBoardSortDir(undefined)).toBe('asc');
  });

  it('reads a stored sort back: two levels at most, known ids once, asc unless desc', () => {
    expect(normaliseBoardSort(undefined)).toBeUndefined();
    expect(normaliseBoardSort([])).toBeUndefined();
    expect(
      normaliseBoardSort([
        'junk',
        { field: 'nope' },
        { field: 7 },
        { field: 'priority', dir: 'desc' },
        { field: 'priority' },
        { field: 'f-value', dir: 'sideways' },
        { field: 'due' },
      ]),
    ).toEqual(by(['priority', 'desc'], ['f-value', 'asc']));
    expect(BOARD_SORT_LEVELS_MAX).toBe(2);
  });

  it('orders by priority, highest first, no value last, rank breaking ties', () => {
    const cards = [
      item({ title: 'none' }, { type: 'deal' }),
      item({ title: 'low', priority: 'low' }, { type: 'deal' }),
      item({ title: 'urgent', priority: 'urgent' }, { type: 'deal' }),
      item({ title: 'high a', priority: 'high' }, { type: 'deal' }),
      item({ title: 'odd', priority: 'whenever' }, { type: 'deal' }),
      item({ title: 'high b', priority: 'high' }, { type: 'deal' }),
    ];
    expect(titles(sortCards(cards, by(['priority', 'desc']), types))).toEqual([
      'urgent',
      'high a',
      'high b',
      'low',
      'none',
      'odd',
    ]);
    // No value stays last the other way too.
    expect(titles(sortCards(cards, by(['priority', 'asc']), types))).toEqual([
      'low',
      'high a',
      'high b',
      'urgent',
      'none',
      'odd',
    ]);
  });

  it('breaks a first-level tie by the second level', () => {
    const cards = [
      item({ title: 'b', priority: 'high', due: '2026-03-02' }, { type: 'deal' }),
      item({ title: 'a', priority: 'high', due: '2026-03-01' }, { type: 'deal' }),
      item({ title: 'c', priority: 'low', due: '2026-01-01' }, { type: 'deal' }),
      item({ title: 'd', priority: 'high', due: 'soon' }, { type: 'deal' }),
    ];
    expect(titles(sortCards(cards, by(['priority', 'desc'], ['due', 'asc']), types))).toEqual([
      'a',
      'b',
      'd',
      'c',
    ]);
    expect(titles(sortCards(cards, by(['priority', 'desc'], ['due', 'desc']), types))).toEqual([
      'b',
      'a',
      'd',
      'c',
    ]);
  });

  it('sorts numbers, a choice by option order, ratings and dates of custom fields', () => {
    const cards = [
      item(
        { title: 'won', 'f-stage': 'Won', 'f-value': 10, 'f-fit': 2, 'f-close': '2026-05-01' },
        { type: 'deal' },
      ),
      item(
        { title: 'lead', 'f-stage': 'Lead', 'f-value': 300, 'f-fit': 5, 'f-close': '2026-02-01' },
        { type: 'deal' },
      ),
      item({ title: 'gone', 'f-stage': 'Lost', 'f-value': Number.NaN }, { type: 'deal' }),
      item({ title: 'pitch', 'f-stage': 'Pitch', 'f-value': 20, 'f-close': 7 }, { type: 'deal' }),
    ];
    expect(titles(sortCards(cards, by(['f-stage', 'asc']), types))).toEqual([
      'lead',
      'pitch',
      'won',
      'gone',
    ]);
    expect(titles(sortCards(cards, by(['f-stage', 'desc']), types))).toEqual([
      'won',
      'pitch',
      'lead',
      'gone',
    ]);
    expect(titles(sortCards(cards, by(['f-value', 'desc']), types))).toEqual([
      'lead',
      'pitch',
      'won',
      'gone',
    ]);
    expect(titles(sortCards(cards, by(['f-fit', 'desc']), types))).toEqual([
      'lead',
      'won',
      'gone',
      'pitch',
    ]);
    expect(titles(sortCards(cards, by(['f-close', 'asc']), types))).toEqual([
      'lead',
      'won',
      'gone',
      'pitch',
    ]);
  });

  it('reads no value for a field the card’s type lacks or cannot sort, and estimate and start', () => {
    const task = item({ title: 'task', estimate: 3, start: '2026-01-02' });
    const big = item({ title: 'big', estimate: 8, start: '2026-01-01' });
    const note = item({ title: 'note', 'f-note': 'zzz' }, { type: 'deal' });
    const stray = item({ title: 'stray', priority: 'urgent' }, { type: 'nowhere' });
    expect(titles(sortCards([task, big, note, stray], by(['estimate', 'desc']), types))).toEqual([
      'big',
      'task',
      'note',
      'stray',
    ]);
    // Only a Project starts by default.
    const later = item({ title: 'later', start: '2026-01-02' }, { type: 'project' });
    const sooner = item({ title: 'sooner', start: '2026-01-01' }, { type: 'project' });
    expect(titles(sortCards([later, sooner, task], by(['start', 'asc']), types))).toEqual([
      'sooner',
      'later',
      'task',
    ]);
    expect(titles(sortCards([note, task], by(['f-note', 'asc']), types))).toEqual(['note', 'task']);
    // A custom field id the card's type lists but does not define.
    const ghost: ItemTypeDef = {
      ...deal,
      id: 'ghost',
      fields: [...deal.fields, 'f-ghost', 'f-bare'],
      custom: [...deal.custom!, { id: 'f-bare', label: 'Bare', kind: 'choice' }],
    };
    // A Choice with no options gives no card a value.
    const bare = item({ title: 'bare', 'f-bare': 'x' }, { type: 'ghost' });
    expect(titles(sortCards([bare, task], by(['f-bare', 'asc']), [...types, ghost]))).toEqual([
      'bare',
      'task',
    ]);
    const g = item({ title: 'ghost', 'f-ghost': 1 }, { type: 'ghost' });
    expect(titles(sortCards([g, task], by(['f-ghost', 'asc']), [...types, ghost]))).toEqual([
      'ghost',
      'task',
    ]);
  });

  it('puts a number before a date where one field id is both, either way', () => {
    const asNumber = item({ title: 'number', 'f-value': 5 }, { type: 'deal' });
    const asDate = item({ title: 'date', 'f-value': '2026-01-01' }, { type: 'odd' });
    expect(titles(sortCards([asDate, asNumber], by(['f-value', 'asc']), types))).toEqual([
      'number',
      'date',
    ]);
    expect(titles(sortCards([asNumber, asDate], by(['f-value', 'desc']), types))).toEqual([
      'number',
      'date',
    ]);
  });

  it('hands back a copy in the given order with no sort', () => {
    const cards = [item({ title: 'b' }), item({ title: 'a' })];
    const out = sortCards(cards, undefined, types);
    expect(out).toEqual(cards);
    expect(out).not.toBe(cards);
  });

  it('names an agent’s levels by field name or id, and refuses what it cannot sort', () => {
    expect(
      boardSortNamed([{ field: 'priority', direction: 'descending' }, { field: 'Value' }], [deal]),
    ).toEqual({ ok: true, sortBy: by(['priority', 'desc'], ['f-value', 'asc']) });
    expect(boardSortNamed([{ field: 'due date', direction: 'ascending' }], [deal])).toEqual({
      ok: true,
      sortBy: by(['due', 'asc']),
    });
    expect(boardSortNamed([{ field: 'Note' }], [deal])).toMatchObject({
      ok: false,
      code: 'board_invalid',
      message: expect.stringContaining('Sortable fields: Priority, Due Date, Value'),
    });
    expect(boardSortNamed([{ field: 'Priority' }, { field: 'priority' }], [deal])).toMatchObject({
      ok: false,
      message: '"Priority" is named twice.',
    });
    expect(
      boardSortNamed([{ field: 'Priority' }, { field: 'Value' }, { field: 'Fit' }], [deal]),
    ).toMatchObject({ ok: false, message: 'A board sorts by at most 2 fields.' });
    expect(boardSortNamed([{ field: 'x' }], [])).toMatchObject({
      message: expect.stringContaining('Sortable fields: none.'),
    });
  });

  it('names a sort for the agents, a field no type has by its id', () => {
    expect(boardSortText(by(['priority', 'desc'], ['f-close', 'asc']), types)).toEqual([
      'Priority (Highest First)',
      'Close (Earliest First)',
    ]);
    expect(boardSortText(by(['f-gone', 'asc']), types)).toEqual(['f-gone (Lowest First)']);
    expect(boardSortText(undefined, types)).toEqual([]);
  });
});

describe('the menu’s picks', () => {
  it('turns sorting on at its default direction, a kept field keeping its own', () => {
    expect(withBoardSortPick(undefined, 0, { field: 'priority', kind: 'priority' })).toEqual(
      by(['priority', 'desc']),
    );
    expect(withBoardSortPick(by(['due', 'desc']), 0, { field: 'due', kind: 'date' })).toEqual(
      by(['due', 'desc']),
    );
    expect(withBoardSortPick(by(['due', 'asc']), 0, { field: 'f-x' })).toEqual(by(['f-x', 'asc']));
  });

  it('adds, changes and drops Then By, and None at Sort By turns it all off', () => {
    const one = by(['priority', 'desc']);
    const two = withBoardSortPick(one, 1, { field: 'due', kind: 'date' });
    expect(two).toEqual(by(['priority', 'desc'], ['due', 'asc']));
    expect(withBoardSortPick(two, 1, { dir: 'desc' })).toEqual(
      by(['priority', 'desc'], ['due', 'desc']),
    );
    expect(withBoardSortPick(two, 1, { field: null })).toEqual(one);
    expect(withBoardSortPick(two, 0, { field: null })).toEqual([]);
    // Sort By taking Then By's field drops Then By.
    expect(withBoardSortPick(two, 0, { field: 'due', kind: 'date' })).toEqual(by(['due', 'asc']));
    expect(withBoardSortPick(two, 0, { dir: 'asc' })).toEqual(
      by(['priority', 'asc'], ['due', 'asc']),
    );
  });

  it('ignores Then By with no Sort By, and a direction for an empty level', () => {
    expect(withBoardSortPick(undefined, 1, { field: 'due' })).toEqual([]);
    expect(withBoardSortPick(by(['due', 'asc']), 1, { dir: 'desc' })).toEqual(by(['due', 'asc']));
  });
});

describe('a sorted board', () => {
  const setup: PlanBoardSetup = {
    title: 'Deals',
    columns: [
      { id: 'a', status: 'todo', name: 'To Do' },
      { id: 'b', status: 'done', name: 'Done' },
    ],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
  };

  it('orders each column by its sort, and says it is sorted', () => {
    const cards = [
      item({ title: 'low', status: 'todo', priority: 'low' }, { type: 'deal', rank: 'a' }),
      item({ title: 'urgent', status: 'todo', priority: 'urgent' }, { type: 'deal', rank: 'b' }),
      item({ title: 'done', status: 'done', priority: 'high' }, { type: 'deal', rank: 'c' }),
    ];
    const items = new Map(cards.map((c) => [c.id, c]));
    const plain = projectBoard(setup, items, undefined, types);
    expect(titles(plain.columns[0]!.lanes[0]!.items)).toEqual(['low', 'urgent']);
    expect(plain.sorted).toBeUndefined();
    const sorted = projectBoard(
      { ...setup, sortBy: by(['priority', 'desc']) },
      items,
      undefined,
      types,
    );
    expect(titles(sorted.columns[0]!.lanes[0]!.items)).toEqual(['urgent', 'low']);
    expect(titles(sorted.columns[1]!.lanes[0]!.items)).toEqual(['done']);
    expect(sorted.sorted).toBe(true);
  });

  it('is stored, read back and changed by an agent, an empty list turning it off', () => {
    const stored = normaliseBoardSetup({ ...setup, sortBy: [{ field: 'due', dir: 'desc' }] });
    expect(stored?.sortBy).toEqual(by(['due', 'desc']));
    expect(normaliseBoardSetup(setup)).not.toHaveProperty('sortBy');
    const on = reshapeBoard(setup, { sortBy: by(['priority', 'desc']) }, []);
    expect(on.ok && on.setup.sortBy).toEqual(by(['priority', 'desc']));
    const off = reshapeBoard({ ...setup, sortBy: by(['due', 'asc']) }, { sortBy: [] }, []);
    expect(off.ok && off.setup).not.toHaveProperty('sortBy');
  });

  it('sorts a 1,000-card column by two levels within budget', () => {
    const priorities = ['urgent', 'high', 'medium', 'low', undefined];
    const cards = Array.from({ length: 1000 }, (_, i) =>
      item(
        {
          title: `c${i}`,
          status: 'todo',
          ...(priorities[i % 5] ? { priority: priorities[i % 5]! } : {}),
          ...(i % 7 ? { due: `2026-0${(i % 9) + 1}-1${i % 10}` } : {}),
        },
        { type: 'deal', rank: `r${String(i).padStart(4, '0')}` },
      ),
    );
    const items = new Map(cards.map((c) => [c.id, c]));
    const sorted = { ...setup, sortBy: by(['priority', 'desc'], ['due', 'asc']) };
    projectBoard(sorted, items, undefined, types);
    const runs = 20;
    const start = performance.now();
    for (let i = 0; i < runs; i++) projectBoard(sorted, items, undefined, types);
    const took = (performance.now() - start) / runs;
    const first = projectBoard(sorted, items, undefined, types).columns[0]!.lanes[0]!.items;
    expect(first[0]!.fields['priority']).toBe('urgent');
    expect(first[first.length - 1]!.fields['priority']).toBeUndefined();
    // Measured 1.0 ms sorted against 0.35 ms in rank order on an M-series laptop (2026-10-27); the budget allows a
    // loaded CI runner.
    expect(took).toBeLessThan(100);
  });
});
