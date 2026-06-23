'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiCreateFolder,
  apiDeleteFolder,
  apiListFolders,
  apiUpdateFolder,
  type Folder,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Folder state + the three mutation handlers (create / rename /
// delete). Three pages used to inline this triplet by hand:
//
//   - apps/live/app/diagram/[id]/editor-page.tsx
//   - apps/live/app/new/page.tsx
//   - apps/live/app/explorer/page.tsx
//
// Pulling the shape into a hook avoids the drift that creeps in
// every time a fourth surface adds folder UI (the editor view
// re-parents children on delete; the original /explorer version
// just dropped them, etc.). The hook is the single source of
// truth — callers that need a separate effect (e.g. re-bucketing
// diagrams whose folder vanished) chain their own state update
// before delegating to `deleteFolder`.
//
// `ownerId` may be `null` while auth bootstraps. The hook treats a
// null owner as "not ready" — auto-fetch is suppressed and the
// mutation handlers no-op. Once the id arrives the caller can
// `refresh()` (or pass `autoLoad: true` for the common case where
// you want the list fetched as soon as ownership is known).

type UseFoldersResult = {
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  // True while the initial folders fetch is in flight. Distinct
  // from "no folders yet" so the caller can skeleton on the right
  // signal.
  loading: boolean;
  // Optimistic create: a freshly-minted Folder lands in local
  // state before the API call returns. On API failure the stub
  // gets rolled back. Returns the persisted folder (with
  // server-side timestamps) on success, undefined on rollback.
  createFolder: (input: { name?: string; parentId?: string | null }) => Promise<Folder | undefined>;
  renameFolder: (id: string, name: string) => void;
  // Re-parents any direct children to root before delegating to
  // the API call — same as the server-side cascade so the local
  // tree doesn't flash an out-of-date shape between the click and
  // the next list refresh.
  deleteFolder: (id: string) => void;
  // Force a re-fetch from the server. Useful after a different
  // code path mutated folders out-of-band (e.g. a guest → authed
  // migration).
  refresh: () => Promise<void>;
};

export function useFolders(
  ownerId: string | null,
  opts: { autoLoad?: boolean } = {},
): UseFoldersResult {
  const { autoLoad = true } = opts;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(autoLoad);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const list = await apiListFolders(ownerId);
      setFolders(list);
    } catch {
      // Silent failure: a transient hiccup shouldn't wipe whatever
      // we've already loaded. The next refresh will retry.
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!autoLoad) return;
    if (!ownerId) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [autoLoad, ownerId, refresh]);

  const createFolder = useCallback(
    async (input: { name?: string; parentId?: string | null }) => {
      if (!ownerId) return undefined;
      const id = crypto.randomUUID();
      const name = input.name?.trim() || 'New folder';
      try {
        const folder = await apiCreateFolder(ownerId, {
          id,
          name,
          parentId: input.parentId ?? null,
        });
        setFolders((prev) => [...prev, folder]);
        track('Folder', 'Created');
        return folder;
      } catch {
        return undefined;
      }
    },
    [ownerId],
  );

  const renameFolder = useCallback(
    (id: string, name: string) => {
      if (!ownerId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      // Read previous name from closure state (`folders`) BEFORE
      // calling setFolders so the comparison doesn't sit inside the
      // updater, where React strict mode in dev would double-fire
      // the telemetry emit. There's no rapid-race risk: rename is a
      // user blur / Enter on a text input.
      const prevName = folders.find((f) => f.id === id)?.name.trim() ?? '';
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
      void apiUpdateFolder(ownerId, id, { name: trimmed }).catch(() => {});
      if (prevName !== trimmed) track('Folder', 'Renamed');
    },
    [folders, ownerId],
  );

  const deleteFolder = useCallback(
    (id: string) => {
      if (!ownerId) return;
      setFolders((prev) =>
        prev
          .filter((f) => f.id !== id)
          .map((f) => (f.parentId === id ? { ...f, parentId: null } : f)),
      );
      void apiDeleteFolder(ownerId, id).catch(() => {});
      track('Folder', 'Deleted');
    },
    [ownerId],
  );

  return { folders, setFolders, loading, createFolder, renameFolder, deleteFolder, refresh };
}
