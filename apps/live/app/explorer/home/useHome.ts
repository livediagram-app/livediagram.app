'use client';

// Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md "useHome").
//
// One read draws the first screen (GET /api/home); this browser's own opens of its local documents
// are read beside it and ranked in. A failed read is an error, never an empty Home: "we could not
// ask" and "there is nothing" are different answers (docs/specs/013-workspace/timeline.md §2.4).
// The read moves the Timeline's unread mark on the server, so a successful one clears the badge.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeGroup, HomeTimelineEntry } from '@livediagram/api-schema';
import { apiReadHome, apiReadHomeTimeline } from '@/lib/api-client';
import { offlineListOpens, type LocalOpenDocument } from '@/lib/offline/offline-opens';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { mergeJumpBackIn, type JumpBackInItem } from './home-model';

export type HomeStatus = 'loading' | 'ready' | 'error';
export type HomePaging = 'idle' | 'loading' | 'error';

export type HomeData = {
  status: HomeStatus;
  jumpBackIn: JumpBackInItem[];
  whatHappened: HomeGroup[];
  /** The person's own events as loaded, newest first; the view folds them. */
  timeline: HomeTimelineEntry[];
  hasMore: boolean;
  paging: HomePaging;
  /** The unread mark before this visit's first read; undefined when the person never looked. */
  lastSeenAt: number | undefined;
  retry: () => void;
  loadMore: () => void;
  retryMore: () => void;
};

type Loaded = {
  jumpBackIn: JumpBackInItem[];
  whatHappened: HomeGroup[];
  timeline: HomeTimelineEntry[];
  cursor: string | null;
};

const EMPTY: Loaded = { jumpBackIn: [], whatHappened: [], timeline: [], cursor: null };

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function localOpens(): Promise<LocalOpenDocument[]> {
  try {
    return await offlineListOpens();
  } catch (err) {
    console.warn('[home] local-opens-unavailable', err);
    return [];
  }
}

/** `onSeen` runs after each successful read: the server moved the unread mark. */
export function useHome(ownerId: string | null, onSeen: () => void): HomeData {
  const [status, setStatus] = useState<HomeStatus>('loading');
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [paging, setPaging] = useState<HomePaging>('idle');
  const [attempt, setAttempt] = useState(0);
  // From the first successful read only: that read moved the mark, so a later one reports nothing new.
  const [lastSeenAt, setLastSeenAt] = useState<{ at: number | undefined } | null>(null);
  const requestId = useRef(0);
  const pagingRef = useRef(false);
  const onSeenRef = useLatest(onSeen);

  useEffect(() => {
    if (!ownerId) return;
    const id = ++requestId.current;
    let live = true;
    void Promise.all([apiReadHome(ownerId, { tz: browserTimeZone() }), localOpens()]).then(
      ([home, local]) => {
        if (!live || id !== requestId.current) return;
        if (!home) {
          setStatus('error');
          return;
        }
        setLoaded({
          jumpBackIn: mergeJumpBackIn(home.jumpBackIn, local),
          whatHappened: home.whatHappened,
          timeline: home.timeline.items,
          cursor: home.timeline.nextCursor,
        });
        setPaging('idle');
        setStatus('ready');
        setLastSeenAt((held) => held ?? { at: home.lastSeenAt ?? undefined });
        onSeenRef.current();
      },
    );
    return () => {
      live = false;
    };
  }, [ownerId, attempt, onSeenRef]);

  const retry = useCallback(() => {
    track('Home', 'Loaded', 'Retry');
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchPage = useCallback(
    (cursor: string) => {
      if (!ownerId || pagingRef.current) return;
      pagingRef.current = true;
      setPaging('loading');
      const id = requestId.current;
      void apiReadHomeTimeline(ownerId, { cursor }).then((page) => {
        pagingRef.current = false;
        if (id !== requestId.current) return;
        if (!page) {
          console.warn('[home] page failed');
          setPaging('error');
          return;
        }
        track('Home', 'Loaded', 'More');
        setLoaded((prev) => {
          const seen = new Set(prev.timeline.map((e) => e.id));
          return {
            ...prev,
            timeline: [...prev.timeline, ...page.items.filter((e) => !seen.has(e.id))],
            cursor: page.nextCursor,
          };
        });
        setPaging('idle');
      });
    },
    [ownerId],
  );

  const loadMore = useCallback(() => {
    if (status !== 'ready' || paging !== 'idle' || !loaded.cursor) return;
    fetchPage(loaded.cursor);
  }, [status, paging, loaded.cursor, fetchPage]);

  const retryMore = useCallback(() => {
    if (status !== 'ready' || !loaded.cursor) return;
    track('Home', 'Loaded', 'Retry');
    fetchPage(loaded.cursor);
  }, [status, loaded.cursor, fetchPage]);

  return {
    status,
    jumpBackIn: loaded.jumpBackIn,
    whatHappened: loaded.whatHappened,
    timeline: loaded.timeline,
    hasMore: loaded.cursor !== null,
    paging,
    lastSeenAt: lastSeenAt?.at,
    retry,
    loadMore,
    retryMore,
  };
}
