'use client';

import { truncateName } from '@livedesign/design';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DesignSummary, Folder } from '@livedesign/api-schema';
import {
  apiCreateFolder,
  apiDeleteDesign,
  apiDeleteFolder,
  apiGetTeamLibrary,
  apiSaveDesignMeta,
  apiSetDesignFolder,
  apiUpdateFolder,
} from '@/lib/api-client';
import { duplicateDesign as duplicateDesignApi } from '@/lib/duplicate-design';
import { accepted } from '@/lib/accepted';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import { logMoveFailure } from '@/lib/move-failure';
import { DESIGN_FAILURE, FOLDER_FAILURE } from '@/lib/write-failure-copy';
import { indexFolders, folderBreadcrumb, groupDesignsByFolder } from '@/lib/folder-tree';

// One team's shared library (docs/specs/013-workspace/team-shared-designs.md): the folder tree + designs the
// "Shared designs" section on the team page renders, plus the
// mutations every joined member may perform. Mirrors useFolders +
// useExplorerState's derived shapes, scoped to a single team. All
// mutations refetch — the library is shared, so optimistic local
// state would drift the moment a teammate touches it anyway.

export function useTeamLibrary(
  ownerId: string | null,
  teamId: string,
  // Called after each change this library makes, once it has refetched: the Explorer's own lists follow.
  opts: { onChange?: () => void } = {},
) {
  const onChange = useLatest(opts.onChange);
  const toast = useToast();
  // A write that fails says so (docs/specs/013-workspace/folders.md "A write that fails says so"): the toast, and a
  // log line naming what failed. The refetch after it puts the library back as the server holds it.
  const fail = useCallback(
    (what: string, message: string, err: unknown) => {
      console.warn(`[team-library] ${what} failed`, { message: (err as Error).message });
      toast.error(message);
    },
    [toast],
  );
  const [folders, setFolders] = useState<Folder[]>([]);
  const [liveDocs, setDesigns] = useState<DesignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Sets state only from the response callbacks, so the load effect below
  // only starts the request.
  const refresh = useCallback(async () => {
    if (!ownerId) return;
    await apiGetTeamLibrary(ownerId, teamId)
      .then(
        (lib) => {
          setFolders(lib.folders);
          setDesigns(lib.designs);
        },
        () => {
          // Transient failure: keep whatever is on screen, next refresh
          // reconciles (same posture as useFolders).
        },
      )
      .finally(() => setLoading(false));
  }, [ownerId, teamId]);

  // Another team (or owner) starts from an empty, loading library, cleared
  // during render so the previous team's tree never shows under this one.
  const libraryKey = `${ownerId}\0${teamId}`;
  const [loadedKey, setLoadedKey] = useState(libraryKey);
  if (libraryKey !== loadedKey) {
    setLoadedKey(libraryKey);
    setFolders([]);
    setDesigns([]);
    setLoading(true);
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    return indexFolders(folders);
  }, [folders]);

  const designsByFolder = useMemo(() => groupDesignsByFolder(liveDocs), [liveDocs]);

  // Breadcrumb chain root → folderId, tolerant of dangling parents
  // mid-refresh (same shape as the personal explorer's).
  const breadcrumb = useCallback(
    (folderId: string | null): Folder[] => {
      return folderBreadcrumb(folderById, folderId);
    },
    [folderById],
  );

  const createFolder = useCallback(
    // `name` defaults to the rename-me stub the tree flow uses; the move
    // picker's New Folder tile passes a real name up front.
    async (parentId: string | null, name?: string): Promise<Folder | undefined> => {
      if (!ownerId) return undefined;
      try {
        const folder = await apiCreateFolder(ownerId, {
          id: crypto.randomUUID(),
          name: name?.trim() || 'New folder',
          parentId,
          teamId,
        });
        track('Folder', 'Created', 'Team');
        await refresh();
        onChange.current?.();
        return folder;
      } catch (err) {
        fail('create-folder', FOLDER_FAILURE.create(name), err);
        return undefined;
      }
    },
    [ownerId, teamId, refresh, onChange, fail],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      if (!ownerId || !name.trim()) return;
      try {
        await apiUpdateFolder(ownerId, id, { name: name.trim() });
        track('Folder', 'Renamed', 'Team');
      } catch (err) {
        fail('rename-folder', FOLDER_FAILURE.rename(folders.find((f) => f.id === id)?.name), err);
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, folders, refresh, onChange, fail],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      if (!ownerId) return;
      try {
        await apiUpdateFolder(ownerId, id, { parentId });
        track('Folder', 'Moved', 'Team');
      } catch (err) {
        logMoveFailure('folder', ` folder=${id}`, err);
        toast.error(FOLDER_FAILURE.move(folders.find((f) => f.id === id)?.name));
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, folders, refresh, onChange, toast],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      if (!ownerId) return;
      try {
        await apiDeleteFolder(ownerId, id);
        track('Folder', 'Deleted', 'Team');
      } catch (err) {
        fail('delete-folder', FOLDER_FAILURE.delete(folders.find((f) => f.id === id)?.name), err);
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, folders, refresh, onChange, fail],
  );

  // Re-folder a design WITHIN the team (folderId null = the team's
  // root).
  const moveDesign = useCallback(
    async (designId: string, folderId: string | null) => {
      if (!ownerId) return;
      try {
        await apiSetDesignFolder(ownerId, designId, folderId, teamId);
        track('Team', 'Moved', 'Design');
      } catch (err) {
        logMoveFailure('team-design', ` design=${designId}`, err);
        toast.error(DESIGN_FAILURE.move(liveDocs.find((d) => d.id === designId)?.name));
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, teamId, liveDocs, refresh, onChange, toast],
  );

  // Delete a team design, to the team's Trash. Any joined member may delete it
  // (docs/specs/013-workspace/team-shared-designs.md), gated server-side by the team-member delete check.
  // Whether the delete landed, so the caller offers its Undo only then.
  const deleteDesign = useCallback(
    async (designId: string): Promise<boolean> => {
      if (!ownerId) return false;
      const ok = await accepted(apiDeleteDesign(ownerId, designId));
      if (ok) track('Document', 'Deleted');
      await refresh();
      onChange.current?.();
      return ok;
    },
    [ownerId, refresh, onChange],
  );

  // Rename a team design in place. Any joined member may edit it
  // (docs/specs/013-workspace/team-shared-designs.md), gated server-side by canEditDesign.
  const renameDesign = useCallback(
    async (designId: string, name: string) => {
      if (!ownerId) return;
      // docs/specs/006-design/name-length.md.
      const trimmed = truncateName(name);
      if (!trimmed) return;
      try {
        await apiSaveDesignMeta(ownerId, { id: designId, name: trimmed });
        track('Document', 'Renamed');
      } catch (err) {
        fail(
          'rename-design',
          DESIGN_FAILURE.rename(liveDocs.find((d) => d.id === designId)?.name),
          err,
        );
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, liveDocs, refresh, onChange, fail],
  );

  // Duplicate a team design, keeping the copy IN the team alongside
  // the original (same folder), filed by the create itself
  // (docs/specs/013-workspace/team-shared-designs.md).
  const duplicateDesign = useCallback(
    async (designId: string) => {
      if (!ownerId) return;
      const source = liveDocs.find((d) => d.id === designId);
      const sourceFolderId = source?.folderId ?? null;
      const newId = await duplicateDesignApi(ownerId, designId, {
        teamId,
        folderId: sourceFolderId,
      });
      if (!newId) {
        console.warn('[team-library] duplicate-design failed', { design: designId });
        toast.error(DESIGN_FAILURE.duplicate(source?.name));
        return;
      }
      track('Document', 'Duplicated');
      await refresh();
      onChange.current?.();
    },
    [ownerId, teamId, liveDocs, refresh, onChange, toast],
  );

  return {
    folders,
    designs: liveDocs,
    loading,
    refresh,
    folderById,
    childrenByParent,
    rootFolders,
    designsByFolder,
    breadcrumb,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveDesign,
    deleteDesign,
    renameDesign,
    duplicateDesign,
  };
}
