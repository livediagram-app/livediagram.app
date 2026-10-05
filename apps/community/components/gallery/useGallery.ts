'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  communitySearchMine,
  setCommunitySearchMine,
  setCommunitySearchSort,
  type CommunityFacetsResponse,
  type CommunityListQuery,
  type CommunityMineTotals,
} from '@livediagram/api-schema';
import { fetchFacets, fetchMine, fetchPosts } from '@/lib/api';
import type { GalleryPost } from '@/lib/gallery-post';
import type { CommunitySession } from '@/lib/session';
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
// dropped. With `is:mine` in the search (My Shares) the posts come from the signed-in author's own list
// instead, once `session` says who that is; signed out, the status is `signed-out` and nothing loads.

export type GalleryStatus = 'loading' | 'ready' | 'error' | 'signed-out';

type Result = {
  key: string;
  status: 'ready' | 'error';
  posts: GalleryPost[];
  nextOffset: number | null;
  totals: CommunityMineTotals | null;
};

type Page = { posts: GalleryPost[]; nextOffset: number | null; totals: CommunityMineTotals | null };

export type Gallery = {
  // Null until the URL has been read on the client.
  filters: GalleryFilters | null;
  status: GalleryStatus;
  posts: GalleryPost[];
  // My Shares: whether it is on, and how popular the author's posts are altogether.
  mine: boolean;
  totals: CommunityMineTotals | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  facets: CommunityFacetsResponse | null;
  setFilters: (patch: Partial<GalleryFilters>, selection?: CommunitySelection) => void;
  clearFilters: () => void;
  loadMore: () => void;
  retry: () => void;
};

function appendUnique(posts: GalleryPost[], more: GalleryPost[]): GalleryPost[] {
  const seen = new Set(posts.map((p) => p.id));
  return [...posts, ...more.filter((p) => !seen.has(p.id))];
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

export function useGallery(session: CommunitySession | null): Gallery {
  const search = useSyncExternalStore(subscribeSearch, getSearchSnapshot, getServerSearchSnapshot);
  const filters = useMemo(
    () => (search === null ? null : readQueryState(new URLSearchParams(search))),
    [search],
  );
  const mine = filters ? communitySearchMine(filters.q) : false;
  // My Shares can only load once Clerk has said who is signed in.
  const sessionReady = !mine || session?.loaded === true;
  const signedOut = mine && session?.loaded === true && !session.signedIn;
  // The newest getToken without restarting a load each time Clerk republishes the session.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const [reload, setReload] = useState(0);
  const key =
    filters && sessionReady && !signedOut
      ? `${writeQueryState(filters)}#${reload}${mine ? '#mine' : ''}`
      : null;

  const loadPage = useCallback(
    async (query: CommunityListQuery, signal?: AbortSignal): Promise<Page> => {
      if (!communitySearchMine(query.q)) {
        const res = await fetchPosts(query, signal);
        return { posts: res.posts, nextOffset: res.nextOffset, totals: null };
      }
      const token = await sessionRef.current?.getToken();
      if (!token) throw new Error('[community] my shares: no session token');
      return fetchMine(query, token, signal);
    },
    [],
  );

  const [result, setResult] = useState<Result | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [facets, setFacets] = useState<CommunityFacetsResponse | null>(null);

  useEffect(() => {
    if (!filters || key === null) return;
    const controller = new AbortController();
    loadPage({ ...filters, offset: 0 }, controller.signal)
      .then((page) => setResult({ key, status: 'ready', ...page }))
      .catch((err: unknown) => {
        if (isAbort(err)) return;
        console.warn('[community] gallery load failed', err);
        setResult({ key, status: 'error', posts: [], nextOffset: null, totals: null });
      });
    return () => controller.abort();
  }, [filters, key, loadPage]);

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
        // Clearing filters keeps My Shares on: it is where you are, not a filter of it.
        q: setCommunitySearchMine(setCommunitySearchSort('', filters.sort), mine),
        category: null,
        tag: null,
        sort: filters.sort,
      }),
    );
  }, [filters, mine]);

  const loadMore = useCallback(() => {
    if (!filters || !current || current.nextOffset === null || loadingMore) return;
    const answering = current.key;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    loadPage({ ...filters, offset: current.nextOffset })
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
  }, [current, filters, loadPage, loadingMore]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  return {
    filters,
    status: signedOut ? 'signed-out' : current ? current.status : 'loading',
    posts: current?.posts ?? [],
    mine,
    totals: current?.totals ?? null,
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
