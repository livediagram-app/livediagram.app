// Where the pointer is over the photo in focus (photo px), for the Photo panel's info line; null off
// it. A tiny store, so a move redraws only the line.
import { useSyncExternalStore } from 'react';

type P = { x: number; y: number } | null;
let at: P = null;
const listeners = new Set<() => void>();

export const photoPointer = {
  get: (): P => at,
  set(next: P): void {
    if (
      next === at ||
      (next &&
        at &&
        Math.floor(next.x) === Math.floor(at.x) &&
        Math.floor(next.y) === Math.floor(at.y))
    )
      return;
    at = next;
    for (const fn of listeners) fn();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Whether a press on the photo is under way (a stroke, a drag): the photo's commands wait for its end.
let pressing = false;
export const photoPress = {
  get: (): boolean => pressing,
  set(next: boolean): void {
    pressing = next;
  },
};

export function usePhotoPointer(): P {
  return useSyncExternalStore(
    (fn) => photoPointer.subscribe(fn),
    photoPointer.get,
    () => null,
  );
}
