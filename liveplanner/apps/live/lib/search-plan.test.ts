import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@liveplanner/project';
import {
  ARCHIVED_FIELD,
  ITEMS_MAX,
  TRASH_STATUS,
  presetSetup,
  type Item,
} from '@liveplanner/items';
import {
  BOARD_RESULT_LIMIT,
  CARD_RESULT_LIMIT,
  boardResults,
  cardResults,
  cardTabResolver,
} from './search-plan';
import { buildSearchResults } from './search';

// docs/specs/008-canvas/canvas-and-palette.md "Search panel": inside a project, search finds its boards by title and
// its cards by number, title or description, and opens a card on the tab whose board shows it.

let n = 0;
function card(
  title: string,
  extra: Partial<Item> & { status?: string; description?: string; archived?: true } = {},
): Item {
  n += 1;
  const { status = 'todo', description, archived, ...rest } = extra;
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank: 'a',
    fields: {
      title,
      status,
      ...(description ? { description } : {}),
      ...(archived ? { [ARCHIVED_FIELD]: true } : {}),
    },
    rev: 1,
    createdAt: 0,
    updatedAt: n,
    createdBy: { id: 'p', name: 'P', color: '#000' },
    updatedBy: { id: 'p', name: 'P', color: '#000' },
    ...rest,
  };
}
const cardsOf = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

function board(id: string, setup: object): Element {
  return {
    id,
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    planBoard: setup,
  } as unknown as Element;
}
const tab = (id: string, name: string, elements: Element[] = []): Tab => ({ id, name, elements });

describe('cards in search', () => {
  it('finds a card by its number, with or without #, first', () => {
    n = 0;
    const items = [card('Write the brief'), card('Ship it'), card('Plan 2 the launch')];
    expect(cardResults('#2', { items: cardsOf(items) }).map((c) => c.key)).toEqual([2, 3]);
    expect(cardResults('2', { items: cardsOf(items) })[0]).toMatchObject({
      kind: 'card',
      id: 'i2',
      key: 2,
      name: 'Ship it',
    });
  });

  it('ranks a title above a description, the latest change first within each', () => {
    n = 0;
    const items = [
      card('Notes', { description: 'about the launch' }),
      card('Launch day'),
      card('Launch party'),
    ];
    expect(cardResults('launch', { items: cardsOf(items) }).map((c) => c.name)).toEqual([
      'Launch party',
      'Launch day',
      'Notes',
    ]);
  });

  it('leaves out archived and trashed cards, and lists none on an empty query', () => {
    n = 0;
    const items = [
      card('Old', { archived: true }),
      card('Gone', { status: TRASH_STATUS }),
      card('Old news'),
    ];
    expect(cardResults('old', { items: cardsOf(items) }).map((c) => c.name)).toEqual(['Old news']);
    expect(cardResults('gone', { items: cardsOf(items) })).toEqual([]);
    expect(cardResults('  ', { items: cardsOf(items) })).toEqual([]);
  });

  it('keeps the best few', () => {
    n = 0;
    const items = Array.from({ length: 30 }, (_, i) => card(`Task ${i}`));
    const found = cardResults('task', { items: cardsOf(items) });
    expect(found).toHaveLength(CARD_RESULT_LIMIT);
    // The most recently changed first.
    expect(found[0]!.name).toBe('Task 29');
  });

  it('opens a card on the first tab whose board has its status, else an All Cards board', () => {
    n = 0;
    const kanban = presetSetup('kanban');
    const status = kanban.columns[1]!.status;
    const tabs = [
      tab('d', 'Overview'),
      tab('a', 'Everything', [board('ba', presetSetup('all-cards'))]),
      tab('k', 'Sprint', [board('bk', kanban)]),
    ];
    const tabOf = cardTabResolver(tabs);
    expect(tabOf(card('On the board', { status }))).toEqual({ id: 'k', name: 'Sprint' });
    expect(tabOf(card('No column', { status: 'nowhere' }))).toEqual({
      id: 'a',
      name: 'Everything',
    });
    expect(cardTabResolver([tab('d', 'Overview')])(card('Stray'))).toBeNull();
  });

  it('groups cards after the tabs, each with the tab it opens on', () => {
    n = 0;
    const kanban = presetSetup('kanban');
    const tabs = [tab('k', 'Sprint', [board('bk', kanban)])];
    const items = cardsOf([card('Fix login', { status: kanban.columns[0]!.status })]);
    const groups = buildSearchResults({
      query: 'login',
      projects: [],
      folders: [],
      tabs,
      cards: { items, tabOf: cardTabResolver(tabs) },
    });
    expect(groups.map((g) => g.key)).toEqual(['cards']);
    expect(groups[0]!.items[0]).toMatchObject({ kind: 'card', tab: { id: 'k', name: 'Sprint' } });
  });
});

describe('boards in search', () => {
  it('finds a board by its title, leaving one titled as its tab to the Tabs group', () => {
    const tabs = [
      tab('k', 'Sprint', [board('b1', { ...presetSetup('kanban'), title: 'Release Train' })]),
      tab('s', 'Sprint 2', [board('b2', { ...presetSetup('kanban'), title: 'Sprint 2' })]),
    ];
    expect(boardResults('train', tabs)).toEqual([
      { kind: 'board', id: 'b1', tabId: 'k', tabName: 'Sprint', name: 'Release Train' },
    ]);
    expect(boardResults('sprint 2', tabs)).toEqual([]);
    expect(boardResults('', tabs)).toEqual([]);
    const groups = buildSearchResults({ query: 'release', projects: [], folders: [], tabs });
    expect(groups.map((g) => g.key)).toEqual(['boards']);
  });

  it('caps the boards it lists', () => {
    const tabs = Array.from({ length: 12 }, (_, i) =>
      tab(`t${i}`, `Tab ${i}`, [board(`b${i}`, { ...presetSetup('kanban'), title: `Board ${i}` })]),
    );
    expect(boardResults('board', tabs)).toHaveLength(BOARD_RESULT_LIMIT);
  });
});

// The worst case: a project at its card limit, searched on every keystroke. Each keystroke walks every card once (their
// lowercased text cached per card version, as Find caches it), so typing stays well inside a frame.
describe('card search at the limit', () => {
  it(`searches ${ITEMS_MAX} cards per keystroke within budget`, () => {
    n = 0;
    const statuses = presetSetup('kanban').columns.map((c) => c.status);
    const items = cardsOf(
      Array.from({ length: ITEMS_MAX }, (_, i) =>
        card(`Card ${i} for the launch`, {
          status: statuses[i % statuses.length]!,
          description: `A longer description of card ${i}, with words to search through. `.repeat(
            8,
          ),
        }),
      ),
    );
    const tabs = [tab('k', 'Sprint', [board('bk', presetSetup('kanban'))])];
    const source = { items, tabOf: cardTabResolver(tabs) };
    const queries = [
      'c',
      'ca',
      'car',
      'card',
      'card 1',
      'card 19',
      '#1999',
      'launch',
      'words',
      'zzz',
    ];
    // The first pass fills the per-card text cache, as the first keystroke after opening does.
    cardResults('x', source);
    const t = performance.now();
    for (const q of queries) cardResults(q, source);
    const perKeystroke = (performance.now() - t) / queries.length;
    expect(cardResults('#1999', source)[0]!.key).toBe(1999);
    // Measured at about 1 ms a keystroke on an M-series laptop; a loaded CI runner gets four times that.
    expect(perKeystroke).toBeLessThan(16);
  });
});
