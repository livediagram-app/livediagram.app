'use client';

// The Knowledgebase Home's data (docs/specs/030-knowledgebase/knowledgebase-home.md "The numbers"): the person's
// knowledgebases from the index (one request), then one summary read for each of the twelve shown, in parallel and
// kept a minute. A summary that fails leaves its card without numbers; the list failing is said in the list's place.
import { useCallback, useEffect, useState } from 'react';
import type { KnowledgeSummaryResponse } from '@liveknowledge/api-schema';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { apiKnowledgeSummary } from '@/lib/api/knowledge';
import {
  createSummaryCache,
  homeKnowledgebases,
  type HomeKnowledgebase,
} from '@/lib/knowledge-home/home-data';

/** Items asked of the index: one page. A person with more sees the twelve most recent of these. */
const LIST_LIMIT = 100;

export type HomeData = {
  status: 'loading' | 'ready' | 'failed';
  knowledgebases: readonly HomeKnowledgebase[];
  total: number;
  summaries: ReadonlyMap<string, KnowledgeSummaryResponse>;
  /** Knowledgebases whose summary could not be read. */
  summaryFailed: ReadonlySet<string>;
  retry: () => void;
  /** Read one knowledgebase's summary again, past every copy kept (after a page of it was verified here). */
  refresh: (documentId: string) => Promise<void>;
};

// One cache per account, kept while the tab lives.
const caches = new Map<string, ReturnType<typeof createSummaryCache>>();
function cacheFor(ownerId: string) {
  let cache = caches.get(ownerId);
  if (!cache) {
    cache = createSummaryCache((id, fresh) =>
      apiKnowledgeSummary({ ownerId, shareCode: null }, id, undefined, fresh),
    );
    caches.set(ownerId, cache);
  }
  return cache;
}

const NO_KNOWLEDGEBASES: readonly HomeKnowledgebase[] = [];

export function useHomeData(ownerId: string | null): HomeData {
  const [list, setList] = useState<{
    status: HomeData['status'];
    knowledgebases: readonly HomeKnowledgebase[];
    total: number;
  }>({ status: 'loading', knowledgebases: NO_KNOWLEDGEBASES, total: 0 });
  const [summaries, setSummaries] = useState<ReadonlyMap<string, KnowledgeSummaryResponse>>(
    () => new Map(),
  );
  const [summaryFailed, setSummaryFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ownerId) return;
    const abort = new AbortController();
    let live = true;
    void (async () => {
      let shown: HomeKnowledgebase[];
      try {
        const page = await indexClient.listItems(
          { app: 'liveknowledge', limit: LIST_LIMIT },
          { signal: abort.signal },
        );
        if (!live) return;
        const found = homeKnowledgebases(page.items);
        shown = found.shown;
        setList({ status: 'ready', knowledgebases: shown, total: found.total });
      } catch {
        if (live) setList({ status: 'failed', knowledgebases: NO_KNOWLEDGEBASES, total: 0 });
        return;
      }
      const cache = cacheFor(ownerId);
      // All at once: twelve at most, each a small read answered from its own Durable Object.
      await Promise.all(
        shown.map(async ({ id }) => {
          try {
            const summary = await cache.get(id);
            if (live) setSummaries((held) => new Map(held).set(id, summary));
          } catch {
            if (live) setSummaryFailed((held) => new Set(held).add(id));
          }
        }),
      );
    })();
    return () => {
      live = false;
      abort.abort();
    };
  }, [ownerId, attempt]);

  const retry = useCallback(() => {
    setList({ status: 'loading', knowledgebases: NO_KNOWLEDGEBASES, total: 0 });
    setSummaryFailed(new Set());
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(
    async (documentId: string) => {
      if (!ownerId) return;
      cacheFor(ownerId).drop(documentId);
      try {
        const summary = await apiKnowledgeSummary(
          { ownerId, shareCode: null },
          documentId,
          undefined,
          true,
        );
        setSummaries((held) => new Map(held).set(documentId, summary));
      } catch {
        // The numbers shown stay; the next visit reads them again.
      }
    },
    [ownerId],
  );

  return { ...list, summaries, summaryFailed, retry, refresh };
}
