'use client';

// A design's Explorer menu for a surface that names designs by id rather than drawing the Explorer's own rows:
// Home's Jump Back In cards (docs/specs/013-workspace/explorer-home.md "Jump Back In") and the Timeline's cards
// (docs/specs/013-workspace/timeline.md §2.8). The id is resolved against the Explorer's already-loaded lists
// (personal, team and shared-with-you designs), the set Recent draws from, and the Explorer's design actions are
// bound to it, as designEntryPropsFor binds them for a view's rows. An id the Explorer has not loaded resolves to
// nothing: a menu of guesses is worse than none.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useExplorer } from './ExplorerContext';
import type { DesignEntryProps } from './explorer-view-props';
import { sharedToPaneDesign, type PaneDesign } from './views';

/** Every design the Explorer has loaded, by id: personal, team, then shared with you. */
export function useExplorerDesignsById(): ReadonlyMap<string, PaneDesign> {
  const { designs, teamDesigns, shared } = useExplorer();
  return useMemo(() => {
    const map = new Map<string, PaneDesign>();
    for (const d of designs) map.set(d.id, d);
    for (const d of teamDesigns) map.set(d.id, d);
    for (const s of shared) map.set(s.id, sharedToPaneDesign(s));
    return map;
  }, [designs, teamDesigns, shared]);
}

export type DesignEntryFor = {
  /** The design's menu props, or null when the Explorer has not loaded it. */
  entryFor: (id: string) => DesignEntryProps | null;
  /**
   * True once a design the Explorer had loaded has left its lists: moved to the Trash or taken off Shared With
   * Me. False again if it comes back (an undone delete).
   */
  isGone: (id: string) => boolean;
};

export function useDesignEntryFor({
  onShowHistory,
}: {
  /** Opens one design's history; omitted where the surface has no history dialog. */
  onShowHistory?: (id: string, name: string) => void;
}): DesignEntryFor {
  const {
    ownerId,
    renamingDesignId,
    setRenamingDesignId,
    renameDesign,
    deleteDesign,
    duplicateDesign,
    openMovePickerForDesign,
    dismissShared,
    favouriteIds,
    toggleFavourite,
    prefs,
    toggleRecentExclusion,
  } = useExplorer();
  const byId = useExplorerDesignsById();

  // Ids seen in the lists, so a design leaving them reads as gone rather than as not loaded yet. Recorded after
  // each render: a design is always seen a render before it can leave.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const id of byId.keys()) seen.current.add(id);
  }, [byId]);

  const recentExcluded = prefs.recentExcludedIds;

  const entryFor = useCallback(
    (id: string): DesignEntryProps | null => {
      const d = byId.get(id);
      if (!d) return null;
      return {
        design: d,
        ownerId,
        renaming: renamingDesignId === id,
        onStartRename: () => setRenamingDesignId(id),
        onCommitRename: (name) => renameDesign(id, name),
        onCancelRename: () => setRenamingDesignId(null),
        onDuplicate: () => void duplicateDesign(id),
        onDelete: () => void deleteDesign(id),
        onMove: (anchor) => openMovePickerForDesign(id, anchor),
        onDismiss: d.shared ? () => void dismissShared(id) : undefined,
        favourite: favouriteIds.has(id),
        onToggleFavourite: () => toggleFavourite(id),
        recentExcluded: recentExcluded?.includes(id) === true,
        onToggleRecentExclusion: () => toggleRecentExclusion(id),
        // Offline designs never reach the worker, so they have no server history to show
        // (docs/specs/006-design/offline-mode.md).
        onShowHistory:
          onShowHistory && !isOfflineIdSync(id) ? () => onShowHistory(id, d.name) : undefined,
      };
    },
    [
      byId,
      ownerId,
      renamingDesignId,
      setRenamingDesignId,
      renameDesign,
      duplicateDesign,
      deleteDesign,
      openMovePickerForDesign,
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
