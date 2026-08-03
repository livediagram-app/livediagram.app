import { describe, expect, it } from 'vitest';

import {
  activeCommentCount,
  createComment,
  createShape,
  isVotable,
  SELF_PAINTING_SHAPES,
  SHAPE_KINDS,
  type ShapeElement,
} from '@livediagram/diagram';

// The comment pin (spec/136). The point of these is that the pin reuses the
// ORDINARY comment field rather than growing a parallel one, so most of what
// is worth pinning is "the existing helpers work on it unchanged".

const pin = () => createShape('comment-pin', 0, 0) as ShapeElement;

describe('comment pin', () => {
  it('is a registered shape kind', () => {
    expect(SHAPE_KINDS.has('comment-pin')).toBe(true);
  });

  it('starts open and unlabelled', () => {
    const p = pin();
    // A panel you add is a remark you are about to make, so it lands ready to
    // type into rather than folded away.
    expect(p.commentOpen).toBe(true);
    // The thread IS the content; a caption above it would be a title for a
    // conversation nobody has had yet.
    expect(p.label).toBe('');
  });

  it('carries an ordinary comment thread, counted by the ordinary helper', () => {
    const author = { id: 'u1', name: 'Sam', color: '#f00' };
    const withThread: ShapeElement = {
      ...pin(),
      commentThread: {
        comments: [createComment('Should login go here?', author)],
        resolved: false,
      },
    };
    // No bespoke counter: the same function every other element's badge uses.
    expect(activeCommentCount(withThread.commentThread)).toBe(1);
  });

  it('goes quiet when resolved rather than losing its comments', () => {
    const author = { id: 'u1', name: 'Sam', color: '#f00' };
    const thread = { comments: [createComment('done?', author)], resolved: true };
    // Resolved reports zero active, but the comment is still there to come
    // back on unresolve.
    expect(activeCommentCount(thread)).toBe(0);
    expect(thread.comments).toHaveLength(1);
  });

  it('takes the ordinary element box, because a panel is a card', () => {
    // It was self-painting when it was a 40px bubble; a panel wants the fill,
    // the border and the rounded corners every other card gets.
    expect(SELF_PAINTING_SHAPES.has('comment-pin')).toBe(false);
  });

  it('is a remark, not a vote candidate', () => {
    expect(isVotable(pin())).toBe(false);
  });
});
