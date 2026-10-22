// The lock icon shaken when a lock refuses a change (docs/specs/031-photo/photo-tools.md "Shared gestures
// and options": "<name> is locked." with the icon shaking): the layer's id and a count, so a second refusal
// restarts the shake. A view, never an edit.
import { useSyncExternalStore } from 'react';

let shaking: { layerId: string; n: number } | null = null;
let count = 0;
const listeners = new Set<() => void>();

/** The layer's lock shaken now. */
export function shakeLock(layerId: string): void {
  shaking = { layerId, n: ++count };
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The shake's count while `layerId`'s lock is the one shaken (a key that restarts it), else 0. */
export function useLockShake(layerId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => (shaking?.layerId === layerId ? shaking.n : 0),
    () => 0,
  );
}
