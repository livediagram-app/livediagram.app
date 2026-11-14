'use client';

// Run a callback a beat after an api write signal (write-signal.ts), so a screen that mirrors server state can
// re-read itself without the person pressing refresh.
//
// Two timings, both deliberate:
//
//   - A short DELAY before the first run, so the index's merge has landed before the re-read.
//   - A MIN INTERVAL between runs, trailing: signals inside the interval collapse into one run at its end, so the
//     last signal is always followed by a read and no read is wasted.
//
// The callback is held in a ref so a caller can pass an inline arrow
// without re-subscribing on every render, matching useReturnToTab.

import { useEffect, useRef } from 'react';
import { subscribeApiWrites, type ApiWriteSignal } from '../../lib/api/write-signal';

export const AFTER_WRITE_DELAY_MS = 1_000;
const AFTER_WRITE_MIN_INTERVAL_MS = 5_000;

export function useAfterApiWrite(
  onWrite: (signal: ApiWriteSignal) => void,
  opts: {
    enabled?: boolean;
    delayMs?: number;
    minIntervalMs?: number;
    // Only signals it accepts count (the legacy-claim views take `claimed` ones only).
    filter?: (signal: ApiWriteSignal) => boolean;
  } = {},
): void {
  const {
    enabled = true,
    delayMs = AFTER_WRITE_DELAY_MS,
    minIntervalMs = AFTER_WRITE_MIN_INTERVAL_MS,
  } = opts;
  const filter = useRef(opts.filter);
  useEffect(() => {
    filter.current = opts.filter;
  });
  const callback = useRef(onWrite);
  useEffect(() => {
    callback.current = onWrite;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;

    const unsubscribe = subscribeApiWrites((signal) => {
      if (filter.current && !filter.current(signal)) return;
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
