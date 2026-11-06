// The one ticker every running Timer and Stopwatch face reads (docs/specs/009-elements/timer-and-stopwatch.md "The
// one ticker"): a module store whose value is the time of its last tick, moved on by a single 250 ms interval while
// at least one running face is subscribed and still short of its end, and the browser tab is shown. A paused or idle
// face does not subscribe, a Timer past its end no longer keeps the interval going, a hidden tab stops the interval
// (and ticks at once when it is shown again), and the last face to go clears it. No face keeps an interval of its own.
//
// Each face hands `useTickerValue` a read of its own readout from the tick's time, so React re-renders a face only
// when its text changes (once a second), not on every tick: useSyncExternalStore keeps the render when the
// snapshot is the same string.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export const TICK_MS = 250;

let now = 0;
let interval: ReturnType<typeof setInterval> | null = null;
// Each listener and the time past which it needs no more ticks (Infinity for a Stopwatch).
const listeners = new Map<() => void, number>();
let watchingVisibility = false;

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/** Whether a face still wants ticks at `at`. */
function wanted(at: number): boolean {
  for (const until of listeners.values()) if (until > at) return true;
  return false;
}

function tick(): void {
  now = Date.now();
  for (const listener of [...listeners.keys()]) listener();
  // Every face has reached its end (a Timer at 0:00): nothing more to show until a press restarts one.
  if (!wanted(now)) stop();
}

function start(): void {
  if (interval || hidden() || !wanted(Date.now())) return;
  now = Date.now();
  interval = setInterval(tick, TICK_MS);
}

function stop(): void {
  if (!interval) return;
  clearInterval(interval);
  interval = null;
}

function onVisibility(): void {
  if (hidden()) {
    stop();
    return;
  }
  // Shown again: catch every face up at once, then keep ticking.
  if (listeners.size > 0) tick();
  start();
}

function subscribe(listener: () => void, until: number): () => void {
  listeners.set(listener, until);
  if (!watchingVisibility && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    watchingVisibility = true;
  }
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stop();
    if (watchingVisibility) {
      document.removeEventListener('visibilitychange', onVisibility);
      watchingVisibility = false;
    }
  };
}

const noSubscribe = () => () => {};

/** The time to read a face at: the last tick while ticking, else the clock now. */
export function tickerNow(): number {
  return interval ? now : Date.now();
}

/**
 * A face's value from the ticker's time. `active` (a running piece) subscribes it to the ticker until `until` (a
 * running Timer's end; Infinity when it has none); inactive, it reads once and costs nothing. `read` must return a
 * primitive (the readout), so equal ticks keep the render.
 */
export function useTickerValue<T extends string | number | boolean>(
  active: boolean,
  read: (now: number) => T,
  until = Infinity,
): T {
  const snapshot = useCallback(() => read(tickerNow()), [read]);
  const subscribeUntil = useMemo(
    () => (active ? (listener: () => void) => subscribe(listener, until) : noSubscribe),
    [active, until],
  );
  return useSyncExternalStore(subscribeUntil, snapshot, snapshot);
}

/** How many intervals are running (tests): one at most, however many faces. */
export function runningTickers(): number {
  return interval ? 1 : 0;
}
