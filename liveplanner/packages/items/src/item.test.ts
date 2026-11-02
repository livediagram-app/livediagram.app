import { describe, expect, it } from 'vitest';
import {
  isItemPerson,
  itemAssignee,
  itemLabels,
  itemStatus,
  itemTitle,
  itemVoteTotal,
  itemVotes,
} from './item';
import { FALLBACK_ITEM_TYPE, ITEM_TYPE_IDS } from './item-types';
import { SAM, item } from './test-items';

describe('item readers', () => {
  it('read typed fields defensively', () => {
    const a = item({
      title: 'a',
      status: 's',
      assignee: SAM,
      labels: ['x', 3],
      votes: { p: 2, q: 0, r: 'x' },
    });
    expect(itemTitle(a)).toBe('a');
    expect(itemStatus(a)).toBe('s');
    expect(itemAssignee(a)).toEqual(SAM);
    expect(itemLabels(a)).toEqual(['x']);
    expect(itemVotes(a)).toEqual({ p: 2 });
    expect(itemVoteTotal(a)).toBe(2);
    const b = item({ title: 4, status: 1, assignee: 'x', labels: 'x', votes: [] });
    expect([itemTitle(b), itemStatus(b), itemAssignee(b), itemLabels(b), itemVotes(b)]).toEqual([
      '',
      undefined,
      undefined,
      [],
      {},
    ]);
    expect(isItemPerson(null)).toBe(false);
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields": a Votes field of the type's own reads as Votes.
  it('reads the votes in a named Votes field', () => {
    const a = item({ votes: { p: 1 }, 'f-pri': { p: 3, q: 2 } });
    expect(itemVotes(a, 'f-pri')).toEqual({ p: 3, q: 2 });
    expect(itemVoteTotal(a, 'f-pri')).toBe(5);
    expect(itemVoteTotal(a)).toBe(1);
    expect(itemVoteTotal(a, 'f-none')).toBe(0);
  });

  it('catalogues types with a fallback', () => {
    expect(ITEM_TYPE_IDS).toEqual(['project', 'task', 'note', 'idea', 'action']);
    expect(FALLBACK_ITEM_TYPE.label).toBe('Item');
  });
});
