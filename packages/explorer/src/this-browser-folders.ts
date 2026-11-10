// This Browser's folders (liveworkspace/docs/specs/004-index/one-explorer.md "This Browser, a Space"): kept in the same
// localStorage list as the items (this-browser.ts, version 2), each `{ id, name, parentId, … }`, and each item's
// `folderId`. Every write here reads the list, changes it and writes it whole, as the item writes do; the readers hear
// it through the same event. Plain TypeScript, no React.

import type { App } from '@liveworkspace/index-client';
import {
  readThisBrowserStore,
  writeThisBrowserStore,
  THIS_BROWSER_FOLDER_MAX,
  type ThisBrowserFolder,
  type ThisBrowserItem,
} from './this-browser';

/** A folder's name as kept: trimmed, at most this many characters. */
export const LOCAL_FOLDER_NAME_MAX = 120;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const tidy = (name: string) => name.trim().slice(0, LOCAL_FOLDER_NAME_MAX);

function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return `local-${c.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** A folder's own folders (null: the root's), by name. */
export function localChildren(
  folders: readonly ThisBrowserFolder[],
  parentId: string | null,
): ThisBrowserFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => byName.compare(a.name, b.name));
}

/** The folders from the root down to `id` (itself last); empty for one not there. Stops at a cycle. */
export function localPath(
  folders: readonly ThisBrowserFolder[],
  id: string | null,
): ThisBrowserFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: ThisBrowserFolder[] = [];
  const seen = new Set<string>();
  let at = id ? byId.get(id) : undefined;
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    path.unshift(at);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return path;
}

/** Whether `id` is `ancestor` or sits somewhere below it. */
export function isLocalWithin(
  folders: readonly ThisBrowserFolder[],
  id: string | null,
  ancestor: string,
): boolean {
  return localPath(folders, id).some((f) => f.id === ancestor);
}

/** Makes a folder in `parentId` (null: the root). The folder made, or null when the name is blank, the parent is
 *  gone, the list is at THIS_BROWSER_FOLDER_MAX, or storage refused it. */
export function createThisBrowserFolder(
  app: App,
  name: string,
  parentId: string | null,
  store: Storage | null = storage(),
  now = Date.now(),
): ThisBrowserFolder | null {
  const clean = tidy(name);
  const was = readThisBrowserStore(app, store);
  if (!clean || was.folders.length >= THIS_BROWSER_FOLDER_MAX) return null;
  if (parentId && !was.folders.some((f) => f.id === parentId)) return null;
  const folder: ThisBrowserFolder = {
    id: newId(),
    name: clean,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  writeThisBrowserStore(app, { ...was, folders: [...was.folders, folder] }, store);
  // Read back: a full or blocked storage keeps nothing.
  return readThisBrowserStore(app, store).folders.some((f) => f.id === folder.id) ? folder : null;
}

/** Renames one; nothing when the name is blank or the same. */
export function renameThisBrowserFolder(
  app: App,
  id: string,
  name: string,
  store: Storage | null = storage(),
  now = Date.now(),
): boolean {
  const clean = tidy(name);
  const was = readThisBrowserStore(app, store);
  const folder = was.folders.find((f) => f.id === id);
  if (!clean || !folder || folder.name === clean) return false;
  writeThisBrowserStore(
    app,
    {
      ...was,
      folders: was.folders.map((f) => (f.id === id ? { ...f, name: clean, updatedAt: now } : f)),
    },
    store,
  );
  return true;
}

/** Deletes one folder: its folders and items move up a level, to its parent (nothing is deleted with it). */
export function deleteThisBrowserFolder(
  app: App,
  id: string,
  store: Storage | null = storage(),
): boolean {
  const was = readThisBrowserStore(app, store);
  const folder = was.folders.find((f) => f.id === id);
  if (!folder) return false;
  const up = folder.parentId;
  writeThisBrowserStore(
    app,
    {
      folders: was.folders
        .filter((f) => f.id !== id)
        .map((f) => (f.parentId === id ? { ...f, parentId: up } : f)),
      items: was.items.map((i) => (i.folderId === id ? withFolder(i, up) : i)),
    },
    store,
  );
  return true;
}

/** Moves one folder into `parentId` (null: the root); never into itself or below itself. */
export function moveThisBrowserFolder(
  app: App,
  id: string,
  parentId: string | null,
  store: Storage | null = storage(),
): boolean {
  const was = readThisBrowserStore(app, store);
  const folder = was.folders.find((f) => f.id === id);
  if (!folder || folder.parentId === parentId) return false;
  if (
    parentId &&
    (!was.folders.some((f) => f.id === parentId) || isLocalWithin(was.folders, parentId, id))
  )
    return false;
  writeThisBrowserStore(
    app,
    { ...was, folders: was.folders.map((f) => (f.id === id ? { ...f, parentId } : f)) },
    store,
  );
  return true;
}

function withFolder(item: ThisBrowserItem, folderId: string | null): ThisBrowserItem {
  if (folderId) return { ...item, folderId };
  const { folderId: _out, ...atRoot } = item;
  return atRoot;
}

/** Moves one item into a local folder (null: This Browser's root). False when it is there already, or either is
 *  gone. */
export function moveThisBrowserItem(
  app: App,
  id: string,
  folderId: string | null,
  store: Storage | null = storage(),
): boolean {
  const was = readThisBrowserStore(app, store);
  const item = was.items.find((i) => i.id === id);
  if (!item || (item.folderId ?? null) === folderId) return false;
  if (folderId && !was.folders.some((f) => f.id === folderId)) return false;
  writeThisBrowserStore(
    app,
    { ...was, items: was.items.map((i) => (i.id === id ? withFolder(i, folderId) : i)) },
    store,
  );
  return true;
}

// ---------- Sync keeping its place -----------------------------------------------------------------------------------
// On the Explorer page, Sync hands over to the editor, which syncs the item and stays there. Where it should land in
// the account (an account folder) is noted here first, and the next Explorer on this address moves it there once the
// index has it (useSyncPlaces). A note lasts a day.

export const SYNC_PLACE_TTL_MS = 24 * 60 * 60 * 1000;

export const syncPlaceKey = (app: App) => `liveworkspace:this-browser-sync-place:${app}`;

/** Where one item should land once synced: an account folder, or a team's root or folder (never My Work's root, where
 *  a Sync lands anyway). */
export type SyncPlace = { id: string; teamId: string | null; folderId: string | null; at: number };

function readPlaces(app: App, store: Storage | null): SyncPlace[] {
  try {
    const raw = store?.getItem(syncPlaceKey(app));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<
      string,
      { teamId?: unknown; folderId?: unknown; at?: unknown }
    >;
    return Object.entries(parsed).flatMap(([id, v]) => {
      if (!v || typeof v.at !== 'number') return [];
      const teamId = typeof v.teamId === 'string' && v.teamId ? v.teamId : null;
      const folderId = typeof v.folderId === 'string' && v.folderId ? v.folderId : null;
      return teamId || folderId ? [{ id, teamId, folderId, at: v.at }] : [];
    });
  } catch {
    return [];
  }
}

function writePlaces(app: App, places: readonly SyncPlace[], store: Storage | null): void {
  try {
    if (!store) return;
    if (places.length === 0) store.removeItem(syncPlaceKey(app));
    else
      store.setItem(
        syncPlaceKey(app),
        JSON.stringify(
          Object.fromEntries(
            places.map((p) => [p.id, { teamId: p.teamId, folderId: p.folderId, at: p.at }]),
          ),
        ),
      );
  } catch {
    // Blocked: the item lands in My Work's root, as it did before.
  }
}

/** Notes where `id` should land in the account once its handed-over Sync is done; My Work's root needs no note. */
export function noteSyncPlace(
  app: App,
  id: string,
  to: { teamId: string | null; folderId: string | null },
  store: Storage | null = storage(),
  now = Date.now(),
): void {
  const others = readPlaces(app, store).filter((p) => p.id !== id);
  if (!to.teamId && !to.folderId) return writePlaces(app, others, store);
  writePlaces(app, [...others, { id, teamId: to.teamId, folderId: to.folderId, at: now }], store);
}

/** The notes still in time (the expired ones are dropped as this reads). */
export function readSyncPlaces(
  app: App,
  store: Storage | null = storage(),
  now = Date.now(),
): SyncPlace[] {
  const all = readPlaces(app, store);
  const live = all.filter((p) => now - p.at < SYNC_PLACE_TTL_MS && p.at <= now);
  if (live.length !== all.length) writePlaces(app, live, store);
  return live;
}

/** Drops one note, used or no longer usable. */
export function dropSyncPlace(app: App, id: string, store: Storage | null = storage()): void {
  const all = readPlaces(app, store);
  if (all.some((p) => p.id === id))
    writePlaces(
      app,
      all.filter((p) => p.id !== id),
      store,
    );
}
