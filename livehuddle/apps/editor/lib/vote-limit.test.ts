import { describe, expect, it } from 'vitest';
import { ApiError } from './api/core';
import { isVoteLimitError, VOTE_LIMIT_MESSAGE } from './vote-limit';

// docs/specs/012-collaboration/vote-integrity.md: a refused guest vote says how to vote, not "try again".
describe('isVoteLimitError', () => {
  it('recognises the api refusal and nothing else', () => {
    expect(isVoteLimitError(new ApiError('item vote', 429, 'vote_limit'))).toBe(true);
    expect(isVoteLimitError(new ApiError('item vote', 429, 'rate_limited'))).toBe(false);
    expect(isVoteLimitError(new Error('network'))).toBe(false);
    expect(isVoteLimitError(null)).toBe(false);
  });

  it('points the guest at signing in', () => {
    expect(VOTE_LIMIT_MESSAGE).toContain('Sign in');
  });
});
