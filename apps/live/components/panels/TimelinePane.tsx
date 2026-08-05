'use client';

// The Explorer's Timeline section (spec/138 §2, §8).
//
// Owns the fetch, the paging cursor, and the refresh; the shared
// <Timeline> owns the layout, the mode switch, the filters, and the
// stacking. That split is why this file is short — everything about
// how a feed LOOKS lives in @livediagram/ui, and everything about
// where the events come from lives here.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Timeline, type TimelineEvent, type TimelineMode } from '@livediagram/ui';
import { TIMELINE_PAGE_MAX, TIMELINE_PAGE_SIZE } from '@livediagram/api-schema';
import { apiListTimeline, apiRefreshTimeline } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { TIMELINE_RENDERERS } from '@/app/explorer/timeline/renderers';
import { TimelineEmptyState } from './TimelineEmptyState';

// Was the Timeline where this page load STARTED, or somewhere the user
// navigated to afterwards? The landing-page change (spec/138 §8.1) is
// only measurable if the two are told apart.
//
// Captured from the URL at module evaluation, which runs before any
// client-side navigation can rewrite it. A session flag ("first mount
// wins") would get this wrong for someone who hard-loads /explorer/recent
// and clicks Timeline later — their first mount is a deliberate visit,
// not a landing.
const ENTRY_PATH = typeof window === 'undefined' ? '' : window.location.pathname;
const ARRIVED_ON_TIMELINE = /^\/explorer(\/timeline)?\/?$/.test(ENTRY_PATH);

export function TimelinePane({ ownerId }: { ownerId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Guards a late first-page response from overwriting a newer one when
  // the owner id changes (a guest signing in mid-session re-mounts this
  // with a different id, and the two fetches race).
  const requestId = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const id = (requestId.current += 1);
    setLoading(true);
    const page = await apiListTimeline(ownerId, { limit: TIMELINE_PAGE_SIZE });
    if (id !== requestId.current) return;
    setEvents(page.events);
    setCursor(page.nextCursor);
    setLastRefreshedAt(page.lastRefreshedAt);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  // Once per mount, not once per fetch: loadFirstPage also re-runs when
  // the owner id changes, and a guest signing in should not read as a
  // second visit.
  useEffect(() => {
    track('Timeline', 'Opened', ARRIVED_ON_TIMELINE ? 'Landing' : 'Nav');
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await apiListTimeline(ownerId, { cursor, limit: TIMELINE_PAGE_SIZE });
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
  }, [cursor, loadingMore, ownerId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const stamp = await apiRefreshTimeline(ownerId);
    // Ask for at least as much as is already on screen, capped, so a
    // reader who has paged three times doesn't get snapped back to one
    // page by clicking Refresh.
    const limit = Math.min(Math.max(TIMELINE_PAGE_SIZE, events.length), TIMELINE_PAGE_MAX);
    const page = await apiListTimeline(ownerId, { limit });
    setEvents(page.events);
    setCursor(page.nextCursor);
    setLastRefreshedAt(stamp ?? page.lastRefreshedAt);
    setRefreshing(false);
  }, [events.length, ownerId]);

  return (
    <Timeline
      events={events}
      viewerId={ownerId}
      // The Explorer's PaneHeader already says "Timeline" directly above.
      title={null}
      renderers={TIMELINE_RENDERERS}
      loading={loading}
      emptyState={<TimelineEmptyState />}
      hasMore={Boolean(cursor)}
      loadingMore={loadingMore}
      onLoadMore={() => void loadMore()}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      lastRefreshedAt={lastRefreshedAt}
      onModeChange={(mode: TimelineMode) =>
        track('Timeline', 'Changed', mode === 'calendar' ? 'Calendar' : 'List')
      }
      // The source type is a fixed token from a closed set, never user
      // content — the telemetry `type` slot has to stay renderable on
      // the public dashboard (spec/22).
      onFilterChange={(excluded) => {
        const last = excluded[excluded.length - 1];
        if (last) track('Timeline', 'Selected', last);
      }}
      onStackExpand={() => track('Timeline', 'Opened', 'Stack')}
    />
  );
}
