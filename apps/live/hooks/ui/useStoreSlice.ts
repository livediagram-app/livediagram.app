'use client';

// A subscription to one slice of an external store (the selection, the viewport): the reader renders
// only when what it selected changed (docs/specs/008-canvas/blueprints/viewport-store.md). The last
// slice is kept per snapshot and selector, so an equal slice keeps its identity and
// useSyncExternalStore sees no change; a new selector (one closing over other data) selects again.

import { useRef, useSyncExternalStore } from 'react';

type Store<S> = { get(): S; subscribe(listener: () => void): () => void };

export function useStoreSlice<S, T>(
  store: Store<S>,
  select: (snapshot: S) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  const last = useRef<{ snapshot: S; select: (s: S) => T; value: T } | null>(null);
  const getSlice = () => {
    const snapshot = store.get();
    const prev = last.current;
    if (prev && prev.snapshot === snapshot && prev.select === select) return prev.value;
    const value = select(snapshot);
    if (prev && equal(prev.value, value)) {
      last.current = { snapshot, select, value: prev.value };
      return prev.value;
    }
    last.current = { snapshot, select, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, getSlice, getSlice);
}
