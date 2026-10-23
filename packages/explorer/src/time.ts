// Relative times, worded as liveplanner's Explorer words them ("2 hours ago", "yesterday"), read off one shared
// clock so every row on a page agrees and refreshes on the same tick.

import { useSyncExternalStore } from 'react';

function ladder(deltaMs: number, secs: (n: number) => string, mins: (n: number) => string) {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return secs(seconds);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return mins(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function relativeSince(at: number, now: number): string {
  return ladder(
    now - at,
    (n) => `${n} secs ago`,
    (n) => `${n} mins ago`,
  );
}

export function relativeShort(at: number, now: number): string {
  return ladder(
    now - at,
    (n) => `${n}s ago`,
    (n) => `${n} min ago`,
  );
}

export function timeLeftCompact(deltaMs: number): string {
  if (deltaMs <= 0) return 'expired';
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = Date.now();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const fn of listeners) fn();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The shared clock's instant: one interval for every subscriber. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}
