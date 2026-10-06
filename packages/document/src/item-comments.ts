// A Plan card's comment thread (docs/specs/026-plan/items.md "Comments"): the canvas's CommentThread, kept in
// the item's `comments` field. Here because it joins the two models: the item store (@livediagram/items) knows
// nothing of comments, and this package already reads items. The api applies these writes to the item as
// stored, the editor applies them optimistically, and both redact author ids the same way the canvas does.

import {
  ITEM_COMMENTS_BYTES,
  ITEM_COMMENTS_MAX,
  commentsByteSize,
  type Item,
  type ItemFieldValue,
  type WriteContext,
} from '@livediagram/items';
import { sanitizeMentions } from './comment-mentions';
import { threadResolved, threadWithComment, threadWithoutComment } from './comment-thread';
import { withoutCommentAuthorId, type Comment, type CommentThread } from './comments';
import { isComment } from './element-deltas';

export const ITEM_COMMENTS_FIELD = 'comments';

export type ItemCommentChange =
  | { kind: 'add'; comment: Comment }
  | { kind: 'remove'; commentId: string }
  | { kind: 'resolve'; resolved: boolean };

export type ItemCommentRefusal = 'unchanged' | 'comments_full' | 'comment_not_found';

export type ItemCommentResult =
  { ok: true; item: Item } | { ok: false; reason: ItemCommentRefusal };

function isThread(value: unknown): value is CommentThread {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const t = value as { comments?: unknown; resolved?: unknown };
  return (
    typeof t.resolved === 'boolean' &&
    Array.isArray(t.comments) &&
    t.comments.length <= ITEM_COMMENTS_MAX &&
    t.comments.every(isComment)
  );
}

// The item's thread, or undefined when it has none (or holds something that is not one).
export function itemThread(item: Pick<Item, 'fields'>): CommentThread | undefined {
  const t = item.fields[ITEM_COMMENTS_FIELD];
  return isThread(t) ? t : undefined;
}

function withThread(item: Item, thread: CommentThread | undefined): Item['fields'] {
  const { [ITEM_COMMENTS_FIELD]: _drop, ...rest } = item.fields;
  // A CommentThread is JSON, but its optional keys keep TypeScript from seeing it as an ItemFieldValue.
  return thread ? { ...rest, [ITEM_COMMENTS_FIELD]: thread as unknown as ItemFieldValue } : rest;
}

// One comment write, applied to the item as it stands: a new item (rev raised, changed by `ctx.by`), or why not.
// A full thread (by count or by size) refuses a new comment; deleting or resolving is always allowed.
export function applyItemComment(
  item: Item,
  change: ItemCommentChange,
  ctx: WriteContext,
): ItemCommentResult {
  const thread = itemThread(item);
  let next: CommentThread | undefined;
  if (change.kind === 'add') {
    if ((thread?.comments.length ?? 0) >= ITEM_COMMENTS_MAX)
      return { ok: false, reason: 'comments_full' };
    next = threadWithComment(thread, change.comment, ITEM_COMMENTS_MAX);
  } else if (change.kind === 'remove') {
    if (!thread?.comments.some((c) => c.id === change.commentId))
      return { ok: false, reason: 'comment_not_found' };
    next = threadWithoutComment(thread, change.commentId);
  } else {
    next = threadResolved(thread, change.resolved);
  }
  if (next === thread) return { ok: false, reason: 'unchanged' };
  const fields = withThread(item, next);
  if (change.kind === 'add' && commentsByteSize(fields) > ITEM_COMMENTS_BYTES)
    return { ok: false, reason: 'comments_full' };
  return {
    ok: true,
    item: { ...item, fields, rev: item.rev + 1, updatedAt: ctx.now, updatedBy: ctx.by },
  };
}

function mapComments(item: Item, map: (c: Comment) => Comment): Item {
  const thread = itemThread(item);
  if (!thread) return item;
  let changed = false;
  const comments = thread.comments.map((c) => {
    const next = map(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...item, fields: withThread(item, { ...thread, comments }) } : item;
}

// The item as `viewer` may see it: author and token ids only on their own comments (a tab GET's rule for the
// canvas's comments). Null, someone with no owner id, sees none.
export function itemForViewer(item: Item, viewer: string | null): Item {
  return mapComments(item, (c) =>
    viewer !== null && c.authorId === viewer
      ? c
      : c.authorId === undefined && c.tokenId === undefined
        ? c
        : withoutCommentAuthorId(c),
  );
}

// The item as the room may carry it: no author or token ids at all (opForTheWire's rule for elements).
export function itemForRoom(item: Item): Item {
  return mapComments(item, withoutCommentAuthorId);
}

// A copy from the room (no author ids) folded over ours: our own comments keep the author id we were given, so
// the delete-own control does not vanish when the room's copy lands after the api's answer.
export function keepOwnCommentAuthors(local: Item | undefined, incoming: Item): Item {
  const mine = local ? itemThread(local) : undefined;
  if (!mine?.comments.some((c) => c.authorId !== undefined)) return incoming;
  const authors = new Map(
    mine.comments.flatMap((c) => (c.authorId !== undefined ? [[c.id, c.authorId] as const] : [])),
  );
  return mapComments(incoming, (c) => {
    const authorId = authors.get(c.id);
    return c.authorId === undefined && authorId !== undefined ? { ...c, authorId } : c;
  });
}

// A thread a restore carries (an undo of a card's delete), checked before it is kept: null when it is not a
// thread. Author ids survive only on the restorer's own comments (the only ones their copy could hold), token ids
// never, and mentions are cleaned as a posted comment's are.
export function readRestoredThread(raw: unknown, owner: string): CommentThread | null {
  if (!isThread(raw)) return null;
  return {
    resolved: raw.resolved,
    comments: raw.comments.map((c) => {
      const { authorId, tokenId: _token, mentions, ...rest } = c;
      const clean = sanitizeMentions(mentions);
      return {
        ...rest,
        ...(authorId === owner ? { authorId } : {}),
        ...(clean ? { mentions: clean } : {}),
      };
    }),
  };
}
