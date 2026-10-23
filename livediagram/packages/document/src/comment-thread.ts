// A comment thread's ops: append, remove, resolve. Split out of comments.ts so element deltas share them without an
// import cycle; the only imports are types.
import type { Comment, CommentThread } from './comments';

// The thread ops (docs/specs/008-canvas/canvas-and-palette.md "Comments"): one set of pure functions an element's
// comment deltas apply. Each returns the SAME thread when nothing
// changes, so callers keep identity.

// Appends `comment` (unless its id is already there, or the thread holds `max`), reopening a resolved thread.
export function threadWithComment(
  thread: CommentThread | undefined,
  comment: Comment,
  max: number,
): CommentThread | undefined {
  const comments = thread?.comments ?? [];
  if (comments.some((c) => c.id === comment.id)) return thread;
  if (comments.length >= max) return thread;
  return { comments: [...comments, comment], resolved: false };
}

// Takes `commentId` out; the last comment going takes the thread with it (undefined).
export function threadWithoutComment(
  thread: CommentThread | undefined,
  commentId: string,
): CommentThread | undefined {
  if (!thread || !thread.comments.some((c) => c.id === commentId)) return thread;
  const remaining = thread.comments.filter((c) => c.id !== commentId);
  return remaining.length ? { ...thread, comments: remaining } : undefined;
}

// Resolves or reopens; no thread, or already so, is unchanged.
export function threadResolved(
  thread: CommentThread | undefined,
  resolved: boolean,
): CommentThread | undefined {
  if (!thread || thread.resolved === resolved) return thread;
  return { ...thread, resolved };
}
