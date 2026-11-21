// The comment threads at the foot of each page (docs/specs/030-knowledgebase/page-comments.md): read once when a
// page first opens in a session, kept current by the room's `page-thread` ops (the whole thread, or its removal), and
// changed here with the change shown at once and put back if the api refuses it. Outside React: a reader subscribes
// and reads one page's list, which keeps its identity until that page's threads change.
import type {
  PageComment,
  PageThread,
  PageThreadChange,
  PageThreadChangeResponse,
  PageThreadOp,
} from '@liveknowledge/api-schema';
import { apiChangePageThread, apiPageThreads } from '@/lib/api/page-feedback';
import type { KnowledgeCaller } from '@/lib/api/knowledge';

export type PageThreadsApi = { list: typeof apiPageThreads; change: typeof apiChangePageThread };

export type PageThreadsEntry = {
  status: 'loading' | 'ready' | 'failed';
  threads: readonly PageThread[];
};

/** Who is writing here, for the comment shown before the api answers. */
export type PageThreadAuthor = { by: string; name: string; color: string };

const EMPTY: readonly PageThread[] = [];
const LOADING: PageThreadsEntry = { status: 'loading', threads: EMPTY };

const byAge = (a: PageThread, b: PageThread) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

/** The threads with `thread` put in (replacing the one of its id), oldest first. */
export function withThread(threads: readonly PageThread[], thread: PageThread): PageThread[] {
  return [...threads.filter((t) => t.id !== thread.id), thread].sort(byAge);
}

/** What a change does to a thread, as the api will (page-thread-changes.ts), for the moment before it answers.
 *  Null for a change this side cannot draw (an unknown thread). */
export function optimisticThreads(
  threads: readonly PageThread[],
  tab: string,
  change: PageThreadChange,
  author: PageThreadAuthor,
  now: number,
  tempId: string,
): PageThread[] | null {
  const comment = (text: string): PageComment => ({
    id: tempId,
    text: text.trim(),
    createdAt: now,
    authorName: author.name,
    authorColor: author.color,
    by: author.by,
  });
  if (change.op === 'start')
    return withThread(threads, {
      id: tempId,
      tab,
      createdAt: now,
      updatedAt: now,
      resolved: false,
      comments: [comment(change.text)],
    });
  const thread = threads.find((t) => t.id === change.thread);
  if (!thread) return null;
  const put = (next: PageThread) => withThread(threads, { ...next, updatedAt: now });
  switch (change.op) {
    case 'reply': {
      // A reply reopens a resolved thread.
      const { resolvedBy: _by, resolvedAt: _at, ...open } = thread;
      return put({
        ...open,
        resolved: false,
        comments: [...thread.comments, comment(change.text)],
      });
    }
    case 'resolve':
      return put({ ...thread, resolved: true, resolvedBy: author.name, resolvedAt: now });
    case 'reopen': {
      const { resolvedBy: _by, resolvedAt: _at, ...open } = thread;
      return put({ ...open, resolved: false });
    }
    case 'edit':
      return put({
        ...thread,
        comments: thread.comments.map((c) =>
          c.id === change.comment ? { ...c, text: change.text.trim(), editedAt: now } : c,
        ),
      });
    case 'delete': {
      const comments = thread.comments.filter((c) => c.id !== change.comment);
      return comments.length
        ? put({ ...thread, comments })
        : threads.filter((t) => t.id !== thread.id);
    }
  }
}

export function createPageThreadsStore(
  api: PageThreadsApi = { list: apiPageThreads, change: apiChangePageThread },
) {
  const entries = new Map<string, PageThreadsEntry>();
  const loading = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let version = 0;
  let temp = 0;
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;
  const changed = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const put = (key: string, entry: PageThreadsEntry) => {
    entries.set(key, entry);
    changed();
  };
  const threadsAt = (key: string) => entries.get(key)?.threads ?? EMPTY;

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    /** The page's threads; `_at`, the store's version the caller read, for a memoising compiler. */
    entryOf: (documentId: string, tab: string, _at?: number): PageThreadsEntry =>
      entries.get(keyOf(documentId, tab)) ?? LOADING,
    /** Read the page's threads: once a session unless `fresh` (a reconnect); concurrent asks share one request. */
    load(who: KnowledgeCaller, documentId: string, tab: string, fresh = false): Promise<void> {
      const key = keyOf(documentId, tab);
      if (!fresh && entries.get(key)?.status === 'ready') return Promise.resolve();
      const running = loading.get(key);
      if (running) return running;
      const request = api
        .list(who, documentId, tab)
        .then(
          (threads) => put(key, { status: 'ready', threads: [...threads].sort(byAge) }),
          () => {
            // A failure keeps what was held; a page never read says so.
            if (entries.get(key)?.status !== 'ready')
              put(key, { status: 'failed', threads: threadsAt(key) });
          },
        )
        .finally(() => loading.delete(key));
      loading.set(key, request);
      return request;
    },
    /** The room's op: the thread as stored, or its removal. A page not read here is left to its first read. */
    receive(documentId: string, op: PageThreadOp): void {
      const key = keyOf(documentId, op.tabId);
      const entry = entries.get(key);
      if (!entry || entry.status !== 'ready') return;
      const threads =
        'removed' in op
          ? entry.threads.filter((t) => t.id !== op.threadId)
          : withThread(entry.threads, op.thread);
      put(key, { status: 'ready', threads });
    },
    /** One change, shown at once, the api's thread kept, or put back on a refusal (which rejects). */
    async change(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      change: PageThreadChange,
      author: PageThreadAuthor,
      now: number,
    ): Promise<PageThreadChangeResponse> {
      const key = keyOf(documentId, tab);
      const before = threadsAt(key);
      const tempId = `pending-${++temp}`;
      const shown = optimisticThreads(before, tab, change, author, now, tempId);
      if (shown) put(key, { status: 'ready', threads: shown });
      try {
        const answer = await api.change(who, documentId, tab, change);
        // The api's thread replaces the one drawn here (a start's temporary id with it).
        const held = threadsAt(key).filter((t) => t.id !== tempId);
        put(key, {
          status: 'ready',
          threads:
            'removed' in answer
              ? held.filter((t) => t.id !== answer.removed)
              : withThread(held, answer.thread),
        });
        return answer;
      } catch (err) {
        put(key, { status: 'ready', threads: before });
        throw err;
      }
    },
  };
}

export type PageThreadsStore = ReturnType<typeof createPageThreadsStore>;

/** The editor's one store. */
export const pageThreadsStore = createPageThreadsStore();
