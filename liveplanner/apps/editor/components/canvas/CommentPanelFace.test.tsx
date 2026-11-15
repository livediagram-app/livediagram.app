// @vitest-environment jsdom

// A stored Comment panel (docs/specs/012-collaboration/comment-pin.md, retired; docs/specs/026-plan/plan-mode.md "No
// comment thread on any canvas element", Work Tracker 751): it shows the thread it carries, for every role, and
// offers nothing to add to it.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type Comment, type ShapeElement } from '@liveplanner/project';

import { CommentPanelFace } from './CommentPanelFace';

afterEach(cleanup);

const comment = (id: string, authorId: string, text: string): Comment => ({
  id,
  text,
  createdAt: 1,
  authorName: authorId === 'me' ? 'Me' : 'Ana',
  authorColor: '#123456',
  authorId,
});

const panel = (thread?: ShapeElement['commentThread']): ShapeElement => ({
  ...createShape('comment-pin', 0, 0),
  ...(thread ? { commentThread: thread } : {}),
});

const draw = (el: ShapeElement, label = '') =>
  render(
    <CommentPanelFace element={el} label={label} textColor="#0f172a" surface="#fff" selfId="me" />,
  );

describe('a stored Comment panel', () => {
  it('reads its thread, with no composer, Resolve chip or delete', () => {
    draw(
      panel({
        resolved: false,
        comments: [comment('c1', 'ana', 'Why here?'), comment('c2', 'me', 'Because')],
      }),
      'Checkout',
    );
    expect(screen.getByText('Checkout')).toBeTruthy();
    expect(screen.getByText('Why here?')).toBeTruthy();
    expect(screen.getByText('Because')).toBeTruthy();
    // My own comments still read as mine.
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a resolved thread as resolved, with no Reopen', () => {
    draw(panel({ resolved: true, comments: [comment('c1', 'ana', 'Done')] }));
    expect(screen.getByText('Resolved')).toBeTruthy();
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(screen.queryByText('Reopen Thread')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says it has no comments, and invites none, when its thread is empty', () => {
    draw(panel());
    expect(screen.getByText('No Comments Yet')).toBeTruthy();
    expect(screen.queryByText('Start the Conversation')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
