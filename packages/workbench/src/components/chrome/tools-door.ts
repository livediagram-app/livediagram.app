'use client';

// Rows a host adds to the footer's Tools popover from outside the footer's tree (liveworkspace/docs/specs/004-index/
// footer-tools-menu.md): the editor's Explorer host offers Webhooks and History for the open item, which the tab bar
// knows nothing about. A module store keyed by who published, so each host replaces its own rows and clears them as
// it unmounts; ChromeToolsMenu reads them beside the rows it is handed.
import { useEffect, useSyncExternalStore } from 'react';
import type { ChromeToolsItem } from './ChromeToolsMenu';

const published = new Map<string, readonly ChromeToolsItem[]>();
let snapshot: readonly ChromeToolsItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...published.values()].flat();
  for (const l of listeners) l();
}

/** Puts `items` in Tools under `key` while the caller is mounted (an empty list clears them). */
export function usePublishToolsItems(key: string, items: readonly ChromeToolsItem[]): void {
  useEffect(() => {
    if (items.length) published.set(key, items);
    else published.delete(key);
    emit();
    return () => {
      published.delete(key);
      emit();
    };
  }, [key, items]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const NONE: readonly ChromeToolsItem[] = [];

/** Every row published from outside the footer. */
export function useToolsDoorItems(): readonly ChromeToolsItem[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => NONE);
}
