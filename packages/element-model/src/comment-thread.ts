// A comment thread's ops: append, remove, resolve. Split out of each product's comments.ts so element deltas (and
// liveplanner's card comment writes) share them without an import cycle. Generic over the comment, so each product
// keeps its own Comment type; a thread only needs each comment's id.

/** A thread as every product stores it: its comments, oldest first, and whether it is resolved. */
export type CommentThreadOf<C extends { id: string }> = { comments: C[]; resolved: boolean };

// The thread ops (docs/specs/008-canvas/canvas-and-palette.md "Comments"): one set of pure functions an element's
// comment deltas apply. Each returns the SAME thread when nothing changes, so callers keep identity.

// Appends `comment` (unless its id is already there, or the thread holds `max`), reopening a resolved thread. With
// `before`, the id of a comment still in the thread, it goes in ahead of that one instead: a refused delete put back
// in its place.
export function threadWithComment<C extends { id: string }>(
  thread: CommentThreadOf<C> | undefined,
  comment: C,
  max: number,
  before?: string,
): CommentThreadOf<C> | undefined {
  const comments = thread?.comments ?? [];
  if (comments.some((c) => c.id === comment.id)) return thread;
  if (comments.length >= max) return thread;
  const at = before === undefined ? -1 : comments.findIndex((c) => c.id === before);
  const next =
    at < 0 ? [...comments, comment] : [...comments.slice(0, at), comment, ...comments.slice(at)];
  return { comments: next, resolved: false };
}

// Takes `commentId` out; the last comment going takes the thread with it (undefined).
export function threadWithoutComment<T extends CommentThreadOf<{ id: string }>>(
  thread: T | undefined,
  commentId: string,
): T | undefined {
  if (!thread || !thread.comments.some((c) => c.id === commentId)) return thread;
  const remaining = thread.comments.filter((c) => c.id !== commentId);
  return remaining.length ? { ...thread, comments: remaining } : undefined;
}

// Resolves or reopens; no thread, or already so, is unchanged.
export function threadResolved<T extends CommentThreadOf<{ id: string }>>(
  thread: T | undefined,
  resolved: boolean,
): T | undefined {
  if (!thread || thread.resolved === resolved) return thread;
  return { ...thread, resolved };
}

// Changes the text of `commentId` and stamps when (docs/specs/024-agents/agent-presence.md "Edit and delete own"): its
// author's edit, relayed as a `comment-edit` delta. No such comment, or the same text, is unchanged.
export function threadWithEdit<C extends { id: string; text: string; editedAt?: number }>(
  thread: CommentThreadOf<C> | undefined,
  commentId: string,
  text: string,
  editedAt: number,
): CommentThreadOf<C> | undefined {
  const at = thread?.comments.findIndex((c) => c.id === commentId) ?? -1;
  if (!thread || at < 0 || thread.comments[at]!.text === text) return thread;
  const comments = thread.comments.map((c, i) => (i === at ? { ...c, text, editedAt } : c));
  return { ...thread, comments };
}
