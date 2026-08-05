'use client';

// The Timeline's data + control state (spec/138 §8).
//
// Held in ExplorerPane rather than inside the pane component, because
// the two halves of the Timeline render in different places: the
// controls belong in the page-header row beside Help, and the feed
// belongs in the body. One hook keeps them reading the same state.
//
// Gated on `enabled` like the Explorer's other section hooks
// (useTokens, useTeams), so visiting Recent doesn't fetch a feed
// nobody is looking at.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTimelineControls,
  type TimelineControlsState,
  type TimelineEvent,
  type TimelineMode,
} from '@livediagram/ui';
import { TIMELINE_PAGE_SIZE } from '@livediagram/api-schema';
import { apiListTimeline } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Was the Timeline where this page load STARTED, or somewhere the user
// navigated to afterwards? The landing-page change (spec/138 §8.1) is
// only measurable if the two are told apart.
//
// Captured from the URL at module evaluation, which runs before any
// client-side navigation can rewrite it. A "first mount wins" flag
// would get this wrong for someone who hard-loads /explorer/recent and
// clicks Timeline later — their first mount is a deliberate visit.
const ENTRY_PATH = typeof window === 'undefined' ? '' : window.location.pathname;
const ARRIVED_ON_TIMELINE = /^\/explorer(\/timeline)?\/?$/.test(ENTRY_PATH);

export type TimelineFeed = {
  events: TimelineEvent[];
  controls: TimelineControlsState;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Watermark from the first read; events past it render as New. */
  lastSeenAt?: number;
};

export function useTimelineFeed(ownerId: string | null, enabled: boolean): TimelineFeed {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Captured from the FIRST read only. The server moves the watermark
  // forward on that read, so re-reading would report nothing new and
  // the New pills would vanish mid-visit.
  const [lastSeenAt, setLastSeenAt] = useState<number | undefined>();

  const controls = useTimelineControls(events, {
    viewerId: ownerId,
    onModeChange: useCallback(
      (mode: TimelineMode) =>
        track('Timeline', 'Changed', mode === 'calendar' ? 'Calendar' : 'List'),
      [],
    ),
    // The source type is a fixed token from a closed set, never user
    // content — the telemetry `type` slot has to stay renderable on the
    // public dashboard (spec/22).
    onFilterChange: useCallback((excluded: string[]) => {
      const last = excluded[excluded.length - 1];
      if (last) track('Timeline', 'Selected', last);
    }, []),
    onActorFilterChange: useCallback(
      (filter: 'all' | 'others') =>
        track('Timeline', 'Selected', filter === 'others' ? 'Others' : 'Everyone'),
      [],
    ),
  });

  // Guards a late first-page response from overwriting a newer one when
  // the owner id changes (a guest signing in mid-session re-runs this
  // with a different id, and the two fetches race).
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled || !ownerId) return;
    const id = (requestId.current += 1);
    setLoading(true);
    void apiListTimeline(ownerId, { limit: TIMELINE_PAGE_SIZE }).then((page) => {
      if (id !== requestId.current) return;
      setEvents(page.events);
      setCursor(page.nextCursor);
      // First value wins. The server holds the watermark still for a
      // visit window, but a re-read triggered by the owner id changing
      // would otherwise replace it with a newer one and drop the New
      // markers the reader hasn't looked at yet.
      setLastSeenAt((prev) => prev ?? page.lastSeenAt);
      setLoading(false);
    });
  }, [enabled, ownerId]);

  // Once per arrival, not once per fetch: the effect above also re-runs
  // when the owner id changes, and a guest signing in should not read
  // as a second visit.
  const reported = useRef(false);
  useEffect(() => {
    if (!enabled || reported.current) return;
    reported.current = true;
    track('Timeline', 'Opened', ARRIVED_ON_TIMELINE ? 'Landing' : 'Nav');
  }, [enabled]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore || !ownerId) return;
    setLoadingMore(true);
    void apiListTimeline(ownerId, { cursor, limit: TIMELINE_PAGE_SIZE }).then((page) => {
      setEvents((prev) => {
        // Dedupe on append. The feed grows at the head while a reader
        // pages down it, and although the keyset cursor makes a repeat
        // unlikely, a duplicate React key here would drop bubbles from
        // the render rather than merely showing one twice.
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.events.filter((e) => !seen.has(e.id))];
      });
      setCursor(page.nextCursor);
      setLoadingMore(false);
      track('Timeline', 'Loaded', 'More');
    });
  }, [cursor, loadingMore, ownerId]);

  return { events, controls, loading, loadingMore, hasMore: Boolean(cursor), loadMore, lastSeenAt };
}
