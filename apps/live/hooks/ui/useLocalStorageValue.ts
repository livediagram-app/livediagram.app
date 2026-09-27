'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

// A per-device localStorage string as an external store
// (docs/specs/003-system-architecture/react-state-and-effects.md): every
// reader of a key re-renders when it is written here, in this tab, or in
// another tab (the native `storage` event), so two hooks over one key can
// never disagree. The server and hydration snapshot is null, so a static
// export never reads localStorage during the render it hydrates.
//
// A write that localStorage refuses (quota, private browsing) still applies
// in memory for the session, which is the degradation every caller accepts.

const listeners = new Map<string, Set<() => void>>();
const written = new Map<string, string>();
let storageAttached = false;

function notify(key: string): void {
  for (const fn of listeners.get(key) ?? []) fn();
}

function onStorage(e: StorageEvent): void {
  // A null key is `localStorage.clear()` in another tab: every key changed.
  if (e.key === null) {
    written.clear();
    for (const key of listeners.keys()) notify(key);
    return;
  }
  written.delete(e.key);
  notify(e.key);
}

function subscribeKey(key: string, cb: () => void): () => void {
  if (!storageAttached) {
    storageAttached = true;
    window.addEventListener('storage', onStorage);
  }
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(key);
  };
}

export function readLocalStorageValue(key: string): string | null {
  return written.get(key) ?? readLocalStorageSafe(key);
}

export function writeLocalStorageValue(key: string, value: string): void {
  written.set(key, value);
  writeLocalStorageSafe(key, value);
  notify(key);
}

const serverSnapshot = (): null => null;

export function useLocalStorageValue(key: string): string | null {
  const subscribe = useCallback((cb: () => void) => subscribeKey(key, cb), [key]);
  const getSnapshot = useCallback(() => readLocalStorageValue(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
