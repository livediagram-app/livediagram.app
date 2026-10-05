'use client';

// The editor's selection store in React (docs/specs/008-canvas/blueprints/selection-store.md): a
// provider per editor, and a subscription that re-renders a reader only when the slice it selected
// changed.

import { createContext, useContext, type ReactNode } from 'react';
import { useStoreSlice } from '@/hooks/ui/useStoreSlice';
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
  return useStoreSlice(useSelectionStore(), select, equal);
}
