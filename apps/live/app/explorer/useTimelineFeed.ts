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
  type TimelineCategory,
  type TimelineControlsState,
  type TimelineEvent,
  type TimelineMode,
} from '@livediagram/ui';
import {
  TIMELINE_PAGE_MAX,
  TIMELINE_PAGE_SIZE,
  type TimelineScopeRef,
} from '@livediagram/api-schema';
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

// `#event=<id>` on the Timeline URL. Read once at module scope for the
// same reason ENTRY_PATH is: the hash is what the page was OPENED with,
// and a later in-app navigation shouldn't resurrect an old target.
const ENTRY_HASH = typeof window === 'undefined' ? '' : window.location.hash;
const FOCUS_EVENT_ID = /^#event=(.+)$/.exec(ENTRY_HASH)?.[1];

export type TimelineFeed = {
  events: TimelineEvent[];
  controls: TimelineControlsState;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Watermark from the first read; events past it render as New. */
  lastSeenAt?: number;
  /** Deep-link target from the URL hash, if the page was opened with one. */
  focusEventId?: string;
};

export function useTimelineFeed(
  ownerId: string | null,
  enabled: boolean,
  // Omitted for the reader's own feed. A team scope reads that team's
  // whole history, including what happened before the reader joined —
  // the per-member scopes only carry events from after they arrived.
  scope?: TimelineScopeRef,
): TimelineFeed {
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
    // The category id is a fixed token from a closed set, never user
    // content — the telemetry `type` slot has to stay renderable on the
    // public dashboard (spec/22).
    onFilterChange: useCallback((excluded: TimelineCategory[]) => {
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
  // Which on-demand periods this feed has already fetched (see the period
  // effect below). Declared up here because the first-page effect clears it:
  // that effect's dependencies are the feed's identity, so its re-run is
  // exactly the moment the cache stops applying.
  const fetchedRanges = useRef(new Set<string>());
  // A stable dependency for the effects: `scope` is an object literal at
  // most call sites, so depending on it directly would refetch on every
  // parent render.
  const scopeKey = scope ? `${scope.scopeType}:${scope.scopeId}` : '';

  useEffect(() => {
    if (!enabled || !ownerId) return;
    const id = (requestId.current += 1);
    setLoading(true);
    // This effect's deps ARE the feed's identity, so its re-run is exactly
    // when the period cache below stops applying: it remembers which periods
    // have been fetched, keyed on the period alone, and `setEvents` here
    // replaces the list wholesale. Left uncleared, switching team A -> B and
    // paging to a month already visited on A found the period marked fetched,
    // returned early, and rendered an empty grid — telling the reader nothing
    // happened in team B that month. Same trap when ownerId changes as a
    // guest signs in.
    fetchedRanges.current.clear();
    void apiListTimeline(ownerId, { limit: TIMELINE_PAGE_SIZE, scope }).then((page) => {
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
  }, [enabled, ownerId, scopeKey]);

  // Once per arrival, not once per fetch: the effect above also re-runs
  // when the owner id changes, and a guest signing in should not read
  // as a second visit.
  const reported = useRef(false);
  useEffect(() => {
    if (!enabled || reported.current) return;
    reported.current = true;
    track('Timeline', 'Opened', ARRIVED_ON_TIMELINE ? 'Landing' : 'Nav');
  }, [enabled]);

  // Calendar and week views can be paged to a period the loaded pages
  // don't reach — a reader clicking back four months would otherwise see
  // an empty grid and conclude nothing happened. So the visible period
  // is fetched on demand and MERGED into the same list, which means the
  // list view picks the events up too rather than the two views holding
  // different data.
  //
  // Ranges already fetched are remembered, so paging back and forth over
  // the same months doesn't re-request them. Scoped to one feed's lifetime:
  // the first-page effect clears the set whenever the scope or owner
  // changes.
  useEffect(() => {
    if (!enabled || !ownerId) return;
    const mode = controls.mode;
    if (mode !== 'calendar' && mode !== 'week') return;
    const period = mode === 'week' ? controls.weekKey : controls.monthKey;
    if (fetchedRanges.current.has(period)) return;
    fetchedRanges.current.add(period);
    const { from, to } = periodBounds(mode, period);
    void apiListTimeline(ownerId, { from, to, limit: TIMELINE_PAGE_MAX, scope }).then((page) => {
      if (page.events.length === 0) return;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = page.events.filter((e) => !seen.has(e.id));
        if (fresh.length === 0) return prev;
        // Re-sorted because a fetched range can predate what's loaded,
        // and the grouping relies on newest-first input to place a
        // collapsed stack at its most recent member.
        return [...prev, ...fresh].sort((a, b) => b.occurredAt - a.occurredAt);
      });
    });
  }, [enabled, ownerId, controls.mode, controls.monthKey, controls.weekKey, scope, scopeKey]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore || !ownerId) return;
    setLoadingMore(true);
    void apiListTimeline(ownerId, { cursor, limit: TIMELINE_PAGE_SIZE, scope }).then((page) => {
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
  }, [cursor, loadingMore, ownerId, scopeKey]);

  return {
    events,
    controls,
    loading,
    loadingMore,
    hasMore: Boolean(cursor),
    loadMore,
    lastSeenAt,
    focusEventId: FOCUS_EVENT_ID,
  };
}

// Epoch-ms bounds of the visible calendar period, in LOCAL time to match
// how the grid groups days — a UTC bound would clip an event at either
// edge into the neighbouring period for readers west of Greenwich.
function periodBounds(mode: 'calendar' | 'week', period: string): { from: number; to: number } {
  if (mode === 'week') {
    const [y, m, d] = period.split('-').map(Number);
    const start = new Date(y!, m! - 1, d!);
    const end = new Date(y!, m! - 1, d! + 7);
    return { from: start.getTime(), to: end.getTime() - 1 };
  }
  const [y, m] = period.split('-').map(Number);
  return { from: new Date(y!, m! - 1, 1).getTime(), to: new Date(y!, m!, 1).getTime() - 1 };
}
