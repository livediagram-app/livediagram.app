import { useMemo, useSyncExternalStore } from 'react';

// The moment the current day was first seen, as a store that moves on at local midnight (and when the page is
// shown again, after a laptop sleeps through midnight), so a reading by the day (a metric's due or overdue count)
// rolls over without a reload. Stable for the whole day, so memos keyed on it recompute once a day. One timeout
// for every reader, re-armed each day: nothing ticks in between, and nothing reads the clock while rendering.

let seen = Date.now();
const listeners = new Set<() => void>();
// `window.setTimeout` returns a number in the DOM lib; pinned against @types/node's `Timeout`.
let timer: number | null = null;

/** Takes the new day when the clock has crossed into one, and tells every reader. */
function check(): void {
  const now = Date.now();
  if (new Date(now).toDateString() === new Date(seen).toDateString()) return;
  seen = now;
  for (const listener of listeners) listener();
}

/** Wakes a moment past the next midnight, so the new day has surely begun when it fires. */
function arm(): void {
  const day = new Date(seen);
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  timer = window.setTimeout(
    () => {
      check();
      arm();
    },
    next.getTime() - Date.now() + 50,
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    // Idle since the last reader left: catch up with the clock before waiting for midnight.
    check();
    arm();
    document.addEventListener('visibilitychange', check);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    document.removeEventListener('visibilitychange', check);
  };
}

const getSeen = () => seen;

export function useToday(): Date {
  const instant = useSyncExternalStore(subscribe, getSeen, getSeen);
  return useMemo(() => new Date(instant), [instant]);
}

// The clock to the minute, for a reading that turns at a time of day (a timed Due going overdue on the Gantt chart;
// plan-views.md "Times and ranges"); 0 while off. One interval for every reader while any is on, none otherwise, so a
// chart with no timed dates never ticks.
let minute = 0;
const minuteListeners = new Set<() => void>();
let minuteTimer: number | null = null;

function subscribeMinute(listener: () => void): () => void {
  minuteListeners.add(listener);
  if (minuteListeners.size === 1) {
    minute = Date.now();
    minuteTimer = window.setInterval(() => {
      minute = Date.now();
      for (const l of minuteListeners) l();
    }, 60_000);
  }
  return () => {
    minuteListeners.delete(listener);
    if (minuteListeners.size > 0 || minuteTimer === null) return;
    window.clearInterval(minuteTimer);
    minuteTimer = null;
  };
}

const noSubscribe = () => () => {};
const getMinute = () => minute;
const getOff = () => 0;

export function useMinute(on: boolean): number {
  return useSyncExternalStore(on ? subscribeMinute : noSubscribe, on ? getMinute : getOff, getOff);
}
