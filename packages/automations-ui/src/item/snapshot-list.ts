'use client';

// An item's snapshots as Revert to Snapshot picks them (blueprint item-ui.md "Performance": Reads): read once while
// the screen is open, and only when something shows them (a Revert panel asks, or a listed rule names a snapshot).
// The item kits' outline holds it (outline.ts), and an app whose outline is its own (liveplanner's) holds the same.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { onceStore, type OnceStore } from './once-store';
import type { ItemSnapshot, ItemSnapshots } from './types';

export type SnapshotListStore = OnceStore<ItemSnapshot>;

/** A store of read-once snapshot lists, by item: one a kit, made once. */
export const snapshotListStore = (): SnapshotListStore => onceStore<ItemSnapshot>();

/** The item's snapshots from `store`: `read` asks the app's snapshots route; `wanted` reads them at once. The list
 *  lives while a holder shows it and goes with the last. */
export function useSnapshotList(
  store: SnapshotListStore,
  id: string,
  read: () => Promise<readonly ItemSnapshot[]>,
  wanted: boolean,
): ItemSnapshots {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(id, listener),
    [store, id],
  );
  const get = useCallback(() => store.get(id), [store, id]);
  const state = useSyncExternalStore(subscribe, get, get);
  const ask = useCallback(() => store.ask(id, read), [store, id, read]);
  const retry = useCallback(() => store.retry(id, read), [store, id, read]);
  useEffect(() => store.hold(id), [store, id]);
  useEffect(() => {
    if (wanted) ask();
  }, [wanted, ask]);
  return useMemo(
    () => ({ status: state.status, list: state.list, ask, retry }),
    [state, ask, retry],
  );
}
