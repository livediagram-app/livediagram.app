'use client';

// The editor's selection store in React (docs/specs/008-canvas/blueprints/selection-store.md): a
// provider per editor, and a subscription that re-renders a reader only when the slice it selected
// changed.

import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Selection, SelectionStore } from '@/lib/selection-store';

const SelectionStoreContext = createContext<SelectionStore | null>(null);

export function SelectionStoreProvider({
  store,
  children,
}: {
  store: SelectionStore;
  children: ReactNode;
}) {
  return <SelectionStoreContext.Provider value={store}>{children}</SelectionStoreContext.Provider>;
}

export function useSelectionStore(): SelectionStore {
  const store = useContext(SelectionStoreContext);
  if (!store) throw new Error('SelectionStoreMissing: [selection] store missing');
  return store;
}

export function useSelectionOf<T>(
  select: (s: Selection) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useSelectionStore();
  // The last slice handed out, per snapshot and selector: an equal slice keeps its identity, so
  // useSyncExternalStore sees no change and the reader does not re-render. A new selector (one that
  // closes over other data) selects again.
  const last = useRef<{ snapshot: Selection; select: (s: Selection) => T; value: T } | null>(null);
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
