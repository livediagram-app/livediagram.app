import { describe, expect, it } from 'vitest';
import { ITEM_COMMENTS_MAX, type Item, type ItemPerson } from '@livediagram/items';
import { threadResolved, threadWithComment, threadWithoutComment } from './comment-thread';
import type { Comment, CommentThread } from './comments';
import {
  applyItemComment,
  itemForRoom,
  itemForViewer,
  itemThread,
  keepOwnCommentAuthors,
  readRestoredThread,
} from './item-comments';

// docs/specs/026-plan/items.md "Comments": a card's thread, the canvas's comment model on an item.
const SAM: ItemPerson = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ctx = { now: 50, by: SAM };

const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `text ${id}`,
  createdAt: 1,
  authorName: 'Sam',
  authorColor: '#2563eb',
  ...extra,
});

function card(thread?: CommentThread): Item {
  return {
    id: 'item0001',
    type: 'task',
    key: 1,
    rank: 'i',
    fields: thread ? { title: 'A', comments: thread as never } : { title: 'A' },
    rev: 3,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
    updatedBy: SAM,
  };
}

describe('the thread ops', () => {
  it('append, reopening a resolved thread, and never twice', () => {
    const t = threadWithComment(undefined, comment('a'), 10)!;
    expect(t).toEqual({ comments: [comment('a')], resolved: false });
    expect(threadWithComment(t, comment('a'), 10)).toBe(t);
    expect(threadWithComment({ ...t, resolved: true }, comment('b'), 10)!.resolved).toBe(false);
    expect(threadWithComment(t, comment('b'), 1)).toBe(t);
  });

  it('remove, the last comment taking the thread with it', () => {
    const t: CommentThread = { comments: [comment('a'), comment('b')], resolved: false };
    expect(threadWithoutComment(t, 'a')!.comments).toEqual([comment('b')]);
    expect(threadWithoutComment({ comments: [comment('a')], resolved: true }, 'a')).toBeUndefined();
    expect(threadWithoutComment(t, 'zz')).toBe(t);
    expect(threadWithoutComment(undefined, 'a')).toBeUndefined();
  });

  it('resolve and reopen, unchanged when already so', () => {
    const t: CommentThread = { comments: [comment('a')], resolved: false };
    expect(threadResolved(t, true)).toEqual({ ...t, resolved: true });
    expect(threadResolved(t, false)).toBe(t);
    expect(threadResolved(undefined, true)).toBeUndefined();
  });
});

describe('applyItemComment', () => {
  it('adds a comment as a change to the item', () => {
    const r = applyItemComment(card(), { kind: 'add', comment: comment('a') }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(itemThread(r.item)).toEqual({ comments: [comment('a')], resolved: false });
    expect(r.item.rev).toBe(4);
    expect(r.item.updatedAt).toBe(50);
    expect(r.item.updatedBy).toBe(SAM);
  });

  it('deletes, and the last delete drops the field', () => {
    const r = applyItemComment(
      card({ comments: [comment('a')], resolved: false }),
      { kind: 'remove', commentId: 'a' },
      ctx,
    );
    expect(r.ok && r.item.fields['comments']).toBe(undefined);
    expect(applyItemComment(card(), { kind: 'remove', commentId: 'a' }, ctx)).toEqual({
      ok: false,
      reason: 'comment_not_found',
    });
  });

  it('resolves and reopens, refusing a change that changes nothing', () => {
    const open = card({ comments: [comment('a')], resolved: false });
    const r = applyItemComment(open, { kind: 'resolve', resolved: true }, ctx);
    expect(r.ok && itemThread(r.item)!.resolved).toBe(true);
    expect(applyItemComment(open, { kind: 'resolve', resolved: false }, ctx)).toEqual({
      ok: false,
      reason: 'unchanged',
    });
  });

  it('refuses a comment past the count or the size budget', () => {
    const full = card({
      comments: Array.from({ length: ITEM_COMMENTS_MAX }, (_, i) => comment(`c${i}`)),
      resolved: false,
    });
    expect(applyItemComment(full, { kind: 'add', comment: comment('x') }, ctx)).toEqual({
      ok: false,
      reason: 'comments_full',
    });
    const heavy = card({
      comments: Array.from({ length: 70 }, (_, i) => comment(`h${i}`, { text: 'x'.repeat(1990) })),
      resolved: false,
    });
    expect(
      applyItemComment(
        heavy,
        { kind: 'add', comment: comment('y', { text: 'x'.repeat(1990) }) },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'comments_full' });
  });

  it('reads a malformed thread as none', () => {
    expect(itemThread({ fields: { comments: 'junk' } })).toBeUndefined();
    expect(itemThread({ fields: { comments: { comments: [{ id: 1 }], resolved: false } } })).toBe(
      undefined,
    );
  });
});

describe('author ids', () => {
  const thread: CommentThread = {
    comments: [
      comment('mine', { authorId: 'owner-me', tokenId: 'tok' }),
      comment('theirs', { authorId: 'owner-them' }),
      comment('old'),
    ],
    resolved: false,
  };

  it('reach a viewer on their own comments only', () => {
    const seen = itemThread(itemForViewer(card(thread), 'owner-me'))!.comments;
    expect(seen[0]).toMatchObject({ authorId: 'owner-me', tokenId: 'tok' });
    expect(seen[1]!.authorId).toBeUndefined();
    expect(seen[2]).toEqual(comment('old'));
    const anon = itemThread(itemForViewer(card(thread), null))!.comments;
    expect(anon.every((c) => c.authorId === undefined && c.tokenId === undefined)).toBe(true);
    const plain = card({ comments: [comment('old')], resolved: false });
    expect(itemForViewer(plain, 'owner-me')).toBe(plain);
    expect(itemForViewer(card(), 'owner-me').fields['comments']).toBeUndefined();
  });

  it('never reach the room', () => {
    const room = itemThread(itemForRoom(card(thread)))!.comments;
    expect(room.every((c) => c.authorId === undefined && c.tokenId === undefined)).toBe(true);
  });

  it('survive the room copy landing over the answer', () => {
    const local = itemForViewer(card(thread), 'owner-me');
    const incoming = itemForRoom({ ...card(thread), rev: 9 });
    const merged = keepOwnCommentAuthors(local, incoming);
    expect(itemThread(merged)!.comments[0]!.authorId).toBe('owner-me');
    expect(itemThread(merged)!.comments[1]!.authorId).toBeUndefined();
    expect(merged.rev).toBe(9);
    expect(keepOwnCommentAuthors(undefined, incoming)).toBe(incoming);
    expect(keepOwnCommentAuthors(card(), incoming)).toBe(incoming);
  });

  it('on a restore, keep only the restorer’s own and drop token ids', () => {
    const read = readRestoredThread(
      {
        resolved: true,
        comments: [
          comment('a', { authorId: 'owner-me', tokenId: 't', mentions: [{ junk: true }] as never }),
          comment('b', { authorId: 'owner-them' }),
        ],
      },
      'owner-me',
    )!;
    expect(read.resolved).toBe(true);
    expect(read.comments[0]).toEqual({ ...comment('a'), authorId: 'owner-me' });
    expect(read.comments[1]).toEqual(comment('b'));
    expect(readRestoredThread({ comments: 'no', resolved: false }, 'owner-me')).toBeNull();
    expect(readRestoredThread(null, 'owner-me')).toBeNull();
  });
});
