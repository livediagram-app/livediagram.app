'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  setCommunitySearchSort,
  type CommunityFacetsResponse,
  type CommunityPost,
} from '@livediagram/api-schema';
import { fetchFacets, fetchPosts } from '@/lib/api';
import { readQueryState, writeQueryState, type GalleryFilters } from '@/lib/query-state';
import { communityTelemetry, type CommunitySelection } from '@/lib/telemetry';
import {
  getSearchSnapshot,
  getServerSearchSnapshot,
  replaceSearch,
  subscribeSearch,
} from '@/lib/url-search';

// The gallery's state (blueprint §5 "Gallery: GalleryView owns state"). Filters are read from the URL
// and written back to it; the first page of posts loads whenever they change; Load More appends the
// next page in memory. A result remembers which filters it answered, so "loading" is derived (the
// result is for other filters) rather than set by hand, and a slow answer for stale filters is
// dropped.

export type GalleryStatus = 'loading' | 'ready' | 'error';

type Result = {
  key: string;
  status: 'ready' | 'error';
  posts: CommunityPost[];
  nextOffset: number | null;
};

export type Gallery = {
  // Null until the URL has been read on the client.
  filters: GalleryFilters | null;
  status: GalleryStatus;
  posts: CommunityPost[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  facets: CommunityFacetsResponse | null;
  setFilters: (patch: Partial<GalleryFilters>, selection?: CommunitySelection) => void;
  clearFilters: () => void;
  loadMore: () => void;
  retry: () => void;
};

function appendUnique(posts: CommunityPost[], more: CommunityPost[]): CommunityPost[] {
  const seen = new Set(posts.map((p) => p.id));
  return [...posts, ...more.filter((p) => !seen.has(p.id))];
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

export function useGallery(): Gallery {
  const search = useSyncExternalStore(subscribeSearch, getSearchSnapshot, getServerSearchSnapshot);
  const filters = useMemo(
    () => (search === null ? null : readQueryState(new URLSearchParams(search))),
    [search],
  );
  const [reload, setReload] = useState(0);
  const key = filters ? `${writeQueryState(filters)}#${reload}` : null;

  const [result, setResult] = useState<Result | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [facets, setFacets] = useState<CommunityFacetsResponse | null>(null);

  useEffect(() => {
    if (!filters || key === null) return;
    const controller = new AbortController();
    fetchPosts({ ...filters, offset: 0 }, controller.signal)
      .then((res) =>
        setResult({ key, status: 'ready', posts: res.posts, nextOffset: res.nextOffset }),
      )
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        console.warn('[community] gallery load failed', err);
        setResult({ key, status: 'error', posts: [], nextOffset: null });
      });
    return () => controller.abort();
  }, [filters, key]);

  // Facets are a nicety: without them the chips simply carry no counts.
  useEffect(() => {
    const controller = new AbortController();
    fetchFacets(controller.signal)
      .then(setFacets)
      .catch((err: unknown) => {
        if (!isAbort(err)) console.warn('[community] facets load failed', err);
      });
    return () => controller.abort();
  }, []);

  const current = result && result.key === key ? result : null;

  const setFilters = useCallback(
    (patch: Partial<GalleryFilters>, selection?: CommunitySelection) => {
      if (!filters) return;
      if (selection) communityTelemetry.selected(selection);
      if (patch.q && patch.q !== filters.q) communityTelemetry.searched();
      setLoadMoreFailed(false);
      replaceSearch(writeQueryState({ ...filters, ...patch }));
    },
    [filters],
  );

  const clearFilters = useCallback(() => {
    if (!filters) return;
    setLoadMoreFailed(false);
    replaceSearch(
      writeQueryState({
        q: setCommunitySearchSort('', filters.sort),
        category: null,
        tag: null,
        sort: filters.sort,
      }),
    );
  }, [filters]);

  const loadMore = useCallback(() => {
    if (!filters || !current || current.nextOffset === null || loadingMore) return;
    const answering = current.key;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    fetchPosts({ ...filters, offset: current.nextOffset })
      .then((res) =>
        setResult((prev) =>
          prev && prev.key === answering
            ? { ...prev, posts: appendUnique(prev.posts, res.posts), nextOffset: res.nextOffset }
            : prev,
        ),
      )
      .catch((err: unknown) => {
        console.warn('[community] load more failed', err);
        setLoadMoreFailed(true);
      })
      .finally(() => setLoadingMore(false));
  }, [current, filters, loadingMore]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  return {
    filters,
    status: current ? current.status : 'loading',
    posts: current?.posts ?? [],
    hasMore: current?.nextOffset != null,
    loadingMore,
    loadMoreFailed,
    facets,
    setFilters,
    clearFilters,
    loadMore,
    retry,
  };
}
