'use client';

// One shared clock for the page (docs/specs/026-plan/item-types.md "Time Spent", Ticking): it ticks once a second,
// only while some running timer's readout is drawn, and only those readouts subscribe, so a board never redraws for a
// ticking timer. The first subscriber starts it, the last one leaving stops it.
import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = Date.now();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const snapshot = () => now;

// The page's now, in milliseconds, moving on each second while the caller is drawn.
export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// How many readouts are ticking now (a test's and a measurement's view).
export const tickingReadouts = (): number => listeners.size;
