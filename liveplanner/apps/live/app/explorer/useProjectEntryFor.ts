'use client';

// A project's Explorer menu for a surface that names projects by id rather than drawing the Explorer's own rows:
// Home's Jump Back In cards (docs/specs/013-workspace/explorer-home.md "Jump Back In"). The id is resolved against the Explorer's already-loaded lists
// (personal, team and shared-with-you projects), the set Recent draws from, and the Explorer's project actions are
// bound to it, as projectEntryPropsFor binds them for a view's rows. An id the Explorer has not loaded resolves to
// nothing: a menu of guesses is worse than none.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useExplorer } from './ExplorerContext';
import type { ProjectEntryProps } from './explorer-view-props';
import { sharedToPaneProject, type PaneProject } from './views';

/** Every project the Explorer has loaded, by id: personal, team, then shared with you. */
export function useExplorerProjectsById(): ReadonlyMap<string, PaneProject> {
  const { projects, teamProjects, shared } = useExplorer();
  return useMemo(() => {
    const map = new Map<string, PaneProject>();
    for (const d of projects) map.set(d.id, d);
    for (const d of teamProjects) map.set(d.id, d);
    for (const s of shared) map.set(s.id, sharedToPaneProject(s));
    return map;
  }, [projects, teamProjects, shared]);
}

export type ProjectEntryFor = {
  /** The project's menu props, or null when the Explorer has not loaded it. */
  entryFor: (id: string) => ProjectEntryProps | null;
  /**
   * True once a project the Explorer had loaded has left its lists: moved to the Trash or taken off Shared With
   * Me. False again if it comes back (an undone delete).
   */
  isGone: (id: string) => boolean;
};

export function useProjectEntryFor({
  onShowHistory,
}: {
  /** Opens one project's history; omitted where the surface has no history dialog. */
  onShowHistory?: (id: string, name: string) => void;
}): ProjectEntryFor {
  const {
    ownerId,
    renamingProjectId,
    setRenamingProjectId,
    renameProject,
    deleteProject,
    duplicateProject,
    openMovePickerForProject,
    dismissShared,
    favouriteIds,
    toggleFavourite,
    prefs,
    toggleRecentExclusion,
  } = useExplorer();
  const byId = useExplorerProjectsById();

  // Ids seen in the lists, so a project leaving them reads as gone rather than as not loaded yet. Recorded after
  // each render: a project is always seen a render before it can leave.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const id of byId.keys()) seen.current.add(id);
  }, [byId]);

  const recentExcluded = prefs.recentExcludedIds;

  const entryFor = useCallback(
    (id: string): ProjectEntryProps | null => {
      const d = byId.get(id);
      if (!d) return null;
      return {
        project: d,
        ownerId,
        renaming: renamingProjectId === id,
        onStartRename: () => setRenamingProjectId(id),
        onCommitRename: (name) => renameProject(id, name),
        onCancelRename: () => setRenamingProjectId(null),
        onDuplicate: () => void duplicateProject(id),
        onDelete: () => void deleteProject(id),
        onMove: (anchor) => openMovePickerForProject(id, anchor),
        onDismiss: d.shared ? () => void dismissShared(id) : undefined,
        favourite: favouriteIds.has(id),
        onToggleFavourite: () => toggleFavourite(id),
        recentExcluded: recentExcluded?.includes(id) === true,
        onToggleRecentExclusion: () => toggleRecentExclusion(id),
        // Offline projects never reach the worker, so they have no server history to show
        // (docs/specs/006-project/offline-mode.md).
        onShowHistory:
          onShowHistory && !isOfflineIdSync(id) ? () => onShowHistory(id, d.name) : undefined,
      };
    },
    [
      byId,
      ownerId,
      renamingProjectId,
      setRenamingProjectId,
      renameProject,
      duplicateProject,
      deleteProject,
      openMovePickerForProject,
      dismissShared,
      favouriteIds,
      toggleFavourite,
      recentExcluded,
      toggleRecentExclusion,
      onShowHistory,
    ],
  );

  const isGone = useCallback((id: string) => seen.current.has(id) && !byId.has(id), [byId]);

  return { entryFor, isGone };
}
