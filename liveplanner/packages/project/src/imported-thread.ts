// The Imported comments thread a card brought from another tool carries (docs/specs/026-plan/tracker-import.md
// "Comments"): every comment the import kept, oldest first, each starting with its original author and date, posted
// as "<Source> import". No comment has an author id or mentions, so none sends a mention, an Inbox row or an email;
// the create carries the thread as a restore does (item create `threads`), which posts nothing.
import { ITEM_BULK_MAX, type TrackerCommentOut, type TrackerCreate } from '@liveplanner/items';
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

// The most JSON one import write carries: under the api's 8 MB request cap (apps/api limits.ts MAX_BODY_BYTES), with
// room for the rest of the request.
export const IMPORT_WRITE_BYTES = 6 * 1024 * 1024;

/** An import's cards in writes the api takes: each at most ITEM_BULK_MAX cards and IMPORT_WRITE_BYTES of JSON (a
 *  card's fields and thread are each capped, so no one card passes it). `firstBytes` is room the first write spends
 *  on something else (a new plan's tab and card types); when that leaves no room, the first write holds no card. */
export function importBatches<T>(creates: readonly T[], firstBytes = 0): T[][] {
  const encoder = new TextEncoder();
  const out: T[][] = [];
  let batch: T[] = [];
  let bytes = firstBytes;
  for (const c of creates) {
    const size = encoder.encode(JSON.stringify(c)).length + 1;
    const full = batch.length >= ITEM_BULK_MAX || bytes + size > IMPORT_WRITE_BYTES;
    // A write is closed once full, though it holds no card when the first write's own room filled it.
    if (full && (batch.length > 0 || bytes > 0)) {
      out.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(c);
    bytes += size;
  }
  if (batch.length) out.push(batch);
  return out;
}
