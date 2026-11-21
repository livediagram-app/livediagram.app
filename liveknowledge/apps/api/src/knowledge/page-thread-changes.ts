// One change to a page's comment threads (docs/specs/030-knowledgebase/page-comments.md), worked out on the stored
// thread: start, reply, resolve, reopen, and edit or delete one's own comment. Pure, so every rule is tested
// without storage; page-threads.ts reads and writes, routes/knowledge-thread-routes.ts decides who may call.
import {
  COMMENT_TEXT_MAX,
  PAGE_THREAD_COMMENTS_MAX,
  type PageComment,
  type PageThread,
  type PageThreadChange,
} from '@liveknowledge/api-schema';

/** A comment as stored: the wire's, with the author's account or guest id (what decides "own") and an agent's token. */
export type StoredComment = PageComment & { authorId: string; tokenId?: string };
export type StoredThread = Omit<PageThread, 'comments'> & {
  createdBy: string;
  rev: number;
  comments: StoredComment[];
};

/** Who writes: their id, their collab key, the name and colour shown, and an agent's token. */
export type ThreadAuthor = {
  id: string;
  key: string;
  name: string;
  color: string;
  tokenId?: string;
};

export type ThreadRefusal =
  | 'missing_text'
  | 'text_too_long'
  | 'thread_not_found'
  | 'comment_not_found'
  | 'not_your_comment'
  | 'thread_full';

export type ThreadOutcome =
  { thread: StoredThread; changed: boolean } | { removed: string } | { refusal: ThreadRefusal };

/** A change's words, trimmed, or why they will not do. */
export function threadText(
  text: unknown,
): string | { refusal: 'missing_text' | 'text_too_long' } {
  const words = typeof text === 'string' ? text.trim() : '';
  if (!words) return { refusal: 'missing_text' };
  return words.length > COMMENT_TEXT_MAX ? { refusal: 'text_too_long' } : words;
}

function newComment(id: string, text: string, author: ThreadAuthor, now: number): StoredComment {
  return {
    id,
    text,
    createdAt: now,
    authorName: author.name,
    authorColor: author.color,
    by: author.key,
    authorId: author.id,
    ...(author.tokenId ? { tokenId: author.tokenId, ai: true as const } : {}),
  };
}

/**
 * `change` applied to `thread` (null for a start, which makes one). `ids` mints the new thread's and comment's ids.
 * Resolving a resolved thread, or reopening an open one, changes nothing.
 */
export function applyThreadChange(
  tab: string,
  thread: StoredThread | null,
  change: PageThreadChange,
  author: ThreadAuthor,
  now: number,
  ids: () => string,
): ThreadOutcome {
  if (change.op === 'start') {
    const text = threadText(change.text);
    if (typeof text !== 'string') return text;
    return {
      changed: true,
      thread: {
        id: ids(),
        tab,
        createdAt: now,
        updatedAt: now,
        createdBy: author.id,
        resolved: false,
        rev: 0,
        comments: [newComment(ids(), text, author, now)],
      },
    };
  }
  if (!thread) return { refusal: 'thread_not_found' };
  const touched = (next: Partial<StoredThread>): ThreadOutcome => ({
    changed: true,
    thread: { ...thread, ...next, updatedAt: now },
  });
  switch (change.op) {
    case 'reply': {
      const text = threadText(change.text);
      if (typeof text !== 'string') return text;
      if (thread.comments.length >= PAGE_THREAD_COMMENTS_MAX) return { refusal: 'thread_full' };
      // A reply reopens a resolved thread: the conversation is not done.
      const { resolvedBy: _by, resolvedAt: _at, ...open } = thread;
      return {
        changed: true,
        thread: {
          ...open,
          resolved: false,
          updatedAt: now,
          comments: [...thread.comments, newComment(ids(), text, author, now)],
        },
      };
    }
    case 'resolve':
      if (thread.resolved) return { thread, changed: false };
      return touched({ resolved: true, resolvedBy: author.name, resolvedAt: now });
    case 'reopen': {
      if (!thread.resolved) return { thread, changed: false };
      const { resolvedBy: _by, resolvedAt: _at, ...open } = thread;
      return { changed: true, thread: { ...open, resolved: false, updatedAt: now } };
    }
    case 'edit':
    case 'delete': {
      const comment = thread.comments.find((c) => c.id === change.comment);
      if (!comment) return { refusal: 'comment_not_found' };
      if (comment.authorId !== author.id) return { refusal: 'not_your_comment' };
      if (change.op === 'delete') {
        const comments = thread.comments.filter((c) => c.id !== comment.id);
        return comments.length === 0 ? { removed: thread.id } : touched({ comments });
      }
      const text = threadText(change.text);
      if (typeof text !== 'string') return text;
      if (text === comment.text) return { thread, changed: false };
      return touched({
        comments: thread.comments.map((c) =>
          c.id === comment.id ? { ...c, text, editedAt: now } : c,
        ),
      });
    }
  }
}

/** The thread as every client reads it: no account, guest or token id on any comment. */
export function publicThread(thread: StoredThread): PageThread {
  const { createdBy: _by, rev: _rev, comments, ...rest } = thread;
  return {
    ...rest,
    comments: comments.map(({ authorId: _id, tokenId: _token, ...c }) => c),
  };
}
