// The Overview's card type tiles, activity, people and dates (docs/specs/026-plan/plan-overview.md).
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MAX,
  activityDaysOf,
  dayKeyOf,
  dayLabelOf,
  recentActivityOf,
  samePerson,
} from './overview-activity';
import { boardOfTab, boardsOf, cardsByStatus } from './overview-boards';
import { cardCountLine, cardTypeMeta, cardTypeTilesOf, usedOnLine } from './overview-card-types';
import { datesLine, shortDate } from './overview-dates';
import { planPeopleOf } from './overview-people';
import { ANA, JO, TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

const DAY = 86_400_000;

describe('card type tiles', () => {
  it('counts each type’s fields and live cards, and names the boards that take it', () => {
    const boards = boardsOf([
      boardTab('a', 'Triage'),
      boardTab('b', 'Tasks', { addTypes: ['task'] }),
      boardTab('c', 'Archive', { archive: true }),
      boardTab('d', 'Triage'),
    ]);
    const tiles = cardTypeTilesOf(
      TYPES,
      [
        card('1'),
        card('2'),
        card('3', { fields: { status: 'trash' } }),
        card('4', { type: 'task' }),
      ],
      boards,
    );
    expect(tiles.map((t) => [t.type.id, t.cards, t.usedOn.map((u) => u.tabId)])).toEqual([
      ['bug', 2, ['a', 'd']],
      ['task', 1, ['a', 'b', 'd']],
      ['incident', 0, ['a', 'd']],
    ]);
    // The boards that name their types and not this one: Add to a Board's choices.
    expect(tiles.map((t) => t.canAddTo.map((u) => [u.tabName, u.elementId]))).toEqual([
      [['Tasks', 'b-board']],
      [],
      [['Tasks', 'b-board']],
    ]);
    expect(cardTypeMeta(tiles[0]!)).toBe('7 Fields · 2 Cards');
    expect(cardTypeMeta({ ...tiles[1]!, fields: 1, cards: 1 })).toBe('1 Field · 1 Card');
  });

  it('says where a type is used, or that no board takes it', () => {
    expect(usedOnLine([])).toBeNull();
    expect(usedOnLine(['A'])).toBe('On A');
    expect(usedOnLine(['A', 'B'])).toBe('On A and B');
    expect(usedOnLine(['A', 'B', 'C', 'D', 'E'])).toBe('On A, B and 3 More');
    const none = cardTypeTilesOf(
      TYPES,
      [],
      boardsOf([boardTab('b', 'Tasks', { addTypes: ['task'] })]),
    );
    expect(none.find((t) => t.type.id === 'bug')!.usedOn).toEqual([]);
  });

  it('splits a type’s cards by status in column order, counts the overdue, and keeps the latest as its sample', () => {
    const boards = boardsOf([boardTab('a', 'Triage')]);
    const withDue = { ...TYPES[0]!, fields: ['title', 'due'] };
    const tiles = cardTypeTilesOf(
      [withDue, TYPES[1]!],
      [
        card('1', { fields: { status: 'done', due: '2026-11-01' }, updatedAt: 5 }),
        card('2', { fields: { status: 'doing', due: '2026-11-01' }, updatedAt: 9 }),
        card('3', { fields: { status: 'todo', due: '2026-11-09' }, updatedAt: 7 }),
        card('4', { fields: { status: 'todo' }, updatedAt: 8 }),
        card('5', { fields: { status: 'odd' }, updatedAt: 1 }),
        card('6', { fields: { status: 'trash', due: '2026-01-01' }, updatedAt: 99 }),
      ],
      boards,
      { today: '2026-11-04' },
    );
    const bug = tiles[0]!;
    expect(bug.byStatus.map((s) => [s.label, s.count, s.phase])).toEqual([
      ['To Do', 2, 'todo'],
      ['Doing', 1, 'doing'],
      ['Done', 1, 'done'],
      ['Odd', 1, 'todo'],
    ]);
    // Past due and not done: card 2 alone (card 1 is done, card 6 trashed).
    expect(bug.overdue).toBe(1);
    expect(bug.sample!.id).toBe('2');
    // No Due Date field: no overdue count; no cards: no sample.
    expect(tiles[1]!.overdue).toBeNull();
    expect(tiles[1]!.sample).toBeNull();
    expect(cardCountLine(0)).toBe('No Cards Yet');
    expect(cardCountLine(1)).toBe('1 Card');
  });

  it('reads no board from a tab that is not a board', () => {
    expect(boardOfTab({ id: 'x', name: 'X', kind: 'sheet', elements: [] } as never)).toBeNull();
    expect(
      boardOfTab({
        id: 'x',
        name: 'X',
        kind: 'board',
        elements: [
          { id: 'e', type: 'text' },
          { id: 'f', type: 'shape', shape: 'rectangle' },
        ],
      } as never),
    ).toBeNull();
  });

  it('groups cards by status in rank order, key breaking ties', () => {
    const groups = cardsByStatus([
      card('2', { rank: 'b' }),
      card('1', { rank: 'a' }),
      card('3', { rank: 'b', key: 0 }),
      card('4', { fields: { status: undefined as unknown as string } }),
    ]);
    expect(groups.get('todo')!.map((c) => c.id)).toEqual(['1', '3', '2']);
    expect(groups.get('')!.map((c) => c.id)).toEqual(['4']);
  });
});

describe('recent activity', () => {
  const boards = boardsOf([boardTab('a', 'Triage')]);

  it('lists what the cards record, newest first, with where each card is', () => {
    const entries = recentActivityOf({
      items: itemsOf([
        card('1', { createdAt: 100, updatedAt: 100 }),
        card('2', {
          createdAt: 200,
          updatedAt: 500,
          updatedBy: JO,
          fields: { status: 'done', statusSince: 500 },
        }),
        card('3', { createdAt: 300, updatedAt: 400, fields: { status: 'odd' } }),
        card('4', { createdAt: 50, updatedAt: 600, fields: { status: 'trash', title: '  ' } }),
      ]),
      types: TYPES,
      boards,
      statusNames: new Map([['done', 'Fixed']]),
      plan: { createdAt: 10, by: { name: 'Ana Moreno', color: '#000' } },
    });
    expect(entries.map((e) => [e.kind, e.by.name, e.text, e.where])).toEqual([
      ['deleted', 'Ana Moreno', 'deleted Untitled', 'Trash'],
      ['moved', 'Jo Reyes', 'moved Card 2 to Fixed', 'Triage'],
      ['changed', 'Ana Moreno', 'changed Card 3', 'Cards'],
      ['added', 'Ana Moreno', 'added Card 3', 'Cards'],
      ['added', 'Ana Moreno', 'added Card 2', 'Triage'],
      ['added', 'Ana Moreno', 'added Card 1', 'Triage'],
      ['added', 'Ana Moreno', 'added Untitled', 'Trash'],
      ['created-plan', 'Ana Moreno', 'created the plan', 'Plan'],
    ]);
    expect(entries.at(-1)).toMatchObject({ setup: true, itemId: null });
    expect(entries[0]).toMatchObject({ setup: false, itemId: '4' });
  });

  it('reads a status change with no status left as a change, and names no one as Someone', () => {
    const entries = recentActivityOf({
      items: itemsOf([
        card('1', {
          createdAt: 1,
          updatedAt: 9,
          updatedBy: { id: 'x', name: '', color: '#000' },
          fields: { status: '', statusSince: 9 },
        }),
      ]),
      types: TYPES,
      boards: [],
      plan: { createdAt: 0, by: null },
    });
    expect(entries.map((e) => [e.kind, e.by.name])).toEqual([
      ['changed', 'Someone'],
      ['added', 'Ana Moreno'],
    ]);
    const unowned = recentActivityOf({
      items: new Map(),
      types: TYPES,
      boards: [],
      plan: { createdAt: 5, by: null },
    });
    expect(unowned[0]!.by.name).toBe('Someone');
  });

  it('keeps only the newest entries, never more than the cap', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      card(`${i + 1}`, { createdAt: i * 10, updatedAt: i * 10 + 5 }),
    );
    const entries = recentActivityOf({ items: itemsOf(many), types: TYPES, boards });
    expect(entries).toHaveLength(ACTIVITY_MAX);
    expect(entries[0]!.at).toBe(1995);
    for (let i = 1; i < entries.length; i++)
      expect(entries[i - 1]!.at).toBeGreaterThanOrEqual(entries[i]!.at);
    const small = recentActivityOf({ items: itemsOf(many), types: TYPES, boards, max: 3 });
    expect(small.map((e) => e.at)).toEqual([1995, 1990, 1985]);
  });

  it('orders entries at the same moment by key, whatever order the cards come in', () => {
    const a = card('1', { createdAt: 7, updatedAt: 7 });
    const b = card('2', { createdAt: 7, updatedAt: 7 });
    const one = recentActivityOf({ items: itemsOf([a, b]), types: TYPES, boards }).map(
      (e) => e.key,
    );
    const two = recentActivityOf({ items: itemsOf([b, a]), types: TYPES, boards }).map(
      (e) => e.key,
    );
    expect(one).toEqual(two);
    expect(one).toEqual(['2:made', '1:made']);
  });
});

describe('recent activity entries in parts', () => {
  const boards = boardsOf([boardTab('a', 'Triage')]);

  it('splits each entry into its verb, title, the column a move went to, its type and who', () => {
    const entries = recentActivityOf({
      items: itemsOf([
        card('1', {
          type: 'task',
          createdAt: 100,
          updatedAt: 500,
          updatedBy: JO,
          fields: { status: 'done', statusSince: 500 },
        }),
      ]),
      types: TYPES,
      boards,
      statusNames: new Map([['done', 'Fixed']]),
      plan: { createdAt: 10, by: { id: 'owner', name: 'Ana Moreno', color: '#b4461c' } },
    });
    expect(entries.map((e) => [e.verb, e.title, e.to, e.typeId, e.by.id])).toEqual([
      ['moved', 'Card 1', 'Fixed', 'task', 'jo'],
      ['added', 'Card 1', null, 'task', 'ana'],
      ['created the plan', null, null, null, 'owner'],
    ]);
  });

  it('tells one person by id, or by name and colour when ids differ', () => {
    expect(
      samePerson({ id: 'a', name: 'A', color: '#1' }, { id: 'a', name: 'B', color: '#2' }),
    ).toBe(true);
    expect(
      samePerson({ id: 'a', name: 'A', color: '#1' }, { id: 'b', name: 'A', color: '#1' }),
    ).toBe(true);
    expect(samePerson({ id: '', name: 'A', color: '#1' }, { id: '', name: 'A', color: '#2' })).toBe(
      false,
    );
  });
});

describe('recent activity by day', () => {
  const NOON = new Date(2026, 10, 4, 12, 0).getTime();
  const HOUR = 3_600_000;

  it('names today, yesterday and older days by date', () => {
    expect(dayLabelOf(NOON - HOUR, NOON)).toBe('Today');
    expect(dayLabelOf(NOON - 13 * HOUR, NOON)).toBe('Yesterday');
    expect(dayLabelOf(NOON - 3 * DAY, NOON)).toBe(shortDate(NOON - 3 * DAY, NOON));
    expect(dayKeyOf(NOON)).toBe('2026-11-04');
  });

  it('groups entries under their day and shows a person once per run', () => {
    const entries = recentActivityOf({
      items: itemsOf([
        card('1', { createdAt: NOON - HOUR, updatedAt: NOON - HOUR }),
        card('2', { createdAt: NOON - 2 * HOUR, updatedAt: NOON - 2 * HOUR }),
        card('3', { createdAt: NOON - 3 * HOUR, updatedAt: NOON - 3 * HOUR, createdBy: JO }),
        card('4', { createdAt: NOON - DAY, updatedAt: NOON - DAY, createdBy: JO }),
      ]),
      types: TYPES,
      boards: [],
    });
    const days = activityDaysOf(entries, NOON);
    expect(
      days.map((d) => [d.label, d.rows.map((r) => [r.entry.itemId, r.index, r.leads])]),
    ).toEqual([
      [
        'Today',
        [
          ['1', 0, true],
          ['2', 1, false],
          ['3', 2, true],
        ],
      ],
      ['Yesterday', [['4', 3, true]]],
    ]);
  });
});

describe('people on the plan', () => {
  it('puts the owner first, then everyone by their latest change, each once', () => {
    const people = planPeopleOf({
      owner: { id: 'owner', name: 'Ana Moreno', color: '#b4461c' },
      items: [
        card('1', { createdAt: 1, updatedAt: 5, updatedBy: JO }),
        card('2', {
          createdAt: 2,
          updatedAt: 3,
          createdBy: { id: 'kai', name: 'Kai', color: '#1f6f5c' },
        }),
        card('3', { createdBy: { id: 'example-1', name: 'Sample', color: '#000' } }),
        card('4', { createdBy: { id: 'blank', name: '', color: '#000' } }),
      ],
      present: [{ id: 'tess', name: 'Tess', color: '#6d4aa8' }],
    });
    // Ana is the owner and a card's author under another id: one person, by name and colour.
    expect(people.map((p) => p.name)).toEqual(['Ana Moreno', 'Tess', 'Jo Reyes', 'Kai']);
  });

  it('has no one on a plan with no owner name and no cards', () => {
    expect(
      planPeopleOf({ owner: { id: 'o', name: '', color: '#000' }, items: [], present: [] }),
    ).toEqual([]);
    expect(planPeopleOf({ owner: null, items: [card('1')], present: [] })).toEqual([ANA]);
  });
});

describe('dates line', () => {
  const now = new Date(2026, 10, 3, 12).getTime();

  it('says who made the plan and when, and how long since it was edited', () => {
    expect(
      datesLine({
        createdAt: new Date(2026, 9, 14).getTime(),
        ownerName: 'Ana Moreno',
        editedAt: now - 8 * 60_000,
        now,
        locale: 'en-GB',
      }),
    ).toBe('Created by Ana Moreno on 14 Oct · Edited 8 mins ago');
  });

  it('leaves out what it does not know', () => {
    expect(
      datesLine({ createdAt: now - DAY, ownerName: null, editedAt: 0, now, locale: 'en-GB' }),
    ).toBe('Created on 2 Nov');
    expect(datesLine({ createdAt: 0, ownerName: 'Ana', editedAt: now + 5, now })).toBe(
      'Edited just now',
    );
    expect(datesLine({ createdAt: 0, ownerName: null, editedAt: 0, now })).toBeNull();
  });

  it('names the year of a date in another year', () => {
    expect(shortDate(new Date(2025, 9, 14).getTime(), now, 'en-GB')).toBe('14 Oct 2025');
  });
});
