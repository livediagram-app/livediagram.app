import { describe, expect, it } from 'vitest';
import { itemPersonId } from '@livediagram/items';
import { voteTallies } from './vote-tally';

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
});
