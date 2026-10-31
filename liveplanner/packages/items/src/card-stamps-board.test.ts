import { describe, expect, it } from 'vitest';
import {
  CARD_FIELDS,
  CARD_SIZE_FIELDS,
  laneDropPatch,
  laneFieldOf,
  laneFieldsOf,
  normaliseBoardSetup,
  projectBoard,
  type PlanBoardSetup,
} from './board';
import { boardSortFieldsOf, boardSortNamed, normaliseBoardSort, sortCards } from './board-sort';
import {
  AUTOMATIC_CARD_FIELDS,
  CARD_FIELD_LABELS,
  typeDefaultCardLayout,
  cardLayoutFields,
  typeOffersCardField,
} from './card-display';
import { searchCards, searchFields } from './card-search';
import { isSwimlaneSettable, type Item } from './item';
import { ITEM_TYPES } from './item-types';
import { presetSetup } from './presets';
import { ALI, SAM, item } from './test-items';

// docs/specs/026-plan/items.md "Created and Last Edited"; plan-board.md "Sort Cards", "Swimlanes by a field";
// item-types.md "Card display".
const day = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();
const card = (title: string, made: number, by = SAM, edited = made, editor = by): Item =>
  item(
    { title, status: 'todo' },
    { createdAt: made, createdBy: by, updatedAt: edited, updatedBy: editor },
  );
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const board = (field: string): PlanBoardSetup => ({
  ...presetSetup('kanban'),
  swimlaneBy: 'field',
  swimlaneField: field,
});
const titles = (items: readonly Item[]) => items.map((i) => i.fields['title']);
const lost = { id: '', name: 'Someone', color: '#94a3b8' };

describe('on the card', () => {
  it('are card fields after Age, Detailed only, named, offered on every type, in no default', () => {
    expect(CARD_FIELDS.slice(-5)).toEqual([
      'age',
      'createdAt',
      'createdBy',
      'updatedAt',
      'updatedBy',
    ]);
    expect(CARD_SIZE_FIELDS.minimal).not.toContain('createdAt');
    expect(AUTOMATIC_CARD_FIELDS).toEqual([
      'age',
      'createdAt',
      'createdBy',
      'updatedAt',
      'updatedBy',
    ]);
    expect(CARD_FIELD_LABELS.updatedAt).toBe('Last Edited At');
    expect(CARD_FIELD_LABELS.createdBy).toBe('Created By');
    const bare = { fields: ['title' as const], custom: [] };
    for (const f of AUTOMATIC_CARD_FIELDS) expect(typeOffersCardField(bare, f)).toBe(true);
    for (const t of ITEM_TYPES) {
      const shown = cardLayoutFields('detailed', typeDefaultCardLayout(t, 'detailed'));
      for (const f of AUTOMATIC_CARD_FIELDS) expect(shown).not.toContain(f);
    }
  });
});

describe('sorting', () => {
  it('offers Created At and Last Edited At on every board, by name too', () => {
    const offered = boardSortFieldsOf([{ ...ITEM_TYPES[0], fields: ['title'] }]);
    expect(offered.map((f) => f.label)).toEqual(['Created At', 'Last Edited At']);
    expect(
      boardSortNamed([{ field: 'Last Edited At', direction: 'descending' }], ITEM_TYPES),
    ).toEqual({
      ok: true,
      sortBy: [{ field: 'updatedAt', dir: 'desc' }],
    });
    expect(normaliseBoardSort([{ field: 'createdAt', dir: 'desc' }])).toEqual([
      { field: 'createdAt', dir: 'desc' },
    ]);
  });

  it('sorts by the moment, a card without one last', () => {
    const older = card('older', day(3, 9));
    const newer = card('newer', day(3, 17));
    const none = item({ title: 'none' });
    const unknownType = { ...card('other', day(1)), type: 'nope' };
    expect(
      titles(
        sortCards(
          [none, newer, older, unknownType],
          [{ field: 'createdAt', dir: 'asc' }],
          ITEM_TYPES,
        ),
      ),
    ).toEqual(['other', 'older', 'newer', 'none']);
    const edited = card('edited', day(1), SAM, day(30));
    expect(
      titles(sortCards([older, edited], [{ field: 'updatedAt', dir: 'desc' }], ITEM_TYPES)),
    ).toEqual(['edited', 'older']);
  });
});

describe('lanes', () => {
  it('are always offered, read-only, after the built-ins', () => {
    const fields = laneFieldsOf(ITEM_TYPES);
    const stamps = fields.filter((f) => f.readOnly);
    expect(stamps.map((f) => [f.id, f.kind])).toEqual([
      ['createdAt', 'date'],
      ['createdBy', 'person'],
      ['updatedAt', 'date'],
      ['updatedBy', 'person'],
    ]);
    expect(
      laneFieldsOf([{ ...ITEM_TYPES[0], fields: ['title'], custom: [] }]).map((f) => f.label),
    ).toEqual(['Created At', 'Created By', 'Last Edited At', 'Last Edited By']);
    expect(laneFieldOf('updatedBy', ITEM_TYPES)?.label).toBe('Last Edited By');
    // With no card types at all, nothing to lane or sort by.
    expect(laneFieldsOf([])).toEqual([]);
    expect(boardSortFieldsOf([])).toEqual([]);
    expect(normaliseBoardSetup(board('createdBy'))?.swimlaneField).toBe('createdBy');
  });

  it('rows by person, the unknown in a No row, with no empty row to drop into', () => {
    const items = [
      card('a', day(3)),
      card('b', day(4), ALI),
      item({ title: 'c', status: 'todo' }, { createdBy: lost }),
    ];
    const p = projectBoard(board('createdBy'), map(items), undefined, ITEM_TYPES);
    expect(p.lanes.map((l) => l.label)).toEqual(['Ali', 'Sam Lee', 'No Created By']);
    const onlyKnown = projectBoard(
      board('createdBy'),
      map(items.slice(0, 2)),
      undefined,
      ITEM_TYPES,
    );
    expect(onlyKnown.lanes.map((l) => l.label)).toEqual(['Ali', 'Sam Lee']);
    const empty = projectBoard(board('updatedBy'), map([]), undefined, ITEM_TYPES);
    expect(empty.lanes.map((l) => l.label)).toEqual(['No Last Edited By']);
  });

  it('rows by local day, earliest first', () => {
    const items = [card('late', day(30, 23)), card('early', day(3, 1)), card('same', day(3, 22))];
    const p = projectBoard(board('createdAt'), map(items), undefined, ITEM_TYPES);
    expect(p.lanes.map((l) => l.label)).toEqual(['2026-10-03', '2026-10-30']);
    const edited = projectBoard(
      board('updatedAt'),
      map([item({ title: 'x', status: 'todo' })]),
      undefined,
      ITEM_TYPES,
    );
    expect(edited.lanes.map((l) => l.label)).toEqual(['No Last Edited At']);
  });

  it('a drop into one of their rows sets nothing, and a move may not set one', () => {
    const p = projectBoard(board('createdBy'), map([card('a', day(3))]), undefined, ITEM_TYPES);
    expect(laneDropPatch(p.lanes[0])).toEqual({});
    const dayRows = projectBoard(
      board('createdAt'),
      map([card('a', day(3))]),
      undefined,
      ITEM_TYPES,
    );
    expect(laneDropPatch(dayRows.lanes[0])).toEqual({});
    for (const f of ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'])
      expect(isSwimlaneSettable(f)).toBe(false);
  });
});

describe('filters', () => {
  it('Card Search filters by who made a card and the day it was last edited', () => {
    const cards = [card('sam', day(3)), card('ali', day(4), ALI, day(9))];
    expect(
      titles(searchCards(cards, [{ by: 'field', field: 'createdBy', key: `f:p:${ALI.id}` }])),
    ).toEqual(['ali']);
    expect(
      titles(searchCards(cards, [{ by: 'field', field: 'updatedAt', key: 'f:"2026-10-03"' }])),
    ).toEqual(['sam']);
    expect(searchFields(cards, [], ITEM_TYPES).map((f) => f.label)).toEqual(
      expect.arrayContaining(['Created At', 'Created By', 'Last Edited At', 'Last Edited By']),
    );
  });
});
