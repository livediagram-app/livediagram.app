'use client';

// What a connected tab's page tells the tab bar (liveworkspace/docs/specs/004-index/connected-tabs.md "Opening", "How
// it looks"), across the editor without threading props through it: which connections the last open found broken, for
// the tab's amber dot and its menu's Connect Again (`setConnectedTabBroken`, `useConnectedTabBroken`,
// `connectedTabBroken`). A press on the tab tells the page nothing: the file opens only from the page's Open.
//
// One page-wide store: a few entries an item (at most CONNECTIONS_PER_ITEM broken ids), read with useSyncExternalStore
// so only the tab named re-renders.
import { useCallback, useSyncExternalStore } from 'react';

const broken = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The last open said this connection opens nothing (gone, its link removed, a copy's), or that it opens again. */
export function setConnectedTabBroken(connectionId: string, isBroken: boolean): void {
  if (broken.has(connectionId) === isBroken) return;
  if (isBroken) broken.add(connectionId);
  else broken.delete(connectionId);
  notify();
}

/** Whether the last open found this connection broken, read once (a menu building its rows). */
export const connectedTabBroken = (connectionId: string): boolean => broken.has(connectionId);

/** Whether the last open found this connection broken, kept current (the tab's amber dot). */
export function useConnectedTabBroken(connectionId: string): boolean {
  const read = useCallback(() => broken.has(connectionId), [connectionId]);
  return useSyncExternalStore(subscribe, read, () => false);
}

export function resetConnectedTabStoreForTests(): void {
  broken.clear();
  notify();
}
