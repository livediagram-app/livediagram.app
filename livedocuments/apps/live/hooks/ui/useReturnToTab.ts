'use client';

// "The reader just came back" — the document becoming visible again, or
// the browser reporting the network back.
//
// Its own hook because the two events mean the same thing to a caller
// (re-check whatever you fetched on mount) and neither is useful raw:
// alt-tabbing fires visibilitychange constantly, so an unthrottled
// listener turns a glance at another window into a request storm. The
// throttle is the whole point of wrapping them.
//
// The callback is held in a ref, so a caller can pass an inline arrow
// without re-subscribing the listeners on every render.

import { useEffect, useRef } from 'react';

export function useReturnToTab(
  onReturn: () => void,
  opts: { enabled?: boolean; minIntervalMs?: number } = {},
): void {
  const { enabled = true, minIntervalMs = 30_000 } = opts;
  const callback = useRef(onReturn);
  // In an effect rather than during render: a ref written while
  // rendering is a lie about when the value changed, and React's own
  // lint rule says so. Deps are omitted deliberately — the point is to
  // track the LATEST callback on every commit.
  useEffect(() => {
    callback.current = onReturn;
  });
  // Seeded on mount rather than at 0: a mount usually IS a fetch, and a
  // tab that gets focus a second later shouldn't immediately repeat it.
  const lastRun = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    lastRun.current = Date.now();

    const run = () => {
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      callback.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    document.addEventListener('visibilitychange', onVisible);
    // Coming back online is the other half of the same story, and it's
    // the one that fires when a laptop wakes with the tab already in
    // front — where visibilitychange never happens at all.
    window.addEventListener('online', run);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
    };
  }, [enabled, minIntervalMs]);
}
