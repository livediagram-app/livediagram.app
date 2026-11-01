import { describe, expect, it } from 'vitest';
import { builtInFieldOf, cardSourceOf, isCardDateField } from './card-source';
import { ITEM_TYPES } from './item-types';
import type { Item } from './item';

const person = { id: 'p', name: 'Sam', color: '#000000' };
const item = (key: number, fields: Item['fields'], type = 'task'): Item => ({
  id: `i${key}xxxxx`,
  type,
  key,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});

describe('cardSourceOf', () => {
  const types = [
    ...ITEM_TYPES,
    {
      ...ITEM_TYPES[0],
      id: 'risk',
      label: 'Risk',
      custom: [{ id: 'f-sev', label: 'Severity', kind: 'number' as const }],
    },
  ];
  const src = cardSourceOf(
    [
      item(2, {
        title: 'B',
        status: 'done~x1',
        assignee: person,
        due: '2026-10-08',
        labels: ['a', 'b'],
        estimate: 3,
        checklist: [{ text: 'x', done: true }],
      }),
      item(1, { title: 'A', 'f-sev': 5 }, 'risk'),
      item(3, { title: 'Gone', archived: true }),
      item(4, { title: 'Bin', status: 'trash' }),
    ],
    types,
    { statusNames: new Map([['done~x1', 'Done']]), version: 4 },
  );
  it('lists live cards in key order', () => {
    expect(src.cards().map((c) => c.key)).toEqual([1, 2]);
    expect(src.version).toBe(4);
  });
  it('reads fields by panel names', () => {
    const b = { key: 2 };
    expect(src.fieldOf(b, 'State')).toBe('Done');
    expect(src.fieldOf(b, 'Assigned to')).toBe('Sam');
    expect(src.fieldOf(b, 'Due')).toBe(46303);
    expect(src.fieldOf(b, 'Labels')).toBe('a, b');
    expect(src.fieldOf(b, 'Number')).toBe(2);
    expect(src.fieldOf(b, 'Type')).toBe('Task');
    expect(src.fieldOf(b, 'estimate')).toBe(3);
    expect(src.fieldOf(b, 'Description')).toBeNull();
    expect(src.fieldOf({ key: 1 }, 'severity')).toBe(5);
    expect(src.fieldOf({ key: 1 }, 'State')).toBeNull();
    expect(src.fieldOf({ key: 9 }, 'Title')).toBeUndefined();
    expect(src.fieldOf(b, 'Nope')).toBeUndefined();
    expect(src.knowsField('Severity')).toBe(true);
    expect(src.knowsField('Nope')).toBe(false);
  });
});

describe('builtInFieldOf', () => {
  it('reads a built-in field by any name people use, and nothing else', () => {
    expect(builtInFieldOf(' State ')).toBe('status');
    expect(builtInFieldOf('Owner')).toBe('assignee');
    expect(builtInFieldOf('Card Type')).toBe('#type');
    expect(builtInFieldOf('Number')).toBe('#key');
    expect(builtInFieldOf('Severity')).toBeUndefined();
    expect(isCardDateField('Due Date')).toBe(true);
    expect(isCardDateField('start')).toBe(true);
    expect(isCardDateField('Title')).toBe(false);
  });
});

describe('cardSourceOf, times and ranges', () => {
  it('reads a Date and Time as its UTC instant and a Date Range as its interval, a phone as typed', () => {
    const types = [
      {
        ...ITEM_TYPES[0],
        id: 'event',
        label: 'Event',
        custom: [
          { id: 'f-call', label: 'Call', kind: 'datetime' as const },
          { id: 'f-when', label: 'When', kind: 'daterange' as const },
          { id: 'f-phone', label: 'Phone', kind: 'phone' as const },
        ],
      },
    ];
    const src = cardSourceOf(
      [
        item(
          1,
          {
            title: 'A',
            'f-call': '2026-10-31T17:00:00Z[Europe/London]',
            'f-when': ['2026-10-31', '2026-11-02'],
            'f-phone': '+44 20 7946 0958',
          },
          'event',
        ),
        item(2, { title: 'B', 'f-call': 'nope' }, 'event'),
      ],
      types,
    );
    expect(src.fieldOf({ key: 1 }, 'Call')).toBe('2026-10-31T17:00:00Z');
    expect(src.fieldOf({ key: 1 }, 'When')).toBe('2026-10-31/2026-11-02');
    expect(src.fieldOf({ key: 1 }, 'Phone')).toBe('+44 20 7946 0958');
    expect(src.fieldOf({ key: 2 }, 'Call')).toBeNull();
    expect(src.fieldOf({ key: 2 }, 'When')).toBeNull();
  });
});
