// White Balance's picker (docs/specs/031-photo/photo-adjustments.md "The adjustments": press something that
// should be neutral grey): the next press on the photo in focus is taken for it, not for the tool in hand,
// and handed back as its colour. One press at a time; Escape or a second ask drops the first.
import { useSyncExternalStore } from 'react';

type Take = (rgb: [number, number, number]) => void;
let waiting: Take | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const fn of listeners) fn();
};

/** The next press on the photo is the neutral grey's, handed to `take`. */
export function pickNeutral(take: Take): void {
  waiting = take;
  notify();
}

/** The press's colour taken, if one was asked for: true when it was (the tool then does nothing). */
export function takeNeutral(rgb: [number, number, number] | null): boolean {
  const take = waiting;
  if (!take) return false;
  waiting = null;
  notify();
  if (rgb) take(rgb);
  return true;
}

export function cancelNeutral(): void {
  if (!waiting) return;
  waiting = null;
  notify();
}

export function useNeutralPicking(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => waiting !== null,
    () => false,
  );
}
