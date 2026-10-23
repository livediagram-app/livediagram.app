'use client';

// The Timeline's pages from the index (GET /timeline): the first page on arrival and whenever the app filter
// changes, then a page per Show More, each one bounded read. "This app" asks for the host app's events only;
// "All" for every app's. What counts as new is fixed by the first page of the visit (its `seenAt`), and the visit
// then marks the Timeline seen, so the next visit's New starts here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TIMELINE_PAGE,
  type App,
  type IndexClient,
  type TimelineEvent,
} from '@liveworkspace/index-client';
import type { AppFilter } from '../words';

export type TimelineFeed = {
  events: TimelineEvent[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  /** When the reader last looked, from the visit's first page; null for never. */
  lastSeenAt: number | null;
  loadMore: () => void;
  retry: () => void;
  /** Takes events off the feed at once (Remove from Timeline); answers a function that puts them back. */
  hide: (ids: readonly string[]) => () => void;
};

const timelineQuery = (only: App | null) =>
  only ? { app: only, limit: TIMELINE_PAGE } : { limit: TIMELINE_PAGE };

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export function useTimelineFeed(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  epoch: number,
  /** Called once the visit has marked the Timeline seen, so a count of what is new can drop. */
  onSeen?: () => void,
): TimelineFeed {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Fixed by the visit's first page: a page read after the visit marked itself seen would mark nothing new.
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const seenFixed = useRef(false);
  const seen = useRef(onSeen);
  seen.current = onSeen;
  // Removed from the Timeline while the index is told: hidden here at once, shown again if it refuses.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const more = useRef<AbortController | null>(null);
  // The app asked for, or null for every app's: a string, so a new render is not a new query.
  const only: App | null = filter === 'app' ? app : null;

  useEffect(() => {
    const abort = new AbortController();
    more.current?.abort();
    setLoadingMore(false);
    setLoading(true);
    setError(false);
    client.timeline(timelineQuery(only), { signal: abort.signal }).then(
      (page) => {
        setEvents(page.events);
        setCursor(page.nextCursor);
        setLoading(false);
        if (!seenFixed.current) {
          seenFixed.current = true;
          setLastSeenAt(page.seenAt);
          // Best effort: a failed mark only means the same events read as new next time.
          client.markTimelineSeen().then(
            () => seen.current?.(),
            () => {},
          );
        }
      },
      (e: unknown) => {
        if (isAbort(e)) return;
        setLoading(false);
        setError(true);
      },
    );
    return () => abort.abort();
  }, [client, only, epoch, attempt]);

  useEffect(() => () => more.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const abort = new AbortController();
    more.current = abort;
    setLoadingMore(true);
    client.timeline({ ...timelineQuery(only), cursor }, { signal: abort.signal }).then(
      (page) => {
        setEvents((prev) => {
          const have = new Set(prev.map((e) => e.id));
          return [...prev, ...page.events.filter((e) => !have.has(e.id))];
        });
        setCursor(page.nextCursor);
        setLoadingMore(false);
      },
      (e: unknown) => {
        if (isAbort(e)) return;
        setLoadingMore(false);
        setError(true);
      },
    );
  }, [client, cursor, loadingMore, only]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const hide = useCallback((ids: readonly string[]) => {
    setHidden((prev) => new Set([...prev, ...ids]));
    return () =>
      setHidden((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
  }, []);
  const shown = useMemo(
    () => (hidden.size === 0 ? events : events.filter((e) => !hidden.has(e.id))),
    [events, hidden],
  );

  return {
    events: shown,
    loading,
    loadingMore,
    error,
    hasMore: cursor !== null,
    lastSeenAt,
    loadMore,
    retry,
    hide,
  };
}
