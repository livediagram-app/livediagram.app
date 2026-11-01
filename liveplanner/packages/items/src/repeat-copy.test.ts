import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_ID_PATTERN } from './limits';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import type { RepeatRule } from './repeat';
import { REPEAT_PERSON, repeatCopyFields, repeatCopyId, repeatCopyStatus } from './repeat-copy';
import { SAM, item } from './test-items';

const weekly: RepeatRule = {
  every: 'week',
  days: [1],
  // Set on a Wednesday: the card stands for Monday 2 November under the rule.
  from: '2026-11-04',
  timeZone: 'Europe/London',
};

const TYPE: ItemTypeDef = {
  ...ITEM_TYPES[0],
  custom: [
    { id: 'f-votes', label: 'Votes', kind: 'votes' },
    { id: 'f-time', label: 'Time', kind: 'duration', timeSpent: true },
    { id: 'f-steps', label: 'Steps', kind: 'checklist' },
    { id: 'f-size', label: 'Size', kind: 'number' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-11-09T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('repeatCopyFields', () => {
  it('keeps the content, leaves the rest behind, unticks and moves the dates on', () => {
    const source = item({
      title: 'Weekly report',
      description: 'Send it to the team',
      labels: ['ops'],
      assignee: SAM,
      color: 'blue',
      checklist: [
        { text: 'Gather', done: true },
        { text: 'Send', done: false },
      ],
      start: '2026-11-02',
      due: '2026-11-06',
      status: 'done',
      statusSince: 5,
      trashedFrom: 'todo',
      archived: true,
      flagged: true,
      example: true,
      votes: { a: 1 },
      repeat: weekly as never,
      linked: 'x',
      'f-votes': { a: 2 },
      'f-time': { entries: [] },
      'f-steps': [{ text: 'One', done: true }, 'odd'],
      'f-size': 3,
    });
    expect(repeatCopyFields(source, weekly, '2026-11-09', TYPE)).toEqual({
      title: 'Weekly report',
      description: 'Send it to the team',
      labels: ['ops'],
      assignee: SAM,
      color: 'blue',
      checklist: [
        { text: 'Gather', done: false },
        { text: 'Send', done: false },
      ],
      start: '2026-11-09',
      due: '2026-11-13',
      'f-steps': [{ text: 'One', done: false }, 'odd'],
      'f-size': 3,
    });
  });

  it('a monthly rule moves the dates a month on, and a card with none stays without', () => {
    const monthly: RepeatRule = { every: 'month', date: 31, from: '2026-10-31', timeZone: 'UTC' };
    const fields = repeatCopyFields(
      item({ title: 'Invoices', due: '2026-11-03', checklist: 'not a list' }),
      monthly,
      '2026-11-30',
      undefined,
    );
    expect(fields).toEqual({ title: 'Invoices', due: '2026-12-03', checklist: 'not a list' });
    expect(repeatCopyFields(item({ title: 'Plain' }), monthly, '2026-11-30', TYPE)).toEqual({
      title: 'Plain',
    });
  });

  it('falls back to the saved day when a rule never falls on one before it', () => {
    const never = { ...weekly, days: [] };
    expect(
      repeatCopyFields(item({ title: 'Odd', due: '2026-11-04' }), never, '2026-11-09', TYPE)['due'],
    ).toBe('2026-11-09');
  });
});

describe('repeatCopyStatus', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const names: [string, string][] = [
    ['s-1', 'To Do'],
    ['s-2', 'Done'],
  ];
  it("lands in the rule's column, else the type's starting state, else the source's own", () => {
    expect(repeatCopyStatus({ ...weekly, status: 's-2' }, task, names, 's-1')).toBe('s-2');
    expect(repeatCopyStatus(weekly, { ...task, defaultStatus: 's-2' }, names, 's-1')).toBe('s-2');
    expect(repeatCopyStatus(weekly, task, names, 's-9')).toBe('s-1');
    expect(repeatCopyStatus(weekly, task, [], 's-9')).toBe('s-9');
    expect(repeatCopyStatus(weekly, undefined, names, undefined)).toBeUndefined();
  });
});

describe('repeatCopyId', () => {
  it('is the same for the same card and day, different otherwise, and a valid id', () => {
    const a = repeatCopyId('card-123456', '2026-11-09');
    expect(a).toBe(repeatCopyId('card-123456', '2026-11-09'));
    expect(a).not.toBe(repeatCopyId('card-123456', '2026-11-16'));
    expect(a).not.toBe(repeatCopyId('card-654321', '2026-11-09'));
    expect(a).toMatch(ITEM_ID_PATTERN);
    expect(a).toHaveLength(24);
    expect(REPEAT_PERSON.name).toBe('Repeat');
  });
});
