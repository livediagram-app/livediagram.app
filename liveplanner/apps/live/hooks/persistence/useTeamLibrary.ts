'use client';

import { truncateName } from '@liveplanner/project';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectSummary, Folder } from '@liveplanner/api-schema';
import {
  apiCreateFolder,
  apiDeleteProject,
  apiDeleteFolder,
  apiGetTeamLibrary,
  apiSaveProjectMeta,
  apiSetProjectFolder,
  apiUpdateFolder,
} from '@/lib/api-client';
import { duplicateProject as duplicateProjectApi } from '@/lib/duplicate-project';
import { accepted } from '@/lib/accepted';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import { logMoveFailure } from '@/lib/move-failure';
import { PROJECT_FAILURE, FOLDER_FAILURE } from '@/lib/write-failure-copy';
import { indexFolders, folderBreadcrumb, groupProjectsByFolder } from '@/lib/folder-tree';

// One team's shared library (docs/specs/013-workspace/team-shared-projects.md): the folder tree + projects the
// "Shared projects" section on the team page renders, plus the
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
  const [liveDocs, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Sets state only from the response callbacks, so the load effect below
  // only starts the request.
  const refresh = useCallback(async () => {
    if (!ownerId) return;
    await apiGetTeamLibrary(ownerId, teamId)
      .then(
        (lib) => {
          setFolders(lib.folders);
          setProjects(lib.projects);
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
    setProjects([]);
    setLoading(true);
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    return indexFolders(folders);
  }, [folders]);

  const projectsByFolder = useMemo(() => groupProjectsByFolder(liveDocs), [liveDocs]);

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

  // Re-folder a project WITHIN the team (folderId null = the team's
  // root).
  const moveProject = useCallback(
    async (projectId: string, folderId: string | null) => {
      if (!ownerId) return;
      try {
        await apiSetProjectFolder(ownerId, projectId, folderId, teamId);
        track('Team', 'Moved', 'Project');
      } catch (err) {
        logMoveFailure('team-project', ` project=${projectId}`, err);
        toast.error(PROJECT_FAILURE.move(liveDocs.find((d) => d.id === projectId)?.name));
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, teamId, liveDocs, refresh, onChange, toast],
  );

  // Delete a team project, to the team's Trash. Any joined member may delete it
  // (docs/specs/013-workspace/team-shared-projects.md), gated server-side by the team-member delete check.
  // Whether the delete landed, so the caller offers its Undo only then.
  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!ownerId) return false;
      const ok = await accepted(apiDeleteProject(ownerId, projectId));
      if (ok) track('Project', 'Deleted');
      await refresh();
      onChange.current?.();
      return ok;
    },
    [ownerId, refresh, onChange],
  );

  // Rename a team project in place. Any joined member may edit it
  // (docs/specs/013-workspace/team-shared-projects.md), gated server-side by canEditProject.
  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      if (!ownerId) return;
      // docs/specs/006-project/name-length.md.
      const trimmed = truncateName(name);
      if (!trimmed) return;
      try {
        await apiSaveProjectMeta(ownerId, { id: projectId, name: trimmed });
        track('Project', 'Renamed');
      } catch (err) {
        fail(
          'rename-project',
          PROJECT_FAILURE.rename(liveDocs.find((d) => d.id === projectId)?.name),
          err,
        );
      }
      await refresh();
      onChange.current?.();
    },
    [ownerId, liveDocs, refresh, onChange, fail],
  );

  // Duplicate a team project, keeping the copy IN the team alongside
  // the original (same folder), filed by the create itself
  // (docs/specs/013-workspace/team-shared-projects.md).
  const duplicateProject = useCallback(
    async (projectId: string) => {
      if (!ownerId) return;
      const source = liveDocs.find((d) => d.id === projectId);
      const sourceFolderId = source?.folderId ?? null;
      const newId = await duplicateProjectApi(ownerId, projectId, {
        teamId,
        folderId: sourceFolderId,
      });
      if (!newId) {
        console.warn('[team-library] duplicate-project failed', { project: projectId });
        toast.error(PROJECT_FAILURE.duplicate(source?.name));
        return;
      }
      track('Project', 'Duplicated');
      await refresh();
      onChange.current?.();
    },
    [ownerId, teamId, liveDocs, refresh, onChange, toast],
  );

  return {
    folders,
    projects: liveDocs,
    loading,
    refresh,
    folderById,
    childrenByParent,
    rootFolders,
    projectsByFolder,
    breadcrumb,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveProject,
    deleteProject,
    renameProject,
    duplicateProject,
  };
}
