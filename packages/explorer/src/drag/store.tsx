'use client';

// The drag in progress in one Explorer (see drag.tsx): what is being dragged, held from dragstart to dragend, as an
// external store so a drag's start and end re-render only what subscribes.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Folder, Item } from '@liveworkspace/index-client';

export type Payload = { kind: 'item'; item: Item } | { kind: 'folder'; folder: Folder };
export type DragKind = Payload['kind'];

export type DragStore = {
  get: () => Payload | null;
  set: (payload: Payload | null) => void;
  subscribe: (listener: () => void) => () => void;
};

function createDragStore(): DragStore {
  let current: Payload | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (payload) => {
      if (payload === current) return;
      current = payload;
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const DragCtx = createContext<DragStore | null>(null);

/** Holds the drag in progress for one Explorer; a drag ends on dragend at its source, or on a drop anywhere. */
export function DragProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createDragStore);
  useEffect(() => {
    const end = () => store.set(null);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, [store]);
  return <DragCtx.Provider value={store}>{children}</DragCtx.Provider>;
}

export function useDragStore(): DragStore {
  const store = useContext(DragCtx);
  if (!store) throw new Error('drag outside <DragProvider>');
  return store;
}

const NO_KIND = () => null;

/** What is being dragged in this Explorer right now, if anything. */
export function useDragging(): DragKind | null {
  const store = useDragStore();
  return useSyncExternalStore(store.subscribe, () => store.get()?.kind ?? null, NO_KIND);
}
