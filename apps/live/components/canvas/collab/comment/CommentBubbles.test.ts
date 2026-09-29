import { describe, expect, it } from 'vitest';
import type { Comment } from '@livediagram/document';
import { groupByAuthor } from './CommentBubbles';

// Consecutive comments by one author read as one voice (docs/specs/012-collaboration/comment-pin.md "The look").

const c = (id: string, authorName: string, authorId?: string): Comment => ({
  id,
  text: id,
  createdAt: 1,
  authorName,
  authorColor: '#000',
  authorId,
});

describe('groupByAuthor', () => {
  it('groups runs by author id, and starts a new group when the author changes', () => {
    const groups = groupByAuthor([
      c('1', 'Tom', 't'),
      c('2', 'Tom', 't'),
      c('3', 'Sam', 's'),
      c('4', 'Tom', 't'),
    ]);
    expect(groups.map((g) => g.map((x) => x.id))).toEqual([['1', '2'], ['3'], ['4']]);
  });

  it('falls back to the name when an author id is missing (a redacted or older comment)', () => {
    const groups = groupByAuthor([c('1', 'Tom'), c('2', 'Tom'), c('3', 'Priya')]);
    expect(groups.map((g) => g.length)).toEqual([2, 1]);
  });
});
