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
import {
  readQueryState,
  searchedWordsChanged,
  writeQueryState,
  type GalleryFilters,
} from '@/lib/query-state';
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
      ? `${writeQueryState(filters)}#${reload}${mine ? `#mine:${session?.userId ?? ''}` : ''}`
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
  // Load More's state belongs to the results it is paging: a page still loading (or failed) for filters no longer
  // shown says nothing about the results that are.
  const [more, setMore] = useState<{ key: string; state: 'loading' | 'failed' } | null>(null);
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
      // A search is the typed words changing; a control writing its own word (`#tag`, `category:`, `sort:`,
      // `is:mine`) is that control's selection, counted once above, not a search as well.
      if (patch.q !== undefined && searchedWordsChanged(filters.q, patch.q)) {
        communityTelemetry.searched();
      }
      replaceSearch(writeQueryState({ ...filters, ...patch }));
    },
    [filters],
  );

  const clearFilters = useCallback(() => {
    if (!filters) return;
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

  const currentMore = current && more && more.key === current.key ? more.state : null;

  const loadMore = useCallback(() => {
    if (!filters || !current || current.nextOffset === null || currentMore === 'loading') return;
    const answering = current.key;
    setMore({ key: answering, state: 'loading' });
    loadPage({ ...filters, offset: current.nextOffset })
      .then((res) => {
        setResult((prev) =>
          prev && prev.key === answering
            ? { ...prev, posts: appendUnique(prev.posts, res.posts), nextOffset: res.nextOffset }
            : prev,
        );
        setMore((prev) => (prev?.key === answering ? null : prev));
      })
      .catch((err: unknown) => {
        console.warn('[community] load more failed', err);
        setMore((prev) => (prev?.key === answering ? { key: answering, state: 'failed' } : prev));
      });
  }, [current, currentMore, filters, loadPage]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  return {
    filters,
    status: signedOut ? 'signed-out' : current ? current.status : 'loading',
    posts: current?.posts ?? [],
    mine,
    totals: current?.totals ?? null,
    hasMore: current?.nextOffset != null,
    loadingMore: currentMore === 'loading',
    loadMoreFailed: currentMore === 'failed',
    facets,
    setFilters,
    clearFilters,
    loadMore,
    retry,
  };
}
