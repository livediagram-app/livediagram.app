import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import type { ItemTally } from './store';
import { voteCountInChoices, voteTallyWrites } from './vote-count-in';

// docs/specs/012-collaboration/session-tools.md "Count In".

const task: ItemTypeDef = {
  ...ITEM_TYPES[1],
  fields: ['title', 'votes', 'f-pri'],
  custom: [{ id: 'f-pri', label: 'Priority Vote', kind: 'votes' }],
};
const idea: ItemTypeDef = {
  ...ITEM_TYPES[3],
  fields: ['title', 'f-risk'],
  custom: [{ id: 'f-risk', label: 'Risk Vote', kind: 'votes' }],
};
const note: ItemTypeDef = { ...ITEM_TYPES[2], fields: ['title', 'votes'] };
const TYPES = [task, idea, note];

describe('Count In choices', () => {
  it('lists the Votes fields the boards’ types offer, the built-in first', () => {
    expect(voteCountInChoices([{}], TYPES)).toEqual([
      { id: 'votes', label: 'Votes' },
      { id: 'f-pri', label: 'Priority Vote' },
      { id: 'f-risk', label: 'Risk Vote' },
    ]);
    expect(voteCountInChoices([{ addTypes: [idea.id] }, null], TYPES)).toEqual([
      { id: 'votes', label: 'Votes' },
      { id: 'f-risk', label: 'Risk Vote' },
    ]);
  });

  it('offers nothing when only the built-in is there, or no board is', () => {
    expect(voteCountInChoices([{ addTypes: [note.id] }], TYPES)).toEqual([]);
    expect(voteCountInChoices([], TYPES)).toEqual([]);
  });
});

describe('a tally’s writes', () => {
  const tallies: ItemTally[] = [
    { id: 'a', votes: { p: 1 } },
    { id: 'b', votes: { p: 2 } },
    { id: 'c', votes: { q: 1 } },
  ];
  const typeOf = (id: string) => ({ a: task, b: note })[id];

  it('lands the cards offering the field in it, the rest in the built-in', () => {
    expect(voteTallyWrites(tallies, 'f-pri', typeOf)).toEqual([
      { kind: 'tally', field: 'f-pri', tallies: [tallies[0]] },
      { kind: 'tally', tallies: [tallies[1], tallies[2]] },
    ]);
  });

  it('is one write to the built-in when the vote counts there, and none for no dots', () => {
    expect(voteTallyWrites(tallies, undefined, typeOf)).toEqual([{ kind: 'tally', tallies }]);
    expect(voteTallyWrites([], 'f-pri', typeOf)).toEqual([]);
  });
});
