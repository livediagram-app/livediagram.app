import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, itemPersonId, type Item } from '@liveplanner/items';
import { voteTallies, voteTallyWritesOf } from './vote-tally';

// docs/specs/026-plan/items.md "Tally".
describe('voteTallies', () => {
  it('counts each card’s dots per voter, as person ids, leaving elements out', async () => {
    const tallies = await voteTallies({
      active: true,
      revealed: false,
      votesPerPerson: 3,
      votes: { 'item:i1': ['a', 'b', 'a'], el: ['a'], 'item:i2': [] },
    });
    expect(tallies).toEqual([
      { id: 'i1', votes: { [await itemPersonId('a')]: 2, [await itemPersonId('b')]: 1 } },
    ]);
  });

  // docs/specs/012-collaboration/session-tools.md "Count In".
  it('lands the dots in the vote’s Votes field, the built-in for a type without it', async () => {
    const task = {
      ...ITEM_TYPES[1],
      fields: ['title', 'f-pri'],
      custom: [{ id: 'f-pri', label: 'Priority Vote', kind: 'votes' as const }],
    };
    const card = (id: string, type: string) => ({ id, type }) as Item;
    const items = new Map([
      ['i1', card('i1', task.id)],
      ['i2', card('i2', 'note')],
    ]);
    const writes = await voteTallyWritesOf(
      {
        active: false,
        revealed: false,
        votesPerPerson: 3,
        voteField: 'f-pri',
        votes: { 'item:i1': ['a'], 'item:i2': ['a'], 'item:gone': ['a'] },
      },
      items,
      [task, ITEM_TYPES[2]],
    );
    const p = await itemPersonId('a');
    expect(writes).toEqual([
      { kind: 'tally', field: 'f-pri', tallies: [{ id: 'i1', votes: { [p]: 1 } }] },
      {
        kind: 'tally',
        tallies: [
          { id: 'i2', votes: { [p]: 1 } },
          { id: 'gone', votes: { [p]: 1 } },
        ],
      },
    ]);
  });
});
