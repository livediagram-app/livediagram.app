import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import { newCardStatus } from './new-card-status';

// docs/specs/026-plan/item-types.md "An item type": a card made off a board starts in its type's Default State, else
// the first status its type uses, in the type's order, that the boards name.
describe('newCardStatus', () => {
  const custom = { ...ITEM_TYPES[1], id: 'lead', label: 'Lead' };
  const names = new Map([
    ['todo', 'Backlog'],
    ['doing', 'Doing'],
    ['done', 'Done'],
  ]);

  it('takes the first status the type uses that a board names, in the type’s order', () => {
    expect(newCardStatus({ ...custom, statuses: ['gone', 'done', 'todo'] }, names)).toBe('done');
    expect(newCardStatus({ ...custom, excludedStatuses: ['todo'] }, names)).toBe('doing');
  });

  it('takes the Default State first, and To Do when the type uses nothing named', () => {
    expect(
      newCardStatus({ ...custom, statuses: ['todo', 'done'], defaultStatus: 'done' }, names),
    ).toBe('done');
    expect(newCardStatus({ ...custom, statuses: [] }, names)).toBe('todo');
  });
});
