'use client';

// "The reader just changed something" — run a callback a beat after any
// successful api write, so a screen that mirrors server state (the
// Timeline, spec/138 §2.4b) can re-read itself without the reader
// pressing refresh.
//
// Two timings, both deliberate:
//
//   - A short DELAY before the first run. The worker writes the
//     timeline row off the response path (`ctx.waitUntil`), so a re-read
//     fired the instant the DELETE resolves usually lands before the
//     tombstone does, and shows the reader the feed minus the thing
//     they just did. A second's grace covers the emit chain with room
//     to spare.
//   - A MIN INTERVAL between runs, trailing. An editor autosaving every
//     600ms is a write storm, and a feed that re-read on every save
//     would be a request storm. Writes inside the interval collapse
//     into one run at its end, so the last write is always followed by
//     a read and no read is wasted.
//
// The callback is held in a ref so a caller can pass an inline arrow
// without re-subscribing on every render, matching useReturnToTab.

import { useEffect, useRef } from 'react';
import { subscribeApiWrites, type ApiWriteSignal } from '@/lib/api/write-signal';

export const AFTER_WRITE_DELAY_MS = 1_000;
export const AFTER_WRITE_MIN_INTERVAL_MS = 5_000;

export function useAfterApiWrite(
  onWrite: (signal: ApiWriteSignal) => void,
  opts: { enabled?: boolean; delayMs?: number; minIntervalMs?: number } = {},
): void {
  const {
    enabled = true,
    delayMs = AFTER_WRITE_DELAY_MS,
    minIntervalMs = AFTER_WRITE_MIN_INTERVAL_MS,
  } = opts;
  const callback = useRef(onWrite);
  useEffect(() => {
    callback.current = onWrite;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;

    const unsubscribe = subscribeApiWrites((signal) => {
      // A purge is handed over at once — the feed drops those cards
      // synchronously — and only the re-read that follows is throttled,
      // so a burst of deletes still costs one read.
      if (signal.purge) callback.current({ purge: signal.purge });
      if (timer) return;
      const wait = Math.max(delayMs, lastRun + minIntervalMs - Date.now());
      timer = setTimeout(() => {
        timer = null;
        lastRun = Date.now();
        callback.current({});
      }, wait);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, delayMs, minIntervalMs]);
}
