import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Comment } from '@livedocuments/document';
import { CommentBubbles } from './CommentBubbles';

// docs/specs/012-collaboration/presentation-mode.md: comments at or past `freshFrom` arrived while the card was
// on screen and settle in (`collab-enter`). PR #1771 (Work Tracker 856) swapped the render-time counter for each comment's
// place in the thread; Work Tracker 893 pins the flag to the counter's values across author groups.

const c = (id: string, authorId: string): Comment => ({
  id,
  text: id,
  createdAt: 1,
  authorName: authorId,
  authorColor: '#000',
  authorId,
});

// Whether each bubble, in thread order, settles in.
function freshFlags(comments: Comment[], freshFrom: number): boolean[] {
  const markup = renderToStaticMarkup(
    <CommentBubbles comments={comments} selfId="t" textColor="#111" now={2} freshFrom={freshFrom} />,
  );
  return markup
    .split('class="group/bubble')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('"')).includes('collab-enter'));
}

describe('CommentBubbles fresh flag', () => {
  const thread = [c('1', 't'), c('2', 't'), c('3', 's'), c('4', 't'), c('5', 't')];

  it('settles in the comments at or past freshFrom, counted across author groups', () => {
    expect(freshFlags(thread, 3)).toEqual([false, false, false, true, true]);
    expect(freshFlags(thread, 2)).toEqual([false, false, true, true, true]);
  });

  it('settles in none when freshFrom is the thread length, and all when it is 0', () => {
    expect(freshFlags(thread, thread.length)).toEqual([false, false, false, false, false]);
    expect(freshFlags(thread, 0)).toEqual([true, true, true, true, true]);
  });
});
