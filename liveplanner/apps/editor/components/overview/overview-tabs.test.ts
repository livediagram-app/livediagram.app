// The Overview's tab tiles (docs/specs/026-plan/plan-overview.md "Tabs").
import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { cardsByStatus } from './overview-boards';
import {
  isTabWaiting,
  tabTileOf,
  tabTilesOf,
  visualisationOf,
  type TileInput,
} from './overview-tabs';
import { TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

function input(cards = [card('1'), card('2', { fields: { status: 'doing' } })], loaded?: string[]) {
  const items = itemsOf(cards);
  return {
    items,
    byStatus: cardsByStatus(items.values()),
    types: TYPES,
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
  it('counts the cards a board shows, ready to preview', () => {
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
    expect(tile.state).toBe('ready');
  });

  it('counts one card in the singular, however wide the board', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      status: `s${i}`,
      name: `S${i}`,
    }));
    const tile = tabTileOf(
      boardTab('b', 'Wide', { columns: many }),
      input([card('1', { fields: { status: 's0' } })]),
    );
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
  });

  it('counts a Gantt’s dated cards', () => {
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
    expect(tile.state).toBe('ready');
  });

  it('counts any other view’s cards, of the types it reads', () => {
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
    // No cards: still a view, ready to preview its empty chart.
    expect(tabTileOf(viewTab('gantt'), input([]))).toMatchObject({
      detail: '0 Cards',
      state: 'ready',
    });
  });

  it('counts a Dashboard’s slots, a metric view counting as a dashboard', () => {
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
    expect(tile.state).toBe('ready');
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
    expect(formTile.state).toBe('ready');
    for (const blank of [
      { id: 'e', name: 'Empty', elements: [] },
      { id: 'e', name: 'Empty sheet', kind: 'sheet', elements: [] },
      { id: 'e', name: 'Empty dash', kind: 'dashboard', elements: [] },
      { id: 'e', name: 'Empty form', kind: 'form', elements: [] },
      { id: 'e', name: 'Empty board', kind: 'board', elements: [] },
    ] as unknown as Tab[])
      expect(tabTileOf(blank, input())).toMatchObject({
        kindLabel: 'Not Started',
        state: 'empty',
      });
  });

  it('shows a tab whose content has not arrived as loading', () => {
    const waiting = { id: 'w', name: 'Later', elements: [] } as unknown as Tab;
    expect(isTabWaiting(waiting, new Set())).toBe(true);
    expect(tabTilesOf([waiting], input([], []))[0]).toMatchObject({
      kindLabel: 'Loading…',
      state: 'loading',
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
