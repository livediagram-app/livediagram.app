// Who watches each page (docs/specs/030-knowledgebase/watching.md "Where it shows"): read when a page's rail or its
// row menu first shows it in a session, and changed here with the press shown at once and put back if the api refuses
// it. A watch of a section changes what its subpages read ("Watching Through"), so a change marks the knowledgebase's
// other pages stale: whichever shows one next reads it again, and nothing else is asked. Outside React, as the
// reactions store is: a reader subscribes and reads one page's entry, which keeps its identity until that page's
// watch changes.
import type { PageWatchResponse, PageWatchScope } from '@liveknowledge/api-schema';
import { apiPageWatch, apiSetPageWatch } from '@/lib/api/page-feedback';
import type { KnowledgeCaller } from '@/lib/api/knowledge';

export type PageWatchApi = { read: typeof apiPageWatch; set: typeof apiSetPageWatch };

export type PageWatchEntry = {
  status: 'loading' | 'ready' | 'failed';
  watch: PageWatchResponse;
  /** Another page's change may have moved this one's: read it again when it next shows. */
  stale: boolean;
};

const NONE: PageWatchResponse = { watching: null, through: null, watchers: 0, section: false };
const LOADING: PageWatchEntry = { status: 'loading', watch: NONE, stale: false };

/** What a press shows before the api answers: the count moves only when the person's cover starts or ends. Pure. */
export function withOwnWatch(
  watch: PageWatchResponse,
  scope: PageWatchScope | null,
): PageWatchResponse {
  const covered = watch.watching !== null || watch.through !== null;
  const after = scope !== null || watch.through !== null;
  const watchers = Math.max(0, watch.watchers + (after === covered ? 0 : after ? 1 : -1));
  return { ...watch, watching: scope, watchers };
}

export function createPageWatchStore(
  api: PageWatchApi = { read: apiPageWatch, set: apiSetPageWatch },
) {
  const entries = new Map<string, PageWatchEntry>();
  const loading = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let version = 0;
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;
  const notify = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const put = (key: string, entry: PageWatchEntry) => {
    entries.set(key, entry);
    notify();
  };

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    /** The page's watch; `_at`, the store's version the caller read, for a memoising compiler. */
    entryOf: (documentId: string, tab: string, _at?: number): PageWatchEntry =>
      entries.get(keyOf(documentId, tab)) ?? LOADING,
    /** Read the page's watch: once a session unless it went stale; concurrent asks share one request. */
    load(who: KnowledgeCaller, documentId: string, tab: string): Promise<void> {
      const key = keyOf(documentId, tab);
      const held = entries.get(key);
      if (held?.status === 'ready' && !held.stale) return Promise.resolve();
      const running = loading.get(key);
      if (running) return running;
      const request = api
        .read(who, documentId, tab)
        .then(
          (watch) => put(key, { status: 'ready', watch, stale: false }),
          () => {
            const now = entries.get(key);
            if (now?.status !== 'ready') put(key, { status: 'failed', watch: NONE, stale: false });
          },
        )
        .finally(() => loading.delete(key));
      loading.set(key, request);
      return request;
    },
    /** Watch the page, its section or neither, shown at once; a refusal puts it back and rejects. */
    async set(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      scope: PageWatchScope | null,
    ): Promise<void> {
      const key = keyOf(documentId, tab);
      const before = entries.get(key);
      if (before?.status !== 'ready') return;
      put(key, { ...before, watch: withOwnWatch(before.watch, scope) });
      try {
        const watch = await api.set(who, documentId, tab, scope);
        const prefix = `${documentId}\u0000`;
        for (const [other, entry] of entries)
          if (other !== key && other.startsWith(prefix) && entry.status === 'ready')
            entries.set(other, { ...entry, stale: true });
        put(key, { status: 'ready', watch, stale: false });
      } catch (err) {
        put(key, before);
        throw err;
      }
    },
  };
}

export type PageWatchStore = ReturnType<typeof createPageWatchStore>;

/** The editor's one store. */
export const pageWatchStore = createPageWatchStore();
