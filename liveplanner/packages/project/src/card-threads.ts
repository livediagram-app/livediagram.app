// A card's comment threads (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Comments"): many
// conversations on a card, each stored once in its home plan and shown on every card it is on, in any plan. The
// pure core the api, the editor and This Browser plans all apply: the shape, the automatic title, the writes, the
// face count, author redaction and the move from the old single thread a card held in `fields.comments`. Who may
// do what is the caller's (the routes, the offline store); nothing here knows who is asking.

import { type Item } from '@liveplanner/items';
import { sanitizeMentions, type CommentMention } from '@liveworkspace/model-core/comment-mentions';
import { withoutCommentAuthorId, type Comment, type CommentThread } from './comments';
import {
  commentWithReactions,
  withReaction,
  type CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';
import { isComment } from './element-deltas';
import {
  type CardRef,
  type CardThread,
  THREAD_COMMENTS_MAX,
  THREAD_BYTES,
  THREAD_CARDS_MAX,
  THREAD_TITLE_MAX,
  LEGACY_THREAD_PREFIX,
  autoThreadTitle,
  isCardThread,
  threadBytes,
} from './card-thread-shape';
export * from './card-thread-shape';

// ---------- Writes -------------------------------------------------------------------------------------------

export type ThreadChange =
  | { kind: 'add'; comment: Comment }
  | { kind: 'edit'; commentId: string; text: string; mentions?: CommentMention[] }
  | { kind: 'remove'; commentId: string }
  | { kind: 'resolve'; resolved: boolean; by: string; byId?: string }
  | { kind: 'rename'; title: string }
  | { kind: 'addCard'; card: CardRef }
  | { kind: 'removeCard'; projectId: string; itemId: string }
  // One person's reaction on one comment, on or off (docs/specs/012-collaboration/comment-reactions.md): `by` is
  // their public collab key, `name` the name the server stamped, `person` their hashed person id where the server
  // stamped it (a This Browser plan's own change has none). Not activity: the thread keeps its place.
  | {
      kind: 'react';
      commentId: string;
      emoji: CommentReactionId;
      by: string;
      name: string;
      person?: string;
      on: boolean;
    };

export type ThreadRefusal =
  | 'unchanged'
  | 'comments_full'
  | 'comment_not_found'
  | 'title_too_long'
  | 'thread_on_card'
  | 'thread_cards_full';

// `thread: null`: the change took the thread's last comment, or its last card, so the thread goes.
export type ThreadResult =
  { ok: true; thread: CardThread | null } | { ok: false; reason: ThreadRefusal };

const sameCard = (c: CardRef, projectId: string, itemId: string) =>
  c.projectId === projectId && c.itemId === itemId;

/** One write applied to a thread as it stands: the new thread (rev raised), null when it goes, or why not. */
export function applyThreadChange(
  thread: CardThread,
  change: ThreadChange,
  now: number,
): ThreadResult {
  const next = (patch: Partial<CardThread>, activity = true): ThreadResult => ({
    ok: true,
    thread: {
      ...thread,
      ...patch,
      rev: thread.rev + 1,
      updatedAt: activity ? now : thread.updatedAt,
    },
  });
  switch (change.kind) {
    case 'add': {
      if (thread.comments.some((c) => c.id === change.comment.id))
        return { ok: false, reason: 'unchanged' };
      if (thread.comments.length >= THREAD_COMMENTS_MAX)
        return { ok: false, reason: 'comments_full' };
      const comments = [...thread.comments, change.comment];
      if (threadBytes(comments) > THREAD_BYTES) return { ok: false, reason: 'comments_full' };
      // A reply reopens a resolved thread, as on the canvas.
      return next({
        comments,
        resolved: false,
        resolvedBy: undefined,
        resolvedById: undefined,
        resolvedAt: undefined,
      });
    }
    case 'edit': {
      const at = thread.comments.findIndex((c) => c.id === change.commentId);
      if (at < 0) return { ok: false, reason: 'comment_not_found' };
      const before = thread.comments[at]!;
      const mentions = change.mentions?.length ? change.mentions : undefined;
      if (before.text === change.text && sameMentions(before.mentions, mentions))
        return { ok: false, reason: 'unchanged' };
      const { mentions: _old, ...rest } = before;
      const edited: Comment = {
        ...rest,
        text: change.text,
        editedAt: now,
        ...(mentions ? { mentions } : {}),
      };
      const comments = thread.comments.map((c, i) => (i === at ? edited : c));
      if (threadBytes(comments) > THREAD_BYTES) return { ok: false, reason: 'comments_full' };
      return next({ comments });
    }
    case 'remove': {
      if (!thread.comments.some((c) => c.id === change.commentId))
        return { ok: false, reason: 'comment_not_found' };
      const comments = thread.comments.filter((c) => c.id !== change.commentId);
      return comments.length ? next({ comments }) : { ok: true, thread: null };
    }
    case 'resolve': {
      if (thread.resolved === change.resolved) return { ok: false, reason: 'unchanged' };
      return change.resolved
        ? next({
            resolved: true,
            resolvedBy: change.by,
            resolvedById: change.byId,
            resolvedAt: now,
          })
        : next({
            resolved: false,
            resolvedBy: undefined,
            resolvedById: undefined,
            resolvedAt: undefined,
          });
    }
    case 'rename': {
      if (change.title.length > THREAD_TITLE_MAX) return { ok: false, reason: 'title_too_long' };
      // Cleared, it goes back to the automatic title, written down so it stays what it was when cleared.
      const title =
        change.title || autoThreadTitle(thread.createdBy.name, thread.comments[0]?.text ?? '');
      if (title === thread.title) return { ok: false, reason: 'unchanged' };
      return next({ title });
    }
    case 'addCard': {
      const { projectId, itemId } = change.card;
      if (thread.cards.some((c) => sameCard(c, projectId, itemId)))
        return { ok: false, reason: 'thread_on_card' };
      if (thread.cards.length >= THREAD_CARDS_MAX)
        return { ok: false, reason: 'thread_cards_full' };
      return next({ cards: [...thread.cards, change.card] }, false);
    }
    case 'react': {
      const at = thread.comments.findIndex((c) => c.id === change.commentId);
      if (at < 0) return { ok: false, reason: 'comment_not_found' };
      const before = thread.comments[at]!;
      const after = commentWithReactions(before, withReaction(before.reactions, change));
      if (after === before) return { ok: false, reason: 'unchanged' };
      const comments = thread.comments.map((c, i) => (i === at ? after : c));
      // Taking one back always fits; adding one keeps to the thread's budget.
      if (change.on && threadBytes(comments) > THREAD_BYTES)
        return { ok: false, reason: 'comments_full' };
      return next({ comments }, false);
    }
    case 'removeCard': {
      if (!thread.cards.some((c) => sameCard(c, change.projectId, change.itemId)))
        return { ok: false, reason: 'unchanged' };
      const cards = thread.cards.filter((c) => !sameCard(c, change.projectId, change.itemId));
      return cards.length ? next({ cards }, false) : { ok: true, thread: null };
    }
  }
}

function sameMentions(a: CommentMention[] | undefined, b: CommentMention[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/** A new thread on `card`, with its first comment and (unless given) its automatic title, in its Comments field
 *  (`field`; the built-in Comments when absent or `comments`). */
export function startThread(input: {
  id: string;
  home: string;
  card: CardRef;
  comment: Comment;
  title?: string;
  field?: string;
  now: number;
}): CardThread {
  const { comment } = input;
  return {
    id: input.id,
    title: input.title || autoThreadTitle(comment.authorName, comment.text),
    resolved: false,
    comments: [comment],
    createdAt: input.now,
    createdBy: {
      name: comment.authorName,
      color: comment.authorColor,
      ...(comment.authorId !== undefined ? { authorId: comment.authorId } : {}),
    },
    updatedAt: input.now,
    home: input.home,
    cards: [input.card],
    ...(input.field && input.field !== 'comments' ? { field: input.field } : {}),
    rev: 1,
  };
}

// ---------- Reads --------------------------------------------------------------------------------------------

/** The threads on one card. */
export function threadsOnCard<T extends Pick<CardThread, 'cards'>>(
  threads: Iterable<T>,
  projectId: string,
  itemId: string,
): T[] {
  const out: T[] = [];
  for (const t of threads) if (t.cards.some((c) => sameCard(c, projectId, itemId))) out.push(t);
  return out;
}

/** The comments in a card's open threads: its face count. */
export function openCommentCount(
  threads: Iterable<Pick<CardThread, 'cards' | 'resolved' | 'comments'>>,
  projectId: string,
  itemId: string,
): number {
  let n = 0;
  for (const t of threadsOnCard(threads, projectId, itemId))
    if (!t.resolved) n += t.comments.length;
  return n;
}

/** The key a card's face count for one Comments field (not the built-in) is kept under, beside the card's whole. */
export const fieldCountKey = (itemId: string, field: string): string => `${itemId}\u0000${field}`;

/** Each card's face count in one pass over the threads: the card ids of `projectId` with a count above 0, and each
 *  card's count in each Comments field a thread names (docs/specs/026-plan/item-types.md "Comments and Votes
 *  fields") under `fieldCountKey`; the built-in's is the whole less the others. */
export function openCommentCounts(
  threads: Iterable<Pick<CardThread, 'cards' | 'resolved' | 'comments' | 'field'>>,
  projectId: string,
): Map<string, number> {
  const out = new Map<string, number>();
  const add = (key: string, n: number) => out.set(key, (out.get(key) ?? 0) + n);
  for (const t of threads) {
    if (t.resolved) continue;
    for (const c of t.cards) {
      if (c.projectId !== projectId) continue;
      add(c.itemId, t.comments.length);
      if (t.field) add(fieldCountKey(c.itemId, t.field), t.comments.length);
    }
  }
  return out;
}

/** Open threads first, most recently active first; then resolved ones, most recently resolved first. */
export function sortedThreads<T extends Pick<CardThread, 'resolved' | 'updatedAt' | 'resolvedAt'>>(
  threads: readonly T[],
): T[] {
  return [...threads].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const at = (t: T) => (t.resolved ? (t.resolvedAt ?? t.updatedAt) : t.updatedAt);
    return at(b) - at(a);
  });
}

/** Whether every comment in a thread is `owner`'s (docs/specs/026-plan/items.md "Deleting a thread"): their own,
 *  an agent's posted with their token among them. Only then may they delete it; a thread holding anyone else's
 *  comment is only resolved. A comment whose author id is withheld (a viewer's copy) reads as someone else's. */
export function threadOnlyBy(thread: Pick<CardThread, 'comments'>, owner: string | null): boolean {
  return owner !== null && thread.comments.every((c) => c.authorId === owner);
}

/** Everyone who wrote in a thread, in the order they first did: name and colour. */
export function threadParticipants(
  thread: Pick<CardThread, 'comments'>,
): { name: string; color: string }[] {
  const seen = new Map<string, { name: string; color: string }>();
  for (const c of thread.comments) {
    const key = `${c.authorName}\u0000${c.authorColor}`;
    if (!seen.has(key)) seen.set(key, { name: c.authorName, color: c.authorColor });
  }
  return [...seen.values()];
}

// ---------- Redaction ----------------------------------------------------------------------------------------

function mapComments(thread: CardThread, map: (c: Comment) => Comment): Comment[] {
  let changed = false;
  const comments = thread.comments.map((c) => {
    const next = map(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? comments : thread.comments;
}

/** The thread as `viewer` may see it: author and token ids only on their own comments, and the starter's id only
 *  to the starter. Null, someone with no owner id, sees none. */
export function threadForViewer(thread: CardThread, viewer: string | null): CardThread {
  const comments = mapComments(thread, (c) =>
    viewer !== null && c.authorId === viewer
      ? c
      : c.authorId === undefined && c.tokenId === undefined
        ? c
        : withoutCommentAuthorId(c),
  );
  const keepStarter = viewer !== null && thread.createdBy.authorId === viewer;
  const createdBy =
    keepStarter || thread.createdBy.authorId === undefined
      ? thread.createdBy
      : { name: thread.createdBy.name, color: thread.createdBy.color };
  return comments === thread.comments && createdBy === thread.createdBy
    ? thread
    : { ...thread, comments, createdBy };
}

/** The thread as the room may carry it: no author or token ids at all. */
export function threadForRoom(thread: CardThread): CardThread {
  return threadForViewer(thread, null);
}

/** A copy from the room (no author ids) folded over ours: our own comments (and the starter mark) keep the ids we
 *  were given, so Edit and Delete do not vanish when the room's copy lands after the api's answer. */
export function keepOwnThreadAuthors(
  local: CardThread | undefined,
  incoming: CardThread,
): CardThread {
  if (!local) return incoming;
  const authors = new Map(
    local.comments.flatMap((c) => (c.authorId !== undefined ? [[c.id, c.authorId] as const] : [])),
  );
  const comments =
    authors.size === 0
      ? incoming.comments
      : mapComments(incoming, (c) => {
          const authorId = authors.get(c.id);
          return c.authorId === undefined && authorId !== undefined ? { ...c, authorId } : c;
        });
  const createdBy =
    incoming.createdBy.authorId === undefined && local.createdBy.authorId !== undefined
      ? { ...incoming.createdBy, authorId: local.createdBy.authorId }
      : incoming.createdBy;
  return comments === incoming.comments && createdBy === incoming.createdBy
    ? incoming
    : { ...incoming, comments, createdBy };
}

// A comment as a restore may carry it: author id only when it is the restorer's, no token, clean mentions.
function restoredComment(c: Comment, owner: string): Comment {
  const { authorId, tokenId: _token, mentions, ...rest } = c;
  const clean = sanitizeMentions(mentions);
  return {
    ...rest,
    ...(authorId === owner ? { authorId } : {}),
    ...(clean ? { mentions: clean } : {}),
  };
}

/** A thread a restore carries (an undo of a card's delete, an offline plan's sync), checked before it is kept:
 *  null when it is not one. Author ids survive only on the restorer's own comments, token ids never. */
export function readRestoredThread(raw: unknown, owner: string): CardThread | null {
  if (!isCardThread(raw)) return null;
  const { authorId, ...by } = raw.createdBy;
  return {
    ...raw,
    title: raw.title.slice(0, THREAD_TITLE_MAX),
    comments: raw.comments.map((c) => restoredComment(c, owner)),
    createdBy: authorId === owner ? { ...by, authorId } : by,
  };
}

// ---------- The old single thread ------------------------------------------------------------------------------

function isLegacyThread(value: unknown): value is CommentThread {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const t = value as { comments?: unknown; resolved?: unknown };
  return Array.isArray(t.comments) && t.comments.every(isComment);
}

/** A card's old single thread (`fields.comments`, before threads) as its first thread, or null when it has none
 *  (or an empty one). Its id is `c-<card id>`, its title worked out, its resolved state kept. */
export function legacyThreadOf(
  item: Pick<Item, 'id' | 'key' | 'fields' | 'updatedAt'>,
  projectId: string,
): CardThread | null {
  const raw = item.fields['comments'] as unknown;
  if (!isLegacyThread(raw) || raw.comments.length === 0) return null;
  const comments = raw.comments.slice(0, THREAD_COMMENTS_MAX);
  const first = comments[0]!;
  const last = comments[comments.length - 1]!;
  const resolved = raw.resolved === true;
  return {
    id: `${LEGACY_THREAD_PREFIX}${item.id}`,
    title: '',
    resolved,
    ...(resolved ? { resolvedAt: last.createdAt } : {}),
    comments,
    createdAt: first.createdAt,
    createdBy: {
      name: first.authorName,
      color: first.authorColor,
      ...(first.authorId !== undefined ? { authorId: first.authorId } : {}),
    },
    updatedAt: Math.max(last.createdAt, first.createdAt),
    home: projectId,
    cards: [{ projectId, itemId: item.id, key: item.key }],
    rev: 1,
  };
}

/** The item without its old single thread (unchanged when it has none). */
export function withoutLegacyThread<T extends Pick<Item, 'fields'>>(item: T): T {
  if (!('comments' in item.fields)) return item;
  const { comments: _drop, ...fields } = item.fields;
  return { ...item, fields };
}
