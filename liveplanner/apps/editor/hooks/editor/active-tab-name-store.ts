'use client';

// The open tab's name, for the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name"): published by
// usePlanCoverWiring as the tab opens or is renamed, read by TabNameInBox. A module store, like plan-tab-list-store.ts.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { createListeners } from '@/lib/listeners';

let name = '';
const listeners = createListeners();

export function setActiveTabName(next: string): void {
  if (next === name) return;
  name = next;
  listeners.notify();
}

const get = () => name;
const none = () => '';
export function useActiveTabName(): string {
  return useSyncExternalStore(listeners.subscribe, get, none);
}

// Renaming the open tab from the menu box (a click on its name), for someone who may change the project's tabs; null
// otherwise. Published by the editor through usePublishTabRename, stable while the tab is the same. `tabId` names the
// tab it renames, so a draft begun on one tab is never saved onto the next.
export type TabRename = { tabId: string; rename: (name: string) => void };
let rename: TabRename | null = null;
const renameListeners = new Set<() => void>();

function setActiveTabRename(next: TabRename | null): void {
  if (next === rename) return;
  rename = next;
  for (const l of renameListeners) l();
}

function subscribeRename(listener: () => void): () => void {
  renameListeners.add(listener);
  return () => renameListeners.delete(listener);
}

const getRename = () => rename;
const noRename = () => null;
export function useActiveTabRename(): TabRename | null {
  return useSyncExternalStore(subscribeRename, getRename, noRename);
}

// The tab the menu box renames now (null when none may be): read when a draft is saved, so a draft from a tab that
// is no longer open is dropped.
export function activeTabRenameId(): string | null {
  return rename?.tabId ?? null;
}

export function usePublishTabRename(
  activeId: string,
  renameTab: (id: string, name: string) => void,
  canRename: boolean,
): void {
  const latest = useLatest(renameTab);
  useLayoutEffect(() => {
    setActiveTabRename(
      canRename ? { tabId: activeId, rename: (name) => latest.current(activeId, name) } : null,
    );
    return () => setActiveTabRename(null);
  }, [activeId, canRename, latest]);
}
