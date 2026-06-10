'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiagramSummary, Folder } from '@livediagram/api-schema';
import {
  apiCreateFolder,
  apiDeleteFolder,
  apiGetTeamLibrary,
  apiSaveDiagramMeta,
  apiSetDiagramFolder,
  apiUpdateFolder,
} from '@/lib/api-client';
import { duplicateDiagram as duplicateDiagramApi } from '@/lib/duplicate-diagram';
import { track } from '@/lib/telemetry';

// One team's shared library (spec/35): the folder tree + diagrams the
// "Shared diagrams" section on the team page renders, plus the
// mutations every joined member may perform. Mirrors useFolders +
// useExplorerState's derived shapes, scoped to a single team. All
// mutations refetch — the library is shared, so optimistic local
// state would drift the moment a teammate touches it anyway.

export function useTeamLibrary(ownerId: string | null, teamId: string) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      const lib = await apiGetTeamLibrary(ownerId, teamId);
      setFolders(lib.folders);
      setDiagrams(lib.diagrams);
    } catch {
      // Transient failure: keep whatever is on screen, next refresh
      // reconciles (same posture as useFolders).
    } finally {
      setLoading(false);
    }
  }, [ownerId, teamId]);

  useEffect(() => {
    setFolders([]);
    setDiagrams([]);
    setLoading(true);
    void refresh();
  }, [refresh]);

  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    const byId = new Map<string, Folder>();
    const byParent = new Map<string | null, Folder[]>();
    for (const f of folders) {
      byId.set(f.id, f);
      const bucket = byParent.get(f.parentId) ?? [];
      bucket.push(f);
      byParent.set(f.parentId, bucket);
    }
    for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return {
      folderById: byId,
      childrenByParent: byParent,
      rootFolders: byParent.get(null) ?? [],
    };
  }, [folders]);

  const diagramsByFolder = useMemo(() => {
    const m = new Map<string | null, DiagramSummary[]>();
    for (const d of diagrams) {
      const bucket = m.get(d.folderId) ?? [];
      bucket.push(d);
      m.set(d.folderId, bucket);
    }
    for (const bucket of m.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return m;
  }, [diagrams]);

  // Breadcrumb chain root → folderId, tolerant of dangling parents
  // mid-refresh (same shape as the personal explorer's).
  const breadcrumb = useCallback(
    (folderId: string | null): Folder[] => {
      if (!folderId) return [];
      const chain: Folder[] = [];
      let cursor: Folder | undefined = folderById.get(folderId);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        chain.unshift(cursor);
        cursor = cursor.parentId ? folderById.get(cursor.parentId) : undefined;
      }
      return chain;
    },
    [folderById],
  );

  const createFolder = useCallback(
    async (parentId: string | null): Promise<Folder | undefined> => {
      if (!ownerId) return undefined;
      try {
        const folder = await apiCreateFolder(ownerId, {
          id: crypto.randomUUID(),
          name: 'New folder',
          parentId,
          teamId,
        });
        track('Folder', 'Created', 'Team');
        await refresh();
        return folder;
      } catch {
        return undefined;
      }
    },
    [ownerId, teamId, refresh],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      if (!ownerId || !name.trim()) return;
      await apiUpdateFolder(ownerId, id, { name: name.trim() }).catch(() => {});
      track('Folder', 'Renamed', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      if (!ownerId) return;
      await apiUpdateFolder(ownerId, id, { parentId }).catch(() => {});
      track('Folder', 'Moved', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      if (!ownerId) return;
      await apiDeleteFolder(ownerId, id).catch(() => {});
      track('Folder', 'Deleted', 'Team');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Re-folder a diagram WITHIN the team (folderId null = the team's
  // Unsorted).
  const moveDiagram = useCallback(
    async (diagramId: string, folderId: string | null) => {
      if (!ownerId) return;
      await apiSetDiagramFolder(ownerId, diagramId, folderId, teamId).catch(() => {});
      track('Team', 'Moved', 'Diagram');
      await refresh();
    },
    [ownerId, teamId, refresh],
  );

  // Remove a diagram from the team: back to its OWNER's personal
  // Unsorted (spec/35), whoever clicked the action.
  const removeDiagramFromTeam = useCallback(
    async (diagramId: string) => {
      if (!ownerId) return;
      await apiSetDiagramFolder(ownerId, diagramId, null, null).catch(() => {});
      track('Team', 'Removed', 'Diagram');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Rename a team diagram in place. Any joined member may edit it
  // (spec/35), gated server-side by canEditDiagram.
  const renameDiagram = useCallback(
    async (diagramId: string, name: string) => {
      if (!ownerId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      await apiSaveDiagramMeta(ownerId, { id: diagramId, name: trimmed }).catch(() => {});
      track('Diagram', 'Renamed');
      await refresh();
    },
    [ownerId, refresh],
  );

  // Duplicate a team diagram, keeping the copy IN the team alongside
  // the original (same folder). duplicateDiagramApi mints a personal
  // copy first; we then file it into this team + folder (spec/35).
  const duplicateDiagram = useCallback(
    async (diagramId: string) => {
      if (!ownerId) return;
      const sourceFolderId = diagrams.find((d) => d.id === diagramId)?.folderId ?? null;
      const newId = await duplicateDiagramApi(ownerId, diagramId);
      if (!newId) return;
      await apiSetDiagramFolder(ownerId, newId, sourceFolderId, teamId).catch(() => {});
      track('Diagram', 'Duplicated');
      await refresh();
    },
    [ownerId, teamId, diagrams, refresh],
  );

  return {
    folders,
    diagrams,
    loading,
    refresh,
    folderById,
    childrenByParent,
    rootFolders,
    diagramsByFolder,
    breadcrumb,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveDiagram,
    removeDiagramFromTeam,
    renameDiagram,
    duplicateDiagram,
  };
}
