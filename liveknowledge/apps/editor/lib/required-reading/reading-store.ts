// Each page's Required Reading (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): read when the page's
// banner or rail first shows it in a session, and changed here. I've Read This shows at once and is put back if the
// api refuses it; a setup change, a stop, an ask again and a reminder wait for the api's answer, which replaces the
// entry. Outside React, as the watch store is: a reader subscribes and reads one page's entry, which keeps its
// identity until that page's state changes.
import type {
  PageReadingChange,
  PageReadingResponse,
  ReadingRemindResult,
} from '@liveknowledge/api-schema';
import {
  apiPageReading,
  apiPressReading,
  apiRemindReaders,
  apiSetPageReading,
} from '@/lib/api/page-reading';
import type { KnowledgeCaller } from '@/lib/api/knowledge';

export type PageReadingApi = {
  read: typeof apiPageReading;
  set: typeof apiSetPageReading;
  press: typeof apiPressReading;
  remind: typeof apiRemindReaders;
};

export type PageReadingEntry = {
  status: 'loading' | 'ready' | 'failed';
  reading: PageReadingResponse;
};

const NONE: PageReadingResponse = {
  required: null,
  mine: { asked: false },
  progress: null,
  sees: false,
  manages: false,
  email: false,
};
const LOADING: PageReadingEntry = { status: 'loading', reading: NONE };

/** What I've Read This shows before the api answers: the caller confirmed now, counted once. Pure. */
export function withOwnRead(
  reading: PageReadingResponse,
  selfId: string | null,
  now: number,
): PageReadingResponse {
  if (!reading.required || !reading.mine.asked || reading.mine.readAt !== undefined) return reading;
  const progress = reading.progress
    ? { ...reading.progress, done: Math.min(reading.progress.total, reading.progress.done + 1) }
    : null;
  const people = reading.people?.map((p) => (p.id === selfId ? { ...p, readAt: now } : p));
  return {
    ...reading,
    mine: { asked: true, readAt: now },
    progress,
    ...(people ? { people } : {}),
  };
}

export function createReadingStore(
  api: PageReadingApi = {
    read: apiPageReading,
    set: apiSetPageReading,
    press: apiPressReading,
    remind: apiRemindReaders,
  },
) {
  const entries = new Map<string, PageReadingEntry>();
  const loading = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let version = 0;
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;
  const put = (key: string, entry: PageReadingEntry) => {
    entries.set(key, entry);
    version++;
    for (const listener of listeners) listener();
  };
  const ready = (key: string, reading: PageReadingResponse) =>
    put(key, { status: 'ready', reading });

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    /** The page's state; `_at`, the store's version the caller read, for a memoising compiler. */
    entryOf: (documentId: string, tab: string, _at?: number): PageReadingEntry =>
      entries.get(keyOf(documentId, tab)) ?? LOADING,
    /** Read the page's state: once a session unless `again`; concurrent asks share one request. */
    load(who: KnowledgeCaller, documentId: string, tab: string, again = false): Promise<void> {
      const key = keyOf(documentId, tab);
      if (!again && entries.get(key)?.status === 'ready') return Promise.resolve();
      const running = loading.get(key);
      if (running) return running;
      const request = api
        .read(who, documentId, tab)
        .then(
          (reading) => ready(key, reading),
          () => {
            if (entries.get(key)?.status !== 'ready') put(key, { status: 'failed', reading: NONE });
          },
        )
        .finally(() => loading.delete(key));
      loading.set(key, request);
      return request;
    },
    /** I've Read This, shown at once; a refusal puts it back and rejects. */
    async confirm(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      selfId: string | null,
      now: number = Date.now(),
    ): Promise<void> {
      const key = keyOf(documentId, tab);
      const before = entries.get(key);
      if (before?.status !== 'ready') return;
      put(key, { ...before, reading: withOwnRead(before.reading, selfId, now) });
      try {
        ready(key, await api.press(who, documentId, tab, 'read'));
      } catch (err) {
        put(key, before);
        throw err;
      }
    },
    /** Require, change or stop: the api's answer replaces the entry. */
    async set(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      change: PageReadingChange,
    ): Promise<void> {
      ready(keyOf(documentId, tab), await api.set(who, documentId, tab, change));
    },
    /** Ask everyone again (a significant save). */
    async again(who: KnowledgeCaller, documentId: string, tab: string): Promise<void> {
      ready(keyOf(documentId, tab), await api.press(who, documentId, tab, 'read-again'));
    },
    /** Remind those not yet read; a send reads the page again, so its Last Reminded and each person's show. */
    async remind(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
    ): Promise<ReadingRemindResult> {
      const result = await api.remind(who, documentId, tab);
      if (result.outcome === 'sent') await this.load(who, documentId, tab, true);
      return result;
    },
  };
}

export type ReadingStore = ReturnType<typeof createReadingStore>;

/** The editor's one store. */
export const readingStore = createReadingStore();
