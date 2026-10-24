'use client';

// Every folder the person can reach, personal and each joined team's, loaded once (page after page at the
// index's maximum, usually one request) and kept in memory: the sidebar tree, the breadcrumbs, the move
// dialog and each list's folder rows all read this one copy, so no view asks for folders again. Create,
// rename, move and delete change it at once and take the change back when the index refuses.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Folder, IndexClient } from '@liveworkspace/index-client';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import type { OrganiseTelemetry } from '../types';
import { failureText, isAbort } from './errors';

export type FolderStore = {
  folders: Folder[];
  byId: Map<string, Folder>;
  // Folders under a parent (null: the scope's root), per scope (null: personal), name order.
  childrenOf: (parentId: string | null, teamId: string | null) => Folder[];
  loading: boolean;
  error: boolean;
  create: (input: {
    name: string;
    parentId: string | null;
    teamId: string | null;
  }) => Promise<Folder | null>;
  rename: (id: string, name: string) => Promise<boolean>;
  move: (id: string, parentId: string | null) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  reload: () => void;
};

// Folders past this many pages are not loaded (100,000 folders); a guard, not a limit anyone meets.
const MAX_PAGES = 500;

export function useFolderStore(
  client: IndexClient,
  onError: (text: string) => void,
  onTreeChanged: () => void,
  // Folder·Created / Renamed / Moved / Deleted, once the index took the change.
  onOrganise?: OrganiseTelemetry,
): FolderStore {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(folders);
  latest.current = folders;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const all: Folder[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await client.listFolders(
          { limit: LIST_LIMIT_MAX, cursor },
          { signal: controller.signal },
        );
        all.push(...res.folders);
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      setFolders(all);
      setError(false);
      setLoading(false);
    })().catch((e: unknown) => {
      if (isAbort(e)) return;
      setError(true);
      setLoading(false);
    });
    return () => controller.abort();
  }, [client, attempt]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const children = useMemo(() => {
    const map = new Map<string, Folder[]>();
    for (const f of folders) {
      const key = `${f.teamId ?? ''}/${f.parentId ?? ''}`;
      const list = map.get(key);
      if (list) list.push(f);
      else map.set(key, [f]);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);
  const childrenOf = useCallback(
    (parentId: string | null, teamId: string | null) =>
      children.get(`${teamId ?? ''}/${parentId ?? ''}`) ?? NONE,
    [children],
  );

  // Applies `change` now; on a refusal applies `revert`, which takes back only this change, so another
  // change made meanwhile stays.
  const optimistic = useCallback(
    async <T>(
      change: (all: Folder[]) => Folder[],
      revert: (all: Folder[]) => Folder[],
      call: () => Promise<T>,
      fallback: string,
    ): Promise<T | undefined> => {
      setFolders(change);
      try {
        return await call();
      } catch (e) {
        setFolders(revert);
        onError(failureText(e, fallback));
        return undefined;
      }
    },
    [onError],
  );

  const create = useCallback<FolderStore['create']>(
    async ({ name, parentId, teamId }) => {
      const now = Date.now();
      const id = newId();
      const draft: Folder = {
        id,
        name,
        parentId,
        teamId,
        ownerId: '',
        createdAt: now,
        updatedAt: now,
      };
      const res = await optimistic(
        (all) => [...all, draft],
        (all) => all.filter((f) => f.id !== id),
        () => client.createFolder({ id, name, parentId, teamId }),
        'Couldn’t make that folder. Try again.',
      );
      if (!res) return null;
      onOrganise?.('Folder·Created', teamId ? 'Team' : null);
      setFolders((all) => all.map((f) => (f.id === id ? res.folder : f)));
      return res.folder;
    },
    [client, optimistic, onOrganise],
  );

  const patchOne = useCallback(
    async (id: string, patch: Partial<Folder>, call: () => Promise<unknown>, fallback: string) => {
      const old = latest.current.find((f) => f.id === id);
      if (!old) return false;
      const back: Partial<Folder> = {};
      for (const key of Object.keys(patch) as (keyof Folder)[]) {
        (back as Record<string, unknown>)[key] = old[key];
      }
      const res = await optimistic(
        (all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        (all) => all.map((f) => (f.id === id ? { ...f, ...back } : f)),
        async () => {
          await call();
          return true;
        },
        fallback,
      );
      return res === true;
    },
    [optimistic],
  );

  const rename = useCallback<FolderStore['rename']>(
    async (id, name) => {
      const ok = await patchOne(
        id,
        { name },
        () => client.updateFolder(id, { name }),
        'Couldn’t rename that folder. Try again.',
      );
      if (ok) onOrganise?.('Folder·Renamed', null);
      return ok;
    },
    [client, patchOne, onOrganise],
  );

  const move = useCallback<FolderStore['move']>(
    async (id, parentId) => {
      const ok = await patchOne(
        id,
        { parentId },
        () => client.updateFolder(id, { parentId }),
        'Couldn’t move that folder. Try again.',
      );
      if (ok) onOrganise?.('Folder·Moved', null);
      return ok;
    },
    [client, patchOne, onOrganise],
  );

  // The index moves a deleted folder's children (folders and items) up a level; the tree does the same at
  // once, and the lists reload once it is done, since items moved too.
  const remove = useCallback<FolderStore['remove']>(
    async (id) => {
      const gone = latest.current.find((f) => f.id === id);
      if (!gone) return false;
      const movedUp = new Set(latest.current.filter((f) => f.parentId === id).map((f) => f.id));
      const ok =
        (await optimistic(
          (all) =>
            all
              .filter((f) => f.id !== id)
              .map((f) => (movedUp.has(f.id) ? { ...f, parentId: gone.parentId } : f)),
          (all) => [...all.map((f) => (movedUp.has(f.id) ? { ...f, parentId: id } : f)), gone],
          async () => {
            await client.deleteFolder(id);
            return true;
          },
          'Couldn’t delete that folder. Try again.',
        )) === true;
      if (ok) {
        onOrganise?.('Folder·Deleted', null);
        onTreeChanged();
      }
      return ok;
    },
    [client, optimistic, onTreeChanged, onOrganise],
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return useMemo(
    () => ({ folders, byId, childrenOf, loading, error, create, rename, move, remove, reload }),
    [folders, byId, childrenOf, loading, error, create, rename, move, remove, reload],
  );
}

const NONE: Folder[] = [];

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** The folders from the root down to `id`, for breadcrumbs. */
export function folderPath(byId: Map<string, Folder>, id: string | null): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<string>();
  let at = id ? byId.get(id) : undefined;
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    path.unshift(at);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return path;
}

/** Whether `id` is `ancestor` or sits anywhere under it (a folder cannot move into itself). */
export function isWithin(byId: Map<string, Folder>, id: string, ancestor: string): boolean {
  return folderPath(byId, id).some((f) => f.id === ancestor);
}
