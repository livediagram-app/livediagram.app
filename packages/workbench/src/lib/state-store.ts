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

/** A store's read side: what useStoreSlice subscribes to. */
export type ReadableStore<T> = Pick<StateStore<T>, 'get' | 'subscribe'>;

/**
 * Two stores read as one pair, for a slice that needs both (who stands on a stage: your character's pose and the
 * peers'). The pair keeps its identity until either value changes, and a change to either notifies.
 */
export function joinStores<A, B>(
  a: ReadableStore<A>,
  b: ReadableStore<B>,
): ReadableStore<readonly [A, B]> {
  let pair: readonly [A, B] = [a.get(), b.get()];
  return {
    get() {
      const left = a.get();
      const right = b.get();
      if (left !== pair[0] || right !== pair[1]) pair = [left, right];
      return pair;
    },
    subscribe(listener) {
      const offA = a.subscribe(listener);
      const offB = b.subscribe(listener);
      return () => {
        offA();
        offB();
      };
    },
  };
}

/**
 * A store's value seen through `select`: worked out once per value of `source` and kept, so a reader subscribed to it
 * renders only when the source changes. What a peer streams (laser trails) reaches the one layer that draws it, joined
 * with what the editor renders (docs/specs/008-canvas/canvas-performance.md); a new `select` (other render inputs) is
 * a new store, made with useMemo.
 */
export function mapStore<S, T>(
  source: ReadableStore<S>,
  select: (value: S) => T,
): ReadableStore<T> {
  let last: { from: S; value: T } | null = null;
  return {
    get() {
      const from = source.get();
      if (last && Object.is(last.from, from)) return last.value;
      last = { from, value: select(from) };
      return last.value;
    },
    subscribe: source.subscribe,
  };
}
