'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ForumListQuery, ForumTopicSummary } from '@liveworkspace/community';
import type { ForumApi } from './forum-api';
import type { ForumAccount } from './useForumAccount';

export type ForumTopicsState = {
  status: 'loading' | 'ready' | 'error';
  topics: ForumTopicSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
  retry: () => void;
};

type Page = {
  /** The query (and attempt) this answers: a list for any other is still loading. */
  key: string;
  status: 'ready' | 'error';
  topics: ForumTopicSummary[];
  nextOffset: number | null;
  loadMoreFailed: boolean;
};

// The Forum's list (liveworkspace/docs/specs/007-community/community.md "The Forum", "Topics and replies"): the first
// page for the category, app and sort, once the page knows who is reading (a signed-in reader's own waiting topics come
// with it), then Load More. Each answer carries the query it is for, so a newer query shows as loading until its own
// answer comes, and a slower older answer never lands on it.
export function useForumTopics(
  api: ForumApi,
  account: ForumAccount,
  query: Pick<ForumListQuery, 'category' | 'app' | 'sort'>,
): ForumTopicsState {
  const [page, setPage] = useState<Page | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const known = account.status !== 'checking';
  const getToken = account.status === 'in' ? account.getToken : null;
  const { category, app, sort } = query;
  const key = `${category ?? ''}|${app ?? ''}|${sort}|${attempt}|${account.status}`;

  useEffect(() => {
    if (!known) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = getToken ? await getToken() : null;
        const first = await api.listTopics(
          { category, app, sort, offset: 0 },
          token,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setPage({
          key,
          status: 'ready',
          topics: first.topics,
          nextOffset: first.nextOffset,
          loadMoreFailed: false,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('[forum] list failed', err);
        setPage({ key, status: 'error', topics: [], nextOffset: null, loadMoreFailed: false });
      }
    })();
    return () => controller.abort();
  }, [api, known, getToken, category, app, sort, key]);

  const current = page?.key === key ? page : null;

  const loadMore = useCallback(() => {
    if (!current || current.nextOffset === null || loadingMore) return;
    const forKey = current.key;
    const offset = current.nextOffset;
    setLoadingMore(true);
    void (async () => {
      try {
        // Later pages are the listed topics alone, the same for everyone.
        const more = await api.listTopics({ category, app, sort, offset }, null);
        setPage((before) => {
          if (!before || before.key !== forKey) return before;
          const seen = new Set(before.topics.map((t) => t.id));
          return {
            ...before,
            topics: [...before.topics, ...more.topics.filter((t) => !seen.has(t.id))],
            nextOffset: more.nextOffset,
            loadMoreFailed: false,
          };
        });
      } catch (err) {
        console.warn('[forum] load more failed', err);
        setPage((before) =>
          before && before.key === forKey ? { ...before, loadMoreFailed: true } : before,
        );
      } finally {
        setLoadingMore(false);
      }
    })();
  }, [api, current, loadingMore, category, app, sort]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    status: current ? current.status : 'loading',
    topics: current?.topics ?? [],
    hasMore: current?.nextOffset != null,
    loadingMore,
    loadMoreFailed: current?.loadMoreFailed ?? false,
    loadMore,
    retry,
  };
}
