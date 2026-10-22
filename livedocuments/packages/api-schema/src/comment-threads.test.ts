import { describe, expect, it } from 'vitest';
import { COMMENT_LIST_STATUSES, isCommentListStatus } from './comment-threads';

describe('comment list statuses', () => {
  it('are open, resolved and all', () => {
    expect(COMMENT_LIST_STATUSES).toEqual(['open', 'resolved', 'all']);
    expect(['open', 'all', 'closed', undefined].map(isCommentListStatus)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
