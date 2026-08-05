'use client';

// The sidebar's unread-Timeline badge (spec/138 §2.5).
//
// Its own tiny hook, and its own endpoint, because the badge renders on
// every Explorer section: making it a field on the feed read would mean
// loading a feed nobody is looking at just to draw a number.
//
// Counts only OTHER people's events. A badge that goes up because you
// renamed something is noise — the question it answers is "did anything
// happen while I was away", and your own work is not that.

import { useCallback, useEffect, useState } from 'react';
import { apiTimelineUnread } from '@/lib/api-client';

export type TimelineUnread = {
  count: number;
  /** Call after the Timeline is opened, so the badge clears. */
  clear: () => void;
};

export function useTimelineUnread(ownerId: string | null): TimelineUnread {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ownerId) return;
    let live = true;
    void apiTimelineUnread(ownerId).then((n) => {
      if (live) setCount(n);
    });
    // Guards a stale response from a previous owner id landing after a
    // guest signs in and the hook re-runs.
    return () => {
      live = false;
    };
  }, [ownerId]);

  // Cleared locally rather than re-fetched: the read that renders the
  // Timeline is what moves the server's watermark, so asking again
  // immediately would race it and could redraw the badge it just
  // cleared.
  const clear = useCallback(() => setCount(0), []);

  return { count, clear };
}
