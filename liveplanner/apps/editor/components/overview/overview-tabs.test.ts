// The Overview's tab tiles (docs/specs/026-plan/plan-overview.md "Tabs").
import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { cardsByStatus } from './overview-boards';
import {
  NO_TYPE_COLOUR,
  TILE_CARDS_MAX,
  TILE_COLUMNS_MAX,
  isTabWaiting,
  tabTileOf,
  tabTilesOf,
  visualisationOf,
  type TileInput,
} from './overview-tabs';
import { TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

const colours = new Map(TYPES.map((t) => [t.id, t.color]));
function input(cards = [card('1'), card('2', { fields: { status: 'doing' } })], loaded?: string[]) {
  const items = itemsOf(cards);
  return {
    items,
    byStatus: cardsByStatus(items.values()),
    types: TYPES,
    colourOf: (id: string) => colours.get(id) ?? NO_TYPE_COLOUR,
    loaded: new Set(loaded ?? ['b', 'v', 's', 'd', 'f', 'e', 'g', 'x']),
  } satisfies TileInput;
}

const viewTab = (view: string, opts: { types?: string[]; fill?: boolean } = {}): Tab =>
  ({
    id: 'v',
    name: 'Release Plan',
    kind: 'dashboard',
    dashboard: {
      rows: [
        {
          id: 'r1',
          height: 400,
          ...(opts.fill === false ? {} : { fill: true }),
          slots: [{ id: 's1', span: 12, content: { type: 'element', elementId: 'el' } }],
        },
      ],
    },
    elements: [
      {
        id: 'el',
        type: 'shape',
        shape: 'plan-view',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        planView: { view, ...(opts.types ? { types: opts.types } : {}) },
      },
    ],
  }) as unknown as Tab;

describe('tab tiles', () => {
  it('counts the cards a board shows and draws its first columns', () => {
    const tile = tabTileOf(
      boardTab('b', 'Triage'),
      input([
        card('1'),
        card('2'),
        card('3'),
        card('4'),
        card('5', { fields: { status: 'doing' } }),
        // Off the board: archived, trashed, a status it has no column for.
        card('6', { fields: { archived: true } }),
        card('7', { fields: { status: 'trash' } }),
        card('8', { fields: { status: 'elsewhere' } }),
        card('9', { type: 'gone' }),
      ]),
    );
    expect(tile.kindLabel).toBe('Board');
    expect(tile.detail).toBe('6 Cards');
    if (tile.picture.kind !== 'board') throw new Error('board');
    expect(tile.picture.columns).toHaveLength(3);
    expect(tile.picture.columns[0]!.cards).toHaveLength(TILE_CARDS_MAX);
    expect(tile.picture.columns[0]!.cards[0]!.colour).toBe('#ef4444');
    expect(tile.picture.columns[1]!.cards).toHaveLength(1);
    expect(tile.picture.columns[2]!.cards).toHaveLength(0);
  });

  it('draws at most four columns, and counts one card in the singular', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      status: `s${i}`,
      name: `S${i}`,
    }));
    const tile = tabTileOf(
      boardTab('b', 'Wide', { columns: many }),
      input([card('1', { fields: { status: 's0' } })]),
    );
    if (tile.picture.kind !== 'board') throw new Error('board');
    expect(tile.picture.columns).toHaveLength(TILE_COLUMNS_MAX);
    expect(tile.detail).toBe('1 Card');
  });

  it('counts only the card types a board takes', () => {
    const tile = tabTileOf(
      boardTab('b', 'Tasks', { addTypes: ['task'] }),
      input([card('1'), card('2', { type: 'task' })]),
    );
    expect(tile.detail).toBe('1 Card');
  });

  it('counts an Archive board’s archived cards, and an All Cards board’s every card', () => {
    const cards = [
      card('1', { fields: { archived: true } }),
      card('2'),
      card('3', { fields: { status: 'odd' } }),
    ];
    expect(tabTileOf(boardTab('b', 'Archive', { archive: true }), input(cards)).detail).toBe(
      '1 Card',
    );
    const all = tabTileOf(boardTab('b', 'All', { allCards: true }), input(cards));
    expect(all.detail).toBe('2 Cards');
    if (all.picture.kind !== 'board') throw new Error('board');
    expect(all.picture.columns.every((c) => c.cards.length === 0)).toBe(true);
  });

  it('draws a Gantt from the dated cards, along their dates', () => {
    const tile = tabTileOf(
      viewTab('gantt'),
      input([
        card('1', { fields: { start: '2026-01-01', due: '2026-01-10' } }),
        card('2', { type: 'task', fields: { start: '2026-01-05', due: '2026-01-20' } }),
        card('3'),
        card('4', { fields: { start: '2026-01-09', due: '2026-01-01' } }),
      ]),
    );
    expect(tile.kindLabel).toBe('Gantt Chart');
    expect(tile.detail).toBe('2 Cards');
    if (tile.picture.kind !== 'bars') throw new Error('bars');
    expect(tile.picture.bars.map((b) => b.x)).toEqual([0, 0.2]);
    expect(tile.picture.bars[1]!.colour).toBe('#3b82f6');
  });

  it('draws any other view as bars by status, of the types it reads', () => {
    const cards = [
      card('1'),
      card('2'),
      card('3', { fields: { status: 'done' } }),
      card('4', { type: 'task' }),
      card('5', { fields: { status: 'trash' } }),
      card('6', { fields: { status: undefined as unknown as string } }),
    ];
    const tile = tabTileOf(viewTab('workload', { types: ['bug'] }), input(cards));
    expect(tile.detail).toBe('4 Cards');
    if (tile.picture.kind !== 'bars') throw new Error('bars');
    expect(tile.picture.bars.map((b) => b.w)).toEqual([1, 0.5, 0.5]);
    // No cards: a Gantt with nothing dated, drawn as a single quiet bar by the picture.
    const empty = tabTileOf(viewTab('gantt'), input([]));
    expect(empty.picture).toEqual({ kind: 'bars', bars: [] });
  });

  it('draws a Dashboard as its rows and slots, a metric view counting as a dashboard', () => {
    const dash = {
      id: 'd',
      name: 'Health',
      kind: 'dashboard',
      dashboard: {
        rows: [
          {
            id: 'r1',
            height: 200,
            slots: [
              { id: 'a', span: 6, content: { type: 'note', title: 'N', text: '' } },
              { id: 'b', span: 6 },
            ],
          },
          { id: 'r2', height: 200, slots: [{ id: 'c', span: 12 }] },
        ],
      },
      elements: [],
    } as unknown as Tab;
    const tile = tabTileOf(dash, input());
    expect(tile.detail).toBe('3 Slots');
    expect(tile.picture).toEqual({
      kind: 'dashboard',
      rows: [
        {
          id: 'r1',
          slots: [
            { id: 'a', span: 6, filled: true },
            { id: 'b', span: 6, filled: false },
          ],
        },
        { id: 'r2', slots: [{ id: 'c', span: 12, filled: false }] },
      ],
    });
    // A one-slot filling row of a metric is a dashboard tile, not a view tile.
    expect(tabTileOf(viewTab('metric:count'), input()).kindLabel).toBe('Dashboard');
    expect(tabTileOf(viewTab('gantt', { fill: false }), input()).kindLabel).toBe('Dashboard');
  });

  it('names a Sheet, a Form by its questions, and a tab not started', () => {
    const sheet = {
      id: 's',
      name: 'Budget',
      kind: 'sheet',
      elements: [{ id: 'x', type: 'shape', shape: 'plan-sheet', x: 0, y: 0, width: 1, height: 1 }],
    } as unknown as Tab;
    expect(tabTileOf(sheet, input())).toMatchObject({ kindLabel: 'Sheet', detail: null });
    const form = {
      id: 'f',
      name: 'Report a Bug',
      kind: 'form',
      form: {
        heading: 'Report',
        sections: [
          {
            id: 's1',
            questions: [
              { id: 'q1', type: 'short', prompt: 'What happened?' },
              { id: 'q2', type: 'short', prompt: 'Where?' },
              { id: 'q3', type: 'short', prompt: 'When?' },
            ],
          },
        ],
      },
      elements: [],
    } as unknown as Tab;
    const formTile = tabTileOf(form, input());
    expect(formTile.kindLabel).toBe('Form');
    expect(formTile.detail).toBe('3 Questions');
    expect(formTile.picture).toEqual({ kind: 'form', fields: 2 });
    for (const blank of [
      { id: 'e', name: 'Empty', elements: [] },
      { id: 'e', name: 'Empty sheet', kind: 'sheet', elements: [] },
      { id: 'e', name: 'Empty dash', kind: 'dashboard', elements: [] },
      { id: 'e', name: 'Empty form', kind: 'form', elements: [] },
      { id: 'e', name: 'Empty board', kind: 'board', elements: [] },
    ] as unknown as Tab[])
      expect(tabTileOf(blank, input())).toMatchObject({
        kindLabel: 'Not Started',
        picture: { kind: 'empty' },
      });
  });

  it('shows a tab whose content has not arrived as loading', () => {
    const waiting = { id: 'w', name: 'Later', elements: [] } as unknown as Tab;
    expect(isTabWaiting(waiting, new Set())).toBe(true);
    expect(tabTilesOf([waiting], input([], []))[0]).toMatchObject({
      kindLabel: 'Loading…',
      picture: { kind: 'loading' },
    });
  });

  it('finds no view in a layout that is not one filling slot', () => {
    const tab = viewTab('gantt');
    expect(visualisationOf(tab, null)).toBeNull();
    expect(visualisationOf(tab, { rows: [] })).toBeNull();
    expect(
      visualisationOf(tab, {
        rows: [{ id: 'r', height: 1, fill: true, slots: [{ id: 's', span: 12 }] }],
      }),
    ).toBeNull();
    expect(
      visualisationOf(tab, {
        rows: [
          {
            id: 'r',
            height: 1,
            fill: true,
            slots: [{ id: 's', span: 12, content: { type: 'element', elementId: 'nope' } }],
          },
        ],
      }),
    ).toBeNull();
  });
});
