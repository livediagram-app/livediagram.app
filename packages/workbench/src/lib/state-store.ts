// One value held outside React, written like React state and read through useStoreSlice: a stream that changes many
// times a second (peers' cursors and characters, docs/specs/008-canvas/canvas-performance.md "A collaborator moving
// renders what shows them, not the editor") renders only what subscribes to it, never the component that owns it.
// The setter takes a value or an updater, as setState does, so a caller written for React state keeps its shape; a
// set that hands back the same value notifies nobody. Never written during render: a write notifies other components.

import type { SetStateAction } from 'react';
import { createListeners } from './listeners';

export type StateStore<T> = {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
  set: (next: SetStateAction<T>) => void;
};

export function createStateStore<T>(initial: T): StateStore<T> {
  let current = initial;
  const listeners = createListeners();
  return {
    get: () => current,
    subscribe: listeners.subscribe,
    set(next) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
      if (Object.is(value, current)) return;
      current = value;
      listeners.notify();
    },
  };
}
