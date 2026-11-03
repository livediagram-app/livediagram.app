// The Overview's card type tiles, activity, people and dates (docs/specs/026-plan/plan-overview.md).
import { describe, expect, it } from 'vitest';
import { recentActivityOf, ACTIVITY_MAX } from './overview-activity';
import { boardOfTab, boardsOf, cardsByStatus } from './overview-boards';
import { cardTypeMeta, cardTypeTilesOf, usedOnLine } from './overview-card-types';
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
    expect(tiles.map((t) => [t.type.id, t.cards, t.usedOn])).toEqual([
      ['bug', 2, ['Triage']],
      ['task', 1, ['Triage', 'Tasks']],
      ['incident', 0, ['Triage']],
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
