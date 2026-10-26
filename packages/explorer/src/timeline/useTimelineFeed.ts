'use client';

// The Timeline's pages from the index (GET /timeline): the first page on arrival and whenever the app filter
// changes, then a page per Show More, each one bounded read. "This app" asks for the host app's events only;
// "All" for every app's. What counts as new is fixed by the first page of the visit (its `seenAt`), and the visit
// then marks the Timeline seen, so the next visit's New starts here. Coming back to the browser tab reads the first
// page again (at most once in 30 seconds, useReturnToTab, as the Inbox does) and merges it in at the head, keeping
// the pages loaded and the visit's `seenAt`. With `team`, it is that team's activity (`GET /timeline?team=`): the
// same pages, nothing marked seen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TIMELINE_PAGE,
  type App,
  type IndexClient,
  type TimelineEvent,
} from '@liveworkspace/index-client';
import type { AppFilter } from '../words';
import { useReturnToTab } from '../data/useReturnToTab';
import { mergeHead } from './merge';

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

const timelineQuery = (only: App | null, team: string | null) => ({
  ...(only ? { app: only } : {}),
  ...(team ? { team } : {}),
  limit: TIMELINE_PAGE,
});

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export function useTimelineFeed(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  epoch: number,
  /** Called once the visit has marked the Timeline seen, so a count of what is new can drop. */
  onSeen?: () => void,
  /** A team's activity in place of the reader's own Timeline: nothing is marked seen. */
  team: string | null = null,
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
  // How the first page went, for a return to the tab: merged in once it landed, read again whole if it failed.
  const first = useRef<'reading' | 'landed' | 'failed'>('reading');

  useEffect(() => {
    const abort = new AbortController();
    first.current = 'reading';
    more.current?.abort();
    setLoadingMore(false);
    setLoading(true);
    setError(false);
    client.timeline(timelineQuery(only, team), { signal: abort.signal }).then(
      (page) => {
        first.current = 'landed';
        setEvents(page.events);
        setCursor(page.nextCursor);
        setLoading(false);
        if (!seenFixed.current && !team) {
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
        first.current = 'failed';
        setLoading(false);
        setError(true);
      },
    );
    return () => abort.abort();
  }, [client, only, team, epoch, attempt]);

  // Back to the tab: the first page again, merged in at the head, the pages and cursor as they are. A failure keeps
  // what is shown. A feed whose first page failed reads again whole, which is how it recovers on its own.
  const [returned, setReturned] = useState(0);
  useReturnToTab(() => {
    if (first.current === 'failed') setAttempt((n) => n + 1);
    else if (first.current === 'landed') setReturned((n) => n + 1);
  });
  useEffect(() => {
    if (returned === 0) return;
    const abort = new AbortController();
    client.timeline(timelineQuery(only, team), { signal: abort.signal }).then(
      (page) => setEvents((prev) => mergeHead(prev, page.events)),
      () => {},
    );
    return () => abort.abort();
    // Only a return reads again; the first-page effect covers a change of app, team or epoch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  useEffect(() => () => more.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const abort = new AbortController();
    more.current = abort;
    setLoadingMore(true);
    client.timeline({ ...timelineQuery(only, team), cursor }, { signal: abort.signal }).then(
      (page) => {
        setEvents((prev) => {
          const have = new Set(prev.map((e) => e.id));
          return [...prev, ...page.events.filter((e) => !have.has(e.id))];
        });
        setCursor(page.nextCursor);
        setLoadingMore(false);
      },
      // A failed next page leaves what is shown and its cursor, so Show More asks again. `error` is the first
      // page's alone: set here, it put the panel's whole Timeline behind "could not load" and a retry from page one.
      (e: unknown) => {
        if (isAbort(e)) return;
        setLoadingMore(false);
      },
    );
  }, [client, cursor, loadingMore, only, team]);

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
