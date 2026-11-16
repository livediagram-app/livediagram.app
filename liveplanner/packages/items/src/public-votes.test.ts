import { describe, expect, it } from 'vitest';
import { ITEM_VOTERS_MAX } from './limits';
import { hasPublicVote, withPublicVote } from './public-votes';
import { item } from './test-items';
import { itemVoteTotal } from './item';

// docs/specs/026-plan/public-roadmap.md "Upvotes".
describe('withPublicVote', () => {
  it('adds one vote for a new voter beside the session votes, raising the rev only', () => {
    const card = item({ title: 'Dark mode', votes: { 'p-sam': 3 } }, { updatedAt: 5 });
    const r = withPublicVote(card, 'rv:abc', true);
    expect(r.kind).toBe('changed');
    if (r.kind !== 'changed') return;
    expect(r.item.fields['votes']).toEqual({ 'p-sam': 3, 'rv:abc': 1 });
    expect(itemVoteTotal(r.item)).toBe(4);
    expect(r.item.rev).toBe(card.rev + 1);
    expect(r.item.updatedAt).toBe(5);
    expect(r.item.updatedBy).toBe(card.updatedBy);
    expect(hasPublicVote(r.item, 'rv:abc')).toBe(true);
  });

  it('takes a vote back', () => {
    const card = item({ title: 'x', votes: { 'rv:abc': 1, 'p-sam': 2 } });
    const r = withPublicVote(card, 'rv:abc', false);
    expect(r.kind === 'changed' && r.item.fields['votes']).toEqual({ 'p-sam': 2 });
    expect(hasPublicVote(card, 'rv:abc')).toBe(true);
  });

  it('changes nothing for a vote already given or one never given', () => {
    const card = item({ title: 'x', votes: { 'rv:abc': 1 } });
    expect(withPublicVote(card, 'rv:abc', true)).toEqual({ kind: 'same' });
    expect(withPublicVote(card, 'rv:other', false)).toEqual({ kind: 'same' });
    expect(withPublicVote(item({ title: 'none' }), 'rv:x', false)).toEqual({ kind: 'same' });
  });

  it('refuses a new voter once the card holds the most voters, but still takes one back', () => {
    const votes: Record<string, number> = {};
    for (let i = 0; i < ITEM_VOTERS_MAX; i++) votes[`rv:${i}`] = 1;
    const card = item({ title: 'full', votes });
    expect(withPublicVote(card, 'rv:new', true)).toEqual({ kind: 'full' });
    expect(withPublicVote(card, 'rv:1', false).kind).toBe('changed');
  });
});
