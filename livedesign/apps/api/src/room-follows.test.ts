import { describe, expect, it } from 'vitest';
import { followerIdsOf, followTargetOf, MAX_FOLLOW_TARGET_LEN } from './room-follows';

// docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"
describe('followTargetOf', () => {
  it('takes a presence id, and reads anything else, or yourself, as stopping', () => {
    expect(followTargetOf({ target: 'p-b' }, 'p-a')).toBe('p-b');
    expect(followTargetOf({ target: null }, 'p-a')).toBeNull();
    expect(followTargetOf({ target: 'p-a' }, 'p-a')).toBeNull();
    expect(followTargetOf({ target: 7 }, 'p-a')).toBeNull();
    expect(followTargetOf({ target: 'x'.repeat(MAX_FOLLOW_TARGET_LEN + 1) }, 'p-a')).toBeNull();
    expect(followTargetOf(null, 'p-a')).toBeNull();
  });
});

describe('followerIdsOf', () => {
  it('lists who follows a person, sorted, skipping sessions before hello', () => {
    const sessions = [
      { presenceId: 'p-c', following: 'p-a' },
      { presenceId: 'p-b', following: 'p-a' },
      { presenceId: 'p-d', following: 'p-b' },
      { presenceId: undefined, following: 'p-a' },
      { presenceId: 'p-e' },
    ];
    expect(followerIdsOf(sessions, 'p-a')).toEqual(['p-b', 'p-c']);
    expect(followerIdsOf(sessions, 'p-e')).toEqual([]);
  });
});
