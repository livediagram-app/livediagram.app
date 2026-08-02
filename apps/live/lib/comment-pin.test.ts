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

  it('starts square, aspect-locked and unlabelled', () => {
    const p = pin();
    expect(p.width).toBe(p.height);
    // A stretched pin reads as a shape somebody drew, not a marker.
    expect(p.aspectLocked).toBe(true);
    // The pin shows its count; a caption under a 40px marker would be bigger
    // than the marker.
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

  it('paints itself, so no wrapper box frames the bubble', () => {
    expect(SELF_PAINTING_SHAPES.has('comment-pin')).toBe(true);
  });

  it('is a remark, not a vote candidate', () => {
    expect(isVotable(pin())).toBe(false);
  });
});
