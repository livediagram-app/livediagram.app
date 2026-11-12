import { describe, expect, it } from 'vitest';
import { canCastVote, voteHidesTallies, votesSpentBy, type VoteRulesVote } from './vote-rules';

// docs/specs/012-collaboration/session-tools.md: the dot vote's casting rules, shared by every product with a vote.

const vote = (over: Partial<VoteRulesVote> = {}): VoteRulesVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: { a: ['me', 'you'], b: ['me'] },
  ...over,
});

describe('voteHidesTallies', () => {
  it('hides others’ dots only while hide counts is on and the results are not shown', () => {
    expect(voteHidesTallies(null)).toBe(false);
    expect(voteHidesTallies(undefined)).toBe(false);
    expect(voteHidesTallies(vote())).toBe(false);
    expect(voteHidesTallies(vote({ hideCounts: true }))).toBe(true);
    expect(voteHidesTallies(vote({ hideCounts: true, revealed: true }))).toBe(false);
  });
});

describe('votesSpentBy', () => {
  it('counts a participant’s dots across every key', () => {
    expect(votesSpentBy(vote(), 'me')).toBe(2);
    expect(votesSpentBy(vote(), 'you')).toBe(1);
    expect(votesSpentBy(vote(), 'nobody')).toBe(0);
  });
});

describe('canCastVote', () => {
  it('says no once casting closes or the budget is spent', () => {
    expect(canCastVote(vote(), 'me', 'a')).toBe(true);
    expect(canCastVote(vote({ active: false }), 'me', 'a')).toBe(false);
    expect(canCastVote(vote({ votesPerPerson: 2 }), 'me', 'a')).toBe(false);
  });

  it('keeps one dot per key on a one-per-element vote', () => {
    expect(canCastVote(vote({ onePerElement: true }), 'me', 'a')).toBe(false);
    expect(canCastVote(vote({ onePerElement: true }), 'me', 'c')).toBe(true);
  });

  it('refuses a blank element only on a text-only vote', () => {
    expect(canCastVote(vote({ onlyWithText: true }), 'me', 'a', false)).toBe(false);
    expect(canCastVote(vote({ onlyWithText: true }), 'me', 'a', true)).toBe(true);
    expect(canCastVote(vote(), 'me', 'a', false)).toBe(true);
  });
});
