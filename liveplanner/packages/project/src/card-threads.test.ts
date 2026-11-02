import { describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import {
  CARD_THREADS_MAX,
  THREAD_BYTES,
  THREAD_CARDS_MAX,
  THREAD_COMMENTS_MAX,
  THREAD_TITLE_MAX,
  applyThreadChange,
  autoThreadTitle,
  fieldCountKey,
  isCardThread,
  isThreadFieldId,
  isThreadId,
  keepOwnThreadAuthors,
  legacyThreadOf,
  newThreadId,
  openCommentCount,
  openCommentCounts,
  readRestoredThread,
  readThreadTitle,
  sortedThreads,
  startThread,
  threadForRoom,
  threadForViewer,
  threadOnlyBy,
  threadParticipants,
  threadTitle,
  threadsOnCard,
  withoutLegacyThread,
  type CardThread,
} from './card-threads';
import type { Comment } from './comments';

// A card's comment threads (docs/specs/026-plan/items.md "Comments"): the shape, titles, writes, counts,
// redaction and the move from a card's old single thread.

const comment = (id: string, over: Partial<Comment> = {}): Comment => ({
  id,
  text: `Comment ${id}`,
  createdAt: 100,
  authorName: 'Ada',
  authorColor: '#2563eb',
  authorId: 'owner-ada',
  ...over,
});

const thread = (over: Partial<CardThread> = {}): CardThread =>
  startThread({
    id: 'th-aaaaaaaaaaaaaaaa',
    home: 'p1',
    card: { projectId: 'p1', itemId: 'i1', key: 1 },
    comment: comment('c1', { text: 'Basket empties after switching restaurants' }),
    now: 100,
    ...over,
  });

describe('titles', () => {
  it('names the starter and the opening of the first comment', () => {
    expect(autoThreadTitle('Gentle Falcon', 'Basket empties after switching restaurants')).toBe(
      'Gentle Falcon: Basket empties after switching restaurants',
    );
  });

  it('cuts a long opening at a word, with an ellipsis, from the first non-blank line', () => {
    const t = autoThreadTitle(
      'Ada',
      '\n  The basket empties every single time someone switches between two restaurants quickly\nsecond line',
    );
    expect(t).toBe('Ada: The basket empties every single time someone switches…');
    expect(t.length).toBeLessThanOrEqual(THREAD_TITLE_MAX);
  });

  it('cuts one very long word where it is, and keeps the whole title to its cap', () => {
    expect(autoThreadTitle('Ada', 'x'.repeat(200))).toBe(`Ada: ${'x'.repeat(60)}…`);
    expect(autoThreadTitle('N'.repeat(200), 'hi').length).toBe(THREAD_TITLE_MAX);
  });

  it('falls back to Someone, and to the name alone for empty text', () => {
    expect(autoThreadTitle('  ', 'Hi')).toBe('Someone: Hi');
    expect(autoThreadTitle('Ada', '   ')).toBe('Ada');
  });

  it('works out a moved thread’s title, and keeps a written one', () => {
    expect(threadTitle({ ...thread(), title: '' })).toBe(
      'Ada: Basket empties after switching restaurants',
    );
    expect(threadTitle({ ...thread(), title: 'Basket bug' })).toBe('Basket bug');
  });

  it('reads a rename: trimmed onto one line, empty for automatic, null past the cap or not text', () => {
    expect(readThreadTitle('  Basket\n bug ')).toBe('Basket bug');
    expect(readThreadTitle('')).toBe('');
    expect(readThreadTitle('x'.repeat(THREAD_TITLE_MAX + 1))).toBeNull();
    expect(readThreadTitle(7)).toBeNull();
  });
});

describe('ids and shape', () => {
  it('makes ids unique across plans in one recognisable form', () => {
    const id = newThreadId(() => 0.5);
    expect(id).toMatch(/^th-[a-z0-9]{16}$/);
    expect(isThreadId(id)).toBe(true);
    expect(isThreadId(newThreadId())).toBe(true);
    expect(isThreadId('c-abc')).toBe(true);
    expect(isThreadId('nope')).toBe(false);
    expect(isThreadId(3)).toBe(false);
  });

  it('starts a thread with its first comment, its title and its card', () => {
    const t = thread();
    expect(t.title).toBe('Ada: Basket empties after switching restaurants');
    expect(t.createdBy).toEqual({ name: 'Ada', color: '#2563eb', authorId: 'owner-ada' });
    expect(t.cards).toEqual([{ projectId: 'p1', itemId: 'i1', key: 1 }]);
    expect(t).toMatchObject({ resolved: false, rev: 1, createdAt: 100, updatedAt: 100 });
    expect(thread({ title: 'Given' }).title).toBe('Given');
    const anon = startThread({
      id: 'th-bbbbbbbbbbbbbbbb',
      home: 'p1',
      card: { projectId: 'p1', itemId: 'i1', key: 1 },
      comment: comment('c1', { authorId: undefined }),
      now: 1,
    });
    expect(anon.createdBy).toEqual({ name: 'Ada', color: '#2563eb' });
  });

  it('checks a stored thread', () => {
    expect(isCardThread(thread())).toBe(true);
    expect(isCardThread(null)).toBe(false);
    expect(isCardThread([])).toBe(false);
    expect(isCardThread({ ...thread(), comments: [] })).toBe(false);
    expect(isCardThread({ ...thread(), id: 'x' })).toBe(false);
    expect(isCardThread({ ...thread(), title: 'x'.repeat(THREAD_TITLE_MAX + 1) })).toBe(false);
    expect(isCardThread({ ...thread(), cards: [{ projectId: 'p1' }] })).toBe(false);
    expect(isCardThread({ ...thread(), cards: [null] })).toBe(false);
    expect(isCardThread({ ...thread(), createdBy: undefined })).toBe(false);
    const many = Array.from({ length: THREAD_CARDS_MAX + 1 }, (_, i) => ({
      projectId: 'p1',
      itemId: `i${i}`,
      key: i,
    }));
    expect(isCardThread({ ...thread(), cards: many })).toBe(false);
    expect(
      isCardThread({
        ...thread(),
        cards: [{ projectId: 'p2', itemId: 'i9', key: null, projectName: 'Other' }],
      }),
    ).toBe(true);
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields".
  it('starts a thread in a Comments field, storing none for the built-in', () => {
    expect(thread({ field: 'f-review' }).field).toBe('f-review');
    expect(thread({ field: 'comments' })).not.toHaveProperty('field');
    expect(thread()).not.toHaveProperty('field');
  });

  it('keeps a stored thread’s field only when it can name a Comments field', () => {
    expect(isThreadFieldId('comments')).toBe(true);
    expect(isThreadFieldId('f-review')).toBe(true);
    expect(isThreadFieldId('title')).toBe(false);
    expect(isThreadFieldId('f-')).toBe(false);
    expect(isThreadFieldId(7)).toBe(false);
    expect(isCardThread({ ...thread(), field: 'f-review' })).toBe(true);
    expect(isCardThread({ ...thread(), field: 'Design Review' })).toBe(false);
    expect(isCardThread({ ...thread(), field: null })).toBe(false);
  });
});

describe('writes', () => {
  it('adds a reply, reopening a resolved thread, and raises rev and activity', () => {
    const resolved = applyThreadChange(
      thread(),
      { kind: 'resolve', resolved: true, by: 'Bo' },
      150,
    );
    const r = applyThreadChange(
      resolved.ok ? resolved.thread! : thread(),
      { kind: 'add', comment: comment('c2') },
      200,
    );
    expect(r.ok && r.thread).toMatchObject({ resolved: false, rev: 3, updatedAt: 200 });
    expect(r.ok && r.thread?.resolvedBy).toBeUndefined();
    expect(r.ok && r.thread?.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('refuses a comment already there, a full thread and one too large', () => {
    expect(applyThreadChange(thread(), { kind: 'add', comment: comment('c1') }, 1)).toEqual({
      ok: false,
      reason: 'unchanged',
    });
    const full = {
      ...thread(),
      comments: Array.from({ length: THREAD_COMMENTS_MAX }, (_, i) => comment(`c${i}`)),
    };
    expect(applyThreadChange(full, { kind: 'add', comment: comment('new') }, 1)).toEqual({
      ok: false,
      reason: 'comments_full',
    });
    const big = { ...thread(), comments: [comment('c1', { text: 'x'.repeat(THREAD_BYTES) })] };
    expect(applyThreadChange(big, { kind: 'add', comment: comment('c2') }, 1)).toEqual({
      ok: false,
      reason: 'comments_full',
    });
  });

  it('edits a comment’s text and mentions, marking it edited', () => {
    const mention = { handle: 'bo', name: 'Bo', userId: 'u-bo' };
    const r = applyThreadChange(
      thread(),
      { kind: 'edit', commentId: 'c1', text: 'Fixed text', mentions: [mention] },
      300,
    );
    expect(r.ok && r.thread?.comments[0]).toMatchObject({
      text: 'Fixed text',
      editedAt: 300,
      mentions: [mention],
    });
    // Editing away the mentions takes them off.
    const back = applyThreadChange(
      r.ok ? r.thread! : thread(),
      { kind: 'edit', commentId: 'c1', text: 'Fixed text' },
      301,
    );
    expect(back.ok && back.thread?.comments[0]?.mentions).toBeUndefined();
  });

  it('refuses an edit that changes nothing, a missing comment, and one too large', () => {
    const t = thread();
    expect(
      applyThreadChange(t, { kind: 'edit', commentId: 'c1', text: t.comments[0]!.text }, 1),
    ).toEqual({ ok: false, reason: 'unchanged' });
    expect(applyThreadChange(t, { kind: 'edit', commentId: 'zz', text: 'x' }, 1)).toEqual({
      ok: false,
      reason: 'comment_not_found',
    });
    expect(
      applyThreadChange(t, { kind: 'edit', commentId: 'c1', text: 'x'.repeat(THREAD_BYTES) }, 1),
    ).toEqual({ ok: false, reason: 'comments_full' });
  });

  it('removes a comment, and the last one takes the thread', () => {
    const two = applyThreadChange(thread(), { kind: 'add', comment: comment('c2') }, 2);
    const one = applyThreadChange(
      two.ok ? two.thread! : thread(),
      { kind: 'remove', commentId: 'c1' },
      3,
    );
    expect(one.ok && one.thread?.comments.map((c) => c.id)).toEqual(['c2']);
    expect(applyThreadChange(thread(), { kind: 'remove', commentId: 'c1' }, 3)).toEqual({
      ok: true,
      thread: null,
    });
    expect(applyThreadChange(thread(), { kind: 'remove', commentId: 'zz' }, 3)).toEqual({
      ok: false,
      reason: 'comment_not_found',
    });
  });

  it('resolves with who and when, reopens, and changes nothing when already so', () => {
    const r = applyThreadChange(thread(), { kind: 'resolve', resolved: true, by: 'Bo' }, 9);
    expect(r.ok && r.thread).toMatchObject({ resolved: true, resolvedBy: 'Bo', resolvedAt: 9 });
    const o = applyThreadChange(
      r.ok ? r.thread! : thread(),
      { kind: 'resolve', resolved: false, by: 'Bo' },
      10,
    );
    expect(o.ok && o.thread).toMatchObject({ resolved: false, resolvedBy: undefined });
    expect(applyThreadChange(thread(), { kind: 'resolve', resolved: false, by: 'Bo' }, 1)).toEqual({
      ok: false,
      reason: 'unchanged',
    });
  });

  it('renames, goes back to the automatic title when cleared, and refuses too long', () => {
    const r = applyThreadChange(thread(), { kind: 'rename', title: 'Basket bug' }, 5);
    expect(r.ok && r.thread?.title).toBe('Basket bug');
    const back = applyThreadChange(r.ok ? r.thread! : thread(), { kind: 'rename', title: '' }, 6);
    expect(back.ok && back.thread?.title).toBe('Ada: Basket empties after switching restaurants');
    expect(
      applyThreadChange(
        thread(),
        { kind: 'rename', title: 'Ada: Basket empties after switching restaurants' },
        1,
      ),
    ).toEqual({ ok: false, reason: 'unchanged' });
    expect(
      applyThreadChange(thread(), { kind: 'rename', title: 'x'.repeat(THREAD_TITLE_MAX + 1) }, 1),
    ).toEqual({ ok: false, reason: 'title_too_long' });
  });

  it('adds cards without moving its activity, refusing one it is on and past the cap', () => {
    const card = { projectId: 'p2', itemId: 'i9', key: 4, projectName: 'Sprint 12' };
    const r = applyThreadChange(thread(), { kind: 'addCard', card }, 999);
    expect(r.ok && r.thread?.cards).toHaveLength(2);
    expect(r.ok && r.thread?.updatedAt).toBe(100);
    expect(
      applyThreadChange(
        thread(),
        { kind: 'addCard', card: { projectId: 'p1', itemId: 'i1', key: 1 } },
        1,
      ),
    ).toEqual({ ok: false, reason: 'thread_on_card' });
    const full = {
      ...thread(),
      cards: Array.from({ length: THREAD_CARDS_MAX }, (_, i) => ({
        projectId: 'p1',
        itemId: `x${i}`,
        key: i,
      })),
    };
    expect(applyThreadChange(full, { kind: 'addCard', card }, 1)).toEqual({
      ok: false,
      reason: 'thread_cards_full',
    });
  });

  it('removes a card, and the last card takes the thread', () => {
    const two = applyThreadChange(
      thread(),
      { kind: 'addCard', card: { projectId: 'p2', itemId: 'i9', key: 4 } },
      1,
    );
    const one = applyThreadChange(
      two.ok ? two.thread! : thread(),
      { kind: 'removeCard', projectId: 'p1', itemId: 'i1' },
      2,
    );
    expect(one.ok && one.thread?.cards).toEqual([{ projectId: 'p2', itemId: 'i9', key: 4 }]);
    expect(
      applyThreadChange(thread(), { kind: 'removeCard', projectId: 'p1', itemId: 'i1' }, 2),
    ).toEqual({ ok: true, thread: null });
    expect(
      applyThreadChange(thread(), { kind: 'removeCard', projectId: 'p1', itemId: 'zz' }, 2),
    ).toEqual({ ok: false, reason: 'unchanged' });
  });

  // docs/specs/012-collaboration/comment-reactions.md "On a card's comment threads".
  describe('react', () => {
    const react = (by: string, on = true, commentId = 'c1') =>
      ({ kind: 'react', commentId, emoji: 'eyes', by, name: by.toUpperCase(), on }) as const;

    it('turns a reaction on and off, raising rev but not activity', () => {
      const t = thread();
      const on = applyThreadChange(t, react('k-bo'), 500);
      expect(on.ok && on.thread?.comments[0]?.reactions).toEqual([
        { emoji: 'eyes', by: 'k-bo', name: 'K-BO' },
      ]);
      expect(on.ok && on.thread).toMatchObject({ rev: t.rev + 1, updatedAt: t.updatedAt });
      expect(isCardThread(on.ok ? on.thread : null)).toBe(true);
      const off = applyThreadChange(on.ok ? on.thread! : t, react('k-bo', false), 600);
      expect(off.ok && off.thread?.comments[0]).toEqual(t.comments[0]);
      expect(off.ok && off.thread).toMatchObject({ rev: t.rev + 2, updatedAt: t.updatedAt });
    });

    it('changes nothing when already so, and refuses a missing comment', () => {
      const t = thread();
      expect(applyThreadChange(t, react('k-bo', false), 1)).toEqual({
        ok: false,
        reason: 'unchanged',
      });
      const on = applyThreadChange(t, react('k-bo'), 1);
      expect(applyThreadChange(on.ok ? on.thread! : t, react('k-bo'), 2)).toEqual({
        ok: false,
        reason: 'unchanged',
      });
      expect(applyThreadChange(t, react('k-bo', true, 'zz'), 1)).toEqual({
        ok: false,
        reason: 'comment_not_found',
      });
    });

    it('refuses one past the byte budget, but still takes one back', () => {
      const big = {
        ...thread(),
        comments: [
          comment('c1', {
            text: 'x'.repeat(THREAD_BYTES - 400),
            reactions: [{ emoji: 'eyes', by: 'k-bo', name: 'Bo' }],
          }),
        ],
      };
      expect(applyThreadChange(big, react('k-' + 'y'.repeat(190)), 1)).toEqual({
        ok: false,
        reason: 'comments_full',
      });
      const off = applyThreadChange(big, { ...react('k-bo', false), name: 'Bo' }, 1);
      expect(off.ok && off.thread?.comments[0]?.reactions).toBeUndefined();
    });
  });
});

describe('reads', () => {
  const a = thread();
  const b = {
    ...thread({ id: 'th-bbbbbbbbbbbbbbbb' }),
    comments: [comment('x'), comment('y')],
    cards: [
      { projectId: 'p1', itemId: 'i1', key: 1 },
      { projectId: 'p1', itemId: 'i2', key: 2 },
    ],
  };
  const resolved = { ...thread({ id: 'th-cccccccccccccccc' }), resolved: true };

  it('finds a card’s threads and counts the comments in its open ones', () => {
    expect(threadsOnCard([a, b, resolved], 'p1', 'i2')).toEqual([b]);
    expect(openCommentCount([a, b, resolved], 'p1', 'i1')).toBe(3);
    expect(openCommentCount([a, b], 'p2', 'i1')).toBe(0);
    expect(openCommentCounts([a, b, resolved], 'p1')).toEqual(
      new Map([
        ['i1', 3],
        ['i2', 2],
      ]),
    );
    expect(openCommentCounts([a], 'p9').size).toBe(0);
  });

  it('counts each card’s comments in each Comments field a thread names, beside the whole', () => {
    const review = { ...thread({ id: 'th-dddddddddddddddd', field: 'f-review' }) };
    const shut = { ...review, id: 'th-eeeeeeeeeeeeeeee', resolved: true };
    expect(openCommentCounts([a, b, review, shut], 'p1')).toEqual(
      new Map([
        ['i1', 4],
        ['i2', 2],
        [fieldCountKey('i1', 'f-review'), 1],
      ]),
    );
  });

  it('sorts open threads first by activity, then resolved ones by when', () => {
    const old = { ...a, id: 'old', updatedAt: 1 };
    const fresh = { ...a, id: 'fresh', updatedAt: 9 };
    const r1 = { ...resolved, id: 'r1', resolvedAt: 5 };
    const r2 = { ...resolved, id: 'r2', resolvedAt: undefined, updatedAt: 7 };
    expect(sortedThreads([r1, old, r2, fresh]).map((t) => t.id)).toEqual([
      'fresh',
      'old',
      'r2',
      'r1',
    ]);
  });

  it('lists everyone in a thread once, in the order they first wrote', () => {
    const t = {
      ...a,
      comments: [
        comment('1'),
        comment('2', { authorName: 'Bo', authorColor: '#16a34a' }),
        comment('3'),
      ],
    };
    expect(threadParticipants(t)).toEqual([
      { name: 'Ada', color: '#2563eb' },
      { name: 'Bo', color: '#16a34a' },
    ]);
  });

  it('caps a card at fifty threads (a constant the routes refuse by)', () => {
    expect(CARD_THREADS_MAX).toBe(50);
  });
});

describe('redaction', () => {
  const t: CardThread = {
    ...thread(),
    comments: [
      comment('c1', { tokenId: 'tok' }),
      comment('c2', { authorId: 'owner-bo', authorName: 'Bo', ai: true }),
      comment('c3', { authorId: undefined }),
    ],
  };

  it('keeps author ids on the viewer’s own comments and starter mark only', () => {
    const seen = threadForViewer(t, 'owner-bo');
    expect(seen.comments.map((c) => c.authorId)).toEqual([undefined, 'owner-bo', undefined]);
    expect(seen.comments[0]?.tokenId).toBeUndefined();
    expect(seen.comments[1]?.ai).toBe(true);
    expect(seen.createdBy.authorId).toBeUndefined();
    const own = threadForViewer(t, 'owner-ada');
    expect(own.createdBy.authorId).toBe('owner-ada');
    expect(own.comments[0]).toEqual(t.comments[0]);
  });

  it('strips every id for the room, and hands back the same thread when there is none', () => {
    const room = threadForRoom(t);
    expect(room.comments.every((c) => c.authorId === undefined && c.tokenId === undefined)).toBe(
      true,
    );
    expect(room.createdBy.authorId).toBeUndefined();
    const bare = threadForRoom(room);
    expect(bare).toBe(room);
  });

  it('folds our own author ids back onto the room’s copy', () => {
    const room = threadForRoom(t);
    const kept = keepOwnThreadAuthors(t, room);
    expect(kept.comments.map((c) => c.authorId)).toEqual(['owner-ada', 'owner-bo', undefined]);
    expect(kept.createdBy.authorId).toBe('owner-ada');
    expect(keepOwnThreadAuthors(undefined, room)).toBe(room);
    const none = threadForRoom(t);
    expect(keepOwnThreadAuthors(none, none)).toBe(none);
  });

  it('reads a restored thread, keeping the restorer’s own ids only and cleaning mentions', () => {
    const raw = {
      ...t,
      comments: [
        ...t.comments,
        comment('c4', {
          mentions: [{ handle: 'bo', name: 'Bo', userId: 'u-bo', junk: 1 } as never],
        }),
      ],
    };
    const r = readRestoredThread(raw, 'owner-ada');
    expect(r?.comments.map((c) => c.authorId)).toEqual([
      'owner-ada',
      undefined,
      undefined,
      'owner-ada',
    ]);
    expect(r?.comments[0]?.tokenId).toBeUndefined();
    expect(r?.comments[3]?.mentions).toEqual([{ handle: 'bo', name: 'Bo', userId: 'u-bo' }]);
    expect(r?.createdBy.authorId).toBe('owner-ada');
    expect(readRestoredThread(raw, 'owner-bo')?.createdBy.authorId).toBeUndefined();
    expect(readRestoredThread({ nope: true }, 'owner-ada')).toBeNull();
  });
});

describe('the old single thread', () => {
  const item = (fields: Item['fields']) =>
    ({ id: 'i1', key: 7, fields, updatedAt: 5 }) as Pick<
      Item,
      'id' | 'key' | 'fields' | 'updatedAt'
    >;

  it('becomes the card’s first thread, keeping its comments and resolved state', () => {
    const old = {
      comments: [comment('c1', { createdAt: 10 }), comment('c2', { createdAt: 20 })],
      resolved: true,
    };
    const t = legacyThreadOf(item({ title: 'A', comments: old }), 'p1');
    expect(t).toMatchObject({
      id: 'c-i1',
      title: '',
      resolved: true,
      resolvedAt: 20,
      createdAt: 10,
      updatedAt: 20,
      home: 'p1',
      cards: [{ projectId: 'p1', itemId: 'i1', key: 7 }],
      createdBy: { name: 'Ada', color: '#2563eb', authorId: 'owner-ada' },
    });
    expect(isCardThread(t)).toBe(true);
    expect(threadTitle(t!)).toBe('Ada: Comment c1');
  });

  it('reads an open old thread, one without author ids, and nothing from none or an empty one', () => {
    const open = legacyThreadOf(
      item({ comments: { comments: [comment('c1', { authorId: undefined })], resolved: false } }),
      'p1',
    );
    expect(open?.resolved).toBe(false);
    expect(open?.resolvedAt).toBeUndefined();
    expect(open?.createdBy.authorId).toBeUndefined();
    expect(legacyThreadOf(item({}), 'p1')).toBeNull();
    expect(legacyThreadOf(item({ comments: { comments: [], resolved: false } }), 'p1')).toBeNull();
    expect(legacyThreadOf(item({ comments: 'x' }), 'p1')).toBeNull();
    expect(legacyThreadOf(item({ comments: [] as never }), 'p1')).toBeNull();
  });

  it('drops the old field from the item', () => {
    const it = item({ title: 'A', comments: { comments: [], resolved: false } });
    expect(withoutLegacyThread(it).fields).toEqual({ title: 'A' });
    const bare = item({ title: 'A' });
    expect(withoutLegacyThread(bare)).toBe(bare);
  });
});

// items.md "Deleting a thread": only a thread every comment in which is the person's own.
describe('threadOnlyBy', () => {
  it('is true only when every comment is theirs, an agent’s for them among them', () => {
    const t = thread();
    expect(threadOnlyBy(t, 'owner-ada')).toBe(true);
    const withAgent = { ...t, comments: [...t.comments, comment('c2', { ai: true })] };
    expect(threadOnlyBy(withAgent, 'owner-ada')).toBe(true);
    const withOther = { ...t, comments: [...t.comments, comment('c3', { authorId: 'owner-bo' })] };
    expect(threadOnlyBy(withOther, 'owner-ada')).toBe(false);
    // A viewer's copy withholds others' ids: such a comment reads as someone else's.
    expect(threadOnlyBy(threadForViewer(withOther, 'owner-bo'), 'owner-bo')).toBe(false);
    expect(threadOnlyBy(t, null)).toBe(false);
  });
});
