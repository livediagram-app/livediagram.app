// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@livediagram/items';
import { ItemComments } from './ItemComments';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';

// A card's comments (docs/specs/026-plan/items.md "Comments"): the canvas's thread parts in the item panel, who
// may do what, and the count on the card face.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const comment = (id: string, authorId?: string) => ({
  id,
  text: `said ${id}`,
  createdAt: Date.now(),
  authorName: 'Sam Reed',
  authorColor: '#2563eb',
  ...(authorId ? { authorId } : {}),
});
function card(comments?: { comments: unknown[]; resolved: boolean }): Item {
  return {
    id: 'item-one',
    type: 'task',
    key: 3,
    rank: 'i',
    fields: comments ? { title: 'A card', comments: comments as never } : { title: 'A card' },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: PERSON,
    updatedBy: PERSON,
  };
}

function show(item: Item, opts: { canEdit?: boolean; canComment?: boolean } = {}) {
  const onComment = vi.fn();
  render(
    <ItemComments
      item={item}
      canEdit={opts.canEdit ?? true}
      comments={{ canComment: opts.canComment ?? true, selfId: 'owner-me', onComment }}
    />,
  );
  return onComment;
}

describe('ItemComments', () => {
  it('starts empty with a composer, and sends a comment', () => {
    const onComment = show(card());
    expect(screen.getByText('No comments yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Add a comment' }), {
      target: { value: '  Ship it  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(onComment).toHaveBeenCalledWith({ kind: 'add', text: 'Ship it' });
  });

  it('resolves and reopens, hiding the composer while resolved', () => {
    const open = show(card({ comments: [comment('a')], resolved: false }));
    expect(screen.getByText('1 comment')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(open).toHaveBeenCalledWith({ kind: 'resolve', resolved: true });
    cleanup();
    const closed = show(card({ comments: [comment('a'), comment('b')], resolved: true }));
    expect(screen.getByText('2 comments')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resolved' }));
    expect(closed).toHaveBeenCalledWith({ kind: 'resolve', resolved: false });
  });

  it('lets an editor delete any comment, anyone else only their own', () => {
    const editor = show(card({ comments: [comment('a', 'owner-them')], resolved: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    expect(editor).toHaveBeenCalledWith({ kind: 'delete', commentId: 'a' });
    cleanup();
    show(card({ comments: [comment('a'), comment('b', 'owner-me')], resolved: false }), {
      canEdit: false,
    });
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(1);
  });

  it('offers no composer or resolve to someone who may not comment', () => {
    show(card({ comments: [comment('a')], resolved: false }), { canComment: false });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(screen.getByText('said a')).toBeTruthy();
  });
});

describe('the card face', () => {
  const face = (item: Item, size?: 'compact' | 'detailed') =>
    render(
      <PlanCardFace
        item={item}
        palette={planPalette('light', {})}
        fields={['comments']}
        size={size}
      />,
    );

  it('counts the comments of an open thread, on Detailed and Compact cards', () => {
    face(card({ comments: [comment('a'), comment('b')], resolved: false }));
    expect(screen.getByLabelText('2 comments')).toBeTruthy();
    cleanup();
    face(card({ comments: [comment('a')], resolved: false }), 'compact');
    expect(screen.getByLabelText('1 comment')).toBeTruthy();
  });

  it('draws nothing for no comments, or a resolved thread', () => {
    face(card({ comments: [comment('a')], resolved: true }));
    expect(screen.queryByLabelText(/comment/)).toBeNull();
    cleanup();
    face(card());
    expect(screen.queryByLabelText(/comment/)).toBeNull();
  });
});
