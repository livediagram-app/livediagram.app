// The one minute timer every World Clock on the canvas reads (docs/specs/009-elements/social-pieces.md "World
// Clock"): a module store whose value is the current minute, moved on by a single timeout armed for the next whole
// minute while at least one clock is subscribed, and cleared when the last one goes. Nothing runs per frame and no
// clock keeps an interval of its own.

import { useSyncExternalStore } from 'react';

const MINUTE_MS = 60_000;

let now = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** The epoch ms of the start of the minute `at` falls in. */
export function minuteOf(at: number): number {
  return at - (at % MINUTE_MS);
}

function arm(): void {
  const at = Date.now();
  now = minuteOf(at);
  timer = setTimeout(
    () => {
      timer = null;
      if (listeners.size === 0) return;
      arm();
      for (const listener of [...listeners]) listener();
    },
    MINUTE_MS - (at % MINUTE_MS) + 20,
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) arm();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

function snapshot(): number {
  // Read before any subscriber armed the timer (the first render): the minute as it is now.
  if (!timer) now = minuteOf(Date.now());
  return now;
}

/** The start of the current minute, epoch ms; re-renders the caller once a minute, all clocks together. */
export function useMinuteNow(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}

/** How many timers are armed (tests): one at most, however many clocks. */
export function armedMinuteTimers(): number {
  return timer ? 1 : 0;
}
