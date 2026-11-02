// The Imported comments thread a card brought from another tool carries (docs/specs/026-plan/tracker-import.md
// "Comments"): every comment the import kept, oldest first, each starting with its original author and date, posted
// as "<Source> import". No comment has an author id or mentions, so none sends a mention, an Inbox row or an email;
// the create carries the thread as a restore does (item create `threads`), which posts nothing.
import type { TrackerCommentOut, TrackerCreate } from '@liveplanner/items';
import { newThreadId, THREAD_ID_PREFIX, type CardThread } from './card-threads';

export const IMPORTED_THREAD_TITLE = 'Imported comments';
// A neutral grey: the comments are nobody's on this plan.
export const IMPORTED_THREAD_COLOR = '#71717a';

/** The thread for one card's imported comments, or null when it has none. */
export function importedCommentsThread(input: {
  projectId: string;
  itemId: string;
  sourceName: string;
  comments: readonly TrackerCommentOut[];
  now: number;
  random?: () => number;
}): CardThread | null {
  if (input.comments.length === 0) return null;
  const id = newThreadId(input.random);
  const authorName = `${input.sourceName} import`;
  const comments = input.comments.map((c, i) => ({
    id: `${id.slice(THREAD_ID_PREFIX.length)}-${i}`,
    text: c.text,
    createdAt: c.at ?? input.now,
    authorName,
    authorColor: IMPORTED_THREAD_COLOR,
  }));
  return {
    id,
    title: IMPORTED_THREAD_TITLE,
    resolved: false,
    comments,
    createdAt: input.now,
    createdBy: { name: authorName, color: IMPORTED_THREAD_COLOR },
    updatedAt: input.now,
    home: input.projectId,
    cards: [{ projectId: input.projectId, itemId: input.itemId, key: null }],
    rev: 1,
  };
}

/** An imported card as the item store takes it: its comments as its thread. */
export type ImportedCreate = Omit<TrackerCreate, 'importedComments' | 'threads'> & {
  threads?: CardThread[];
};

/** An import's creates as the item store takes them: each card's comments as its Imported comments thread. */
export function withImportedThreads(
  creates: readonly TrackerCreate[],
  input: { projectId: string; sourceName: string; now: number; random?: () => number },
): ImportedCreate[] {
  return creates.map(({ importedComments, threads: _none, ...create }) => {
    const thread = importedCommentsThread({
      projectId: input.projectId,
      itemId: create.id,
      sourceName: input.sourceName,
      comments: importedComments,
      now: input.now,
      ...(input.random ? { random: input.random } : {}),
    });
    return thread ? { ...create, threads: [thread] } : create;
  });
}
