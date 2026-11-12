// This Browser's list and folders as the app last wrote them on its own origin, read through
// useSyncExternalStore so a reader re-renders only when the stored list changes. ThisBrowser.tsx re-exports the hooks.

import { useCallback, useSyncExternalStore } from 'react';
import type { App } from '@liveworkspace/index-client';
import {
  parseThisBrowserStore,
  subscribeThisBrowser,
  thisBrowserKey,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from '../this-browser';

// The list as the app last wrote it, per app, parsed again only when its stored text changes: one stable array per
// change, so a reader re-renders only when the list does.
export const NO_ITEMS: readonly ThisBrowserItem[] = [];
const NO_FOLDERS: readonly ThisBrowserFolder[] = [];
type Snapshot = {
  raw: string | null;
  items: readonly ThisBrowserItem[];
  folders: readonly ThisBrowserFolder[];
};
const EMPTY_SNAPSHOT: Snapshot = { raw: null, items: NO_ITEMS, folders: NO_FOLDERS };
const reads = new Map<App, Snapshot>();
function snapshotOf(app: App): Snapshot {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(thisBrowserKey(app));
  } catch {
    return EMPTY_SNAPSHOT;
  }
  const kept = reads.get(app);
  if (kept?.raw === raw) return kept;
  const parsed = raw ? parseThisBrowserStore(raw) : null;
  const next: Snapshot = {
    raw,
    items: parsed?.items.length ? parsed.items : NO_ITEMS,
    folders: parsed?.folders.length ? parsed.folders : NO_FOLDERS,
  };
  reads.set(app, next);
  return next;
}
const snapshot = (app: App) => snapshotOf(app).items;
const folderSnapshot = (app: App) => snapshotOf(app).folders;

/** The app's This Browser list on its own origin (every item, live and trashed, newest change first), heard as it
 *  changes in this tab or another. Empty for no app, and while prerendered. */
export function useThisBrowserList(app: App | null): readonly ThisBrowserItem[] {
  const subscribe = useCallback(
    (onChange: () => void) => (app ? subscribeThisBrowser(app, onChange) : () => {}),
    [app],
  );
  return useSyncExternalStore(
    subscribe,
    () => (app ? snapshot(app) : NO_ITEMS),
    () => NO_ITEMS,
  );
}

/** This Browser's folders on the app's own origin, heard as they change: one parse per change of the stored list,
 *  shared with useThisBrowserList. Empty for no app, and while prerendered. */
export function useThisBrowserFolders(app: App | null): readonly ThisBrowserFolder[] {
  const subscribe = useCallback(
    (onChange: () => void) => (app ? subscribeThisBrowser(app, onChange) : () => {}),
    [app],
  );
  return useSyncExternalStore(
    subscribe,
    () => (app ? folderSnapshot(app) : NO_FOLDERS),
    () => NO_FOLDERS,
  );
}
