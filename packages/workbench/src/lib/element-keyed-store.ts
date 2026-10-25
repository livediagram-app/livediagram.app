import { useSyncExternalStore } from 'react';
import { createListeners } from './listeners';

// A module store holding one value for one element at a time, read per element: a reader subscribes with its own
// element id and re-renders only when the value for that element comes, changes or goes. Element tours use it for
// what a step shows on the element it is on (docs/specs/007-editor/element-tours.md): a Sankey band lifted, a concept
// graphic's animation previewed. One editor per page, at most one tour running.
type ElementKeyedStore<T extends { elementId: string }> = {
  set: (next: T | null) => void;
  get: () => T | null;
  use: (elementId: string | null) => T | null;
};

export function createElementKeyedStore<T extends { elementId: string }>(
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): ElementKeyedStore<T> {
  let current: T | null = null;
  const listeners = createListeners();
  return {
    set: (next) => {
      if (next === current || (next && current && same(next, current))) return;
      current = next;
      listeners.notify();
    },
    get: () => current,
    use: (elementId) =>
      useSyncExternalStore(
        listeners.subscribe,
        () => (elementId !== null && current?.elementId === elementId ? current : null),
        () => null,
      ),
  };
}
