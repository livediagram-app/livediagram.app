// A Fine Tune gesture in progress (docs/specs/011-theme/page-designs.md "Performance"): each tick of a Page Design
// slider marks it, and it settles SETTLE_MS after the last tick. While it runs, only the pages on screen redraw
// (usePageDesignViews), so a flowing design on a long deck stays smooth; the rest catch up when it settles.
import { useSyncExternalStore } from 'react';

export const SETTLE_MS = 250;

let tuning = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A tick of a Fine Tune control: the gesture is on, and settles SETTLE_MS after the last tick. */
export function markDesignTuning(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    tuning = false;
    emit();
  }, SETTLE_MS);
  if (!tuning) {
    tuning = true;
    emit();
  }
}

export function isDesignTuning(): boolean {
  return tuning;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a Fine Tune gesture is running. */
export function useDesignTuning(): boolean {
  return useSyncExternalStore(subscribe, isDesignTuning, () => false);
}
