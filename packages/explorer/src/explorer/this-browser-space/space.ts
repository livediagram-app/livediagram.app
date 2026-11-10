'use client';

// This Browser as a Space (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser, a Space"): whether it
// shows, its folders' verbs, and Sync keeping an item's place. Everything here reads this browser's storage through
// the hooks that parse it once per change (ThisBrowser.tsx); nothing asks the network.

import { useCallback } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import {
  createThisBrowserFolder,
  renameThisBrowserFolder,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from '../../this-browser';
import { useExplorer } from '../context';
import { useThisBrowserFolders, useThisBrowserItems, thenReload } from '../ThisBrowser';

/** The placement browser's id for This Browser, drawn as a space beside the teams. No team's id looks like it. */
export const LOCAL_SPACE_ID = 'this-browser';

/** What a new local folder is called until the person names it, as My Work's are. */
export const NEW_FOLDER_NAME = 'New Folder';

export const LOCAL_FOLDER_COPY = {
  full: 'Browser Storage keeps as many folders as it can. Delete one to make another.',
  empty: 'This folder is empty.',
  deleteTitle: (name: string) => `Delete “${name}”?`,
  deleteMessage: (parent: string) =>
    `Its folders and items move up to ${parent}. Nothing in it is deleted.`,
} as const;

/** This Browser's live items and folders, and whether the Space shows: while it holds a live item or a folder. */
export function useThisBrowserSpace(): {
  live: ThisBrowserItem[];
  folders: readonly ThisBrowserFolder[];
  holds: boolean;
  readable: boolean;
} {
  const { app } = useExplorer();
  const { host, live } = useThisBrowserItems();
  const folders = useThisBrowserFolders(host ? app : null);
  return {
    live,
    folders,
    readable: Boolean(host),
    holds: Boolean(host) && (live.length > 0 || folders.length > 0),
  };
}

/** The account folder of the same name in My Work, ignoring case: the shallowest, then the first by name. */
export function sameNameFolder(
  folders: readonly Folder[],
  name: string | null | undefined,
): Folder | null {
  const wanted = name?.trim().toLocaleLowerCase();
  if (!wanted) return null;
  const mine = folders.filter((f) => f.teamId === null);
  const byId = new Map(mine.map((f) => [f.id, f]));
  const depth = (f: Folder) => {
    let d = 0;
    const seen = new Set<string>();
    for (let at = f.parentId; at && !seen.has(at); at = byId.get(at)?.parentId ?? null) {
      seen.add(at);
      d += 1;
    }
    return d;
  };
  const found = mine
    .filter((f) => f.name.trim().toLocaleLowerCase() === wanted)
    .sort((a, b) => depth(a) - depth(b) || a.name.localeCompare(b.name));
  return found[0] ?? null;
}

/** Sync for one live item, keeping its place: one in a local folder goes through the Sync dialog, which names the
 *  account folder of the same name (or My Work's root) and moves it there; one at the root syncs as it always did. */
export function useSyncLocal(): ((item: ThisBrowserItem) => void) | null {
  const { app, folders, openDialog, reloadLists } = useExplorer();
  const { host } = useThisBrowserItems();
  const localFolders = useThisBrowserFolders(host ? app : null);
  const sync = host?.sync;
  const syncHref = host?.syncHref;
  const run = useCallback(
    (item: ThisBrowserItem) => {
      const local = item.folderId ? localFolders.find((f) => f.id === item.folderId) : undefined;
      if (local) {
        const match = sameNameFolder(folders.folders, local.name);
        openDialog({ kind: 'sync-local', item, to: { teamId: null, folderId: match?.id ?? null } });
        return;
      }
      if (sync) thenReload(sync(item), reloadLists);
      else if (syncHref) window.location.assign(syncHref(item));
    },
    [localFolders, folders.folders, openDialog, sync, syncHref, reloadLists],
  );
  return sync || syncHref ? run : null;
}

/** Makes a local folder in `parentId` and hands its id to `rename` (where its name is typed), or says it is full. */
export function useCreateLocalFolder(): (
  parentId: string | null,
  rename: (id: string) => void,
) => void {
  const { app, toast, expansion } = useExplorer();
  return useCallback(
    (parentId, rename) => {
      const made = createThisBrowserFolder(app, NEW_FOLDER_NAME, parentId);
      if (!made) {
        toast.show(LOCAL_FOLDER_COPY.full, { tone: 'error' });
        return;
      }
      // The rows above it open, so the new row is in sight.
      expansion.expand(LOCAL_ROW_KEY, ...(parentId ? [localKey(parentId)] : []));
      rename(made.id);
    },
    [app, toast, expansion],
  );
}

/** Renames one local folder from a rename field's commit. */
export function useRenameLocalFolder(): (id: string, name: string) => void {
  const { app } = useExplorer();
  return useCallback((id, name) => void renameThisBrowserFolder(app, id, name), [app]);
}

/** The sidebar's open-row keys: This Browser's own row, and each local folder's. */
export const LOCAL_ROW_KEY = 'this-browser';
export const localKey = (folderId: string) => `local:${folderId}`;
