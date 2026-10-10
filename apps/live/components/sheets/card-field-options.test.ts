import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { cardFieldChoice } from './card-field-options';

const plan = {
  types: [
    ...ITEM_TYPES,
    {
      ...ITEM_TYPES[0]!,
      id: 'deal',
      label: 'Deal',
      custom: [
        { id: 'f-stage', label: 'Stage', kind: 'choice' as const, options: ['Lead', 'Won'] },
      ],
    },
  ],
  statusNames: new Map([
    ['todo', 'To Do'],
    ['b~todo', 'To Do'],
    ['done', 'Done'],
    ['trash', 'Trash'],
  ]),
  people: [
    { id: 'a', name: 'Ada', color: '#000000' },
    { id: 'b', name: 'Ada', color: '#000000' },
    { id: 'c', name: 'Sam', color: '#000000' },
  ],
};

describe('a card table column’s choices', () => {
  it('lists types, states, priorities, people and choice options, and dates as dates', () => {
    expect(cardFieldChoice('Type', plan)).toMatchObject({
      kind: 'list',
      options: expect.arrayContaining(['Task', 'Deal']),
    });
    expect(cardFieldChoice('State', plan)).toEqual({ kind: 'list', options: ['To Do', 'Done'] });
    expect(cardFieldChoice('Priority', plan)).toEqual({
      kind: 'list',
      options: ['Urgent', 'High', 'Medium', 'Low'],
    });
    expect(cardFieldChoice('Assignee', plan)).toEqual({ kind: 'list', options: ['Ada', 'Sam'] });
    expect(cardFieldChoice('stage', plan)).toEqual({ kind: 'list', options: ['Lead', 'Won'] });
    expect(cardFieldChoice('Due', plan)).toEqual({ kind: 'date' });
    expect(cardFieldChoice('Title', plan)).toBeNull();
  });
});
