import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import {
  ITEM_TYPE_STATUSES_MAX,
  typeAllowsStatus,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from './type-catalogue';
import {
  boardStatusJoins,
  boardTypeStatuses,
  planStatusOrder,
  typeStatusesOf,
  withTypeStatuses,
} from './type-statuses';

// A board set-up with columns by status, taking `addTypes` (absent: every type).
const board = (statuses: string[], addTypes?: string[], more: object = {}) => ({
  columns: statuses.map((s) => ({ id: `c-${s}`, status: s, name: s.toUpperCase() })),
  ...(addTypes ? { addTypes } : {}),
  ...more,
});
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const note = ITEM_TYPES.find((t) => t.id === 'note')!;
const catalogue = (...types: ItemTypeDef[]): ItemTypeCatalogue => ({ version: 1, types });

// docs/specs/026-plan/item-types.md "The statuses a type uses".
describe('typeStatusesOf', () => {
  it('reads a type’s own list, in its order', () => {
    expect(typeStatusesOf({ statuses: ['done', 'todo'] }, ['todo', 'doing', 'done'])).toEqual([
      'done',
      'todo',
    ]);
  });

  it('reads a legacy type as every plan status less the ones it left out', () => {
    expect(typeStatusesOf({ excludedStatuses: ['doing'] }, ['todo', 'doing', 'done'])).toEqual([
      'todo',
      'done',
    ]);
    expect(typeStatusesOf({}, new Set(['todo', 'done']))).toEqual(['todo', 'done']);
  });

  it('agrees with typeAllowsStatus for both shapes', () => {
    expect(typeAllowsStatus({ statuses: ['todo'] }, 'todo')).toBe(true);
    expect(typeAllowsStatus({ statuses: ['todo'] }, 'done')).toBe(false);
    expect(typeAllowsStatus({ statuses: [] }, 'todo')).toBe(false);
    expect(typeAllowsStatus({ statuses: [] }, undefined)).toBe(true);
    expect(typeAllowsStatus({ excludedStatuses: ['done'] }, 'done')).toBe(false);
    expect(typeAllowsStatus({}, 'done')).toBe(true);
    expect(typeAllowsStatus(undefined, 'done')).toBe(true);
  });
});

describe('planStatusOrder', () => {
  it('lists every board status once, in order, skipping All Cards, Archive and bad set-ups', () => {
    expect(
      planStatusOrder([
        board(['todo', 'doing']),
        board(['all'], undefined, { allCards: true }),
        board(['gone'], undefined, { archive: true }),
        null,
        board(['doing', 'done']),
      ]),
    ).toEqual(['todo', 'doing', 'done']);
  });
});

describe('boardTypeStatuses', () => {
  const ids = ['task', 'bug', 'story'];

  it('gives a board’s statuses to the types it takes, and every type when it names none', () => {
    const got = boardTypeStatuses([board(['new', 'fixing'], ['bug']), board(['todo', 'new'])], ids);
    expect(got.get('bug')).toEqual(['new', 'fixing', 'todo']);
    expect(got.get('task')).toEqual(['todo', 'new']);
    expect(got.get('story')).toEqual(['todo', 'new']);
  });

  it('gives nothing from a board taking no type, an empty board, All Cards or Archive', () => {
    const got = boardTypeStatuses(
      [
        board(['a'], []),
        board([]),
        board(['b'], undefined, { allCards: true }),
        board(['c'], undefined, { archive: true }),
      ],
      ids,
    );
    expect([...got.values()].flat()).toEqual([]);
  });

  it('reads a board whose named types are all deleted as taking every type', () => {
    expect(boardTypeStatuses([board(['x'], ['gone'])], ids).get('task')).toEqual(['x']);
  });

  it('reads a board by its named types alone when asked (its brought types still on their way)', () => {
    const got = boardTypeStatuses(
      [board(['x'], ['gone']), board(['y'], ['bug', 'gone'])],
      ids,
      true,
    );
    expect(got.get('task')).toEqual([]);
    expect(got.get('bug')).toEqual(['y']);
  });
});

describe('boardStatusJoins', () => {
  const ids = ['task', 'bug'];

  it('joins a new board’s statuses to the types it takes, never to the others (#54)', () => {
    const before = [board(['new', 'doing', 'done'], ['bug'])];
    const after = [...before, board(['backlog', 'doing', 'shipped'], ['task'])];
    const joins = boardStatusJoins(before, after, ids);
    expect(joins.get('task')).toEqual(['backlog', 'doing', 'shipped']);
    expect(joins.has('bug')).toBe(false);
  });

  it('joins a column added, and a board’s statuses to a type it starts taking', () => {
    const was = board(['todo'], ['bug']);
    expect(boardStatusJoins([was], [board(['todo', 'qa'], ['bug'])], ids)).toEqual(
      new Map([['bug', ['qa']]]),
    );
    expect(boardStatusJoins([was], [board(['todo'], ['bug', 'task'])], ids)).toEqual(
      new Map([['task', ['todo']]]),
    );
  });
});

describe('withTypeStatuses', () => {
  it('writes a legacy type in the new shape: every status but the ones it left out, in order', () => {
    const next = withTypeStatuses(catalogue({ ...task, excludedStatuses: ['doing'] }, note), {
      planStatuses: ['todo', 'doing', 'done'],
    })!;
    expect(next.types[0]!.statuses).toEqual(['todo', 'done']);
    expect('excludedStatuses' in next.types[0]!).toBe(false);
    expect(next.types[1]!.statuses).toEqual(['todo', 'doing', 'done']);
  });

  it('appends joins where a type’s list lacks them, in order, never twice', () => {
    const next = withTypeStatuses(
      catalogue({ ...task, statuses: ['done', 'todo'] }, { ...note, statuses: [] }),
      {
        joins: new Map([
          ['task', ['todo', 'qa', 'qa']],
          ['note', ['qa']],
        ]),
      },
    )!;
    expect(next.types[0]!.statuses).toEqual(['done', 'todo', 'qa']);
    expect(next.types[1]!.statuses).toEqual(['qa']);
  });

  it('leaves a legacy type alone without the plan’s statuses (it already takes a new one)', () => {
    expect(withTypeStatuses(catalogue(task), { joins: new Map([['task', ['qa']]]) })).toBeNull();
  });

  it('is null when nothing changes, or with no catalogue', () => {
    const c = catalogue({ ...task, statuses: ['todo'] });
    expect(withTypeStatuses(c, { joins: new Map([['task', ['todo']]]) })).toBeNull();
    expect(withTypeStatuses(c, {})).toBeNull();
    expect(withTypeStatuses(null, { planStatuses: ['todo'] })).toBeNull();
  });

  it('stops a list at the cap, and keeps a legacy type that would not fit as it is', () => {
    const many = Array.from({ length: ITEM_TYPE_STATUSES_MAX + 1 }, (_, i) => `s${i}`);
    expect(withTypeStatuses(catalogue(task), { planStatuses: many })).toBeNull();
    const full = catalogue({ ...task, statuses: many.slice(0, ITEM_TYPE_STATUSES_MAX) });
    expect(withTypeStatuses(full, { joins: new Map([['task', ['extra']]]) })).toBeNull();
  });

  it('is null when the result would be too large to store', () => {
    const long = (i: number) => `${'x'.repeat(36)}${String(i).padStart(3, '0')}`;
    const statuses = Array.from({ length: 120 }, (_, i) => long(i));
    const types = Array.from({ length: 8 }, (_, i) => ({ ...task, id: `t${i}`, label: `T${i}` }));
    const big = { version: 1, types } as ItemTypeCatalogue;
    expect(validateItemTypeCatalogue(big).ok).toBe(true);
    expect(withTypeStatuses(big, { planStatuses: statuses })).toBeNull();
  });
});
