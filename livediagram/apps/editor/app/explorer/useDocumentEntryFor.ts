'use client';

// A document's Explorer menu for a surface that names documents by id rather than drawing the Explorer's own rows:
// Home's Jump Back In cards (docs/specs/013-workspace/explorer-home.md "Jump Back In") and the Timeline's cards
// (docs/specs/013-workspace/timeline.md §2.8). The id is resolved against the Explorer's already-loaded lists
// (personal, team and shared-with-you documents), the set Recent draws from, and the Explorer's document actions are
// bound to it, as documentEntryPropsFor binds them for a view's rows. An id the Explorer has not loaded resolves to
// nothing: a menu of guesses is worse than none.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useExplorer } from './ExplorerContext';
import type { DocumentEntryProps } from './explorer-view-props';
import { sharedToPaneDocument, type PaneDocument } from './views';

/** Every document the Explorer has loaded, by id: personal, team, then shared with you. */
export function useExplorerDocumentsById(): ReadonlyMap<string, PaneDocument> {
  const { documents, teamDocuments, shared } = useExplorer();
  return useMemo(() => {
    const map = new Map<string, PaneDocument>();
    for (const d of documents) map.set(d.id, d);
    for (const d of teamDocuments) map.set(d.id, d);
    for (const s of shared) map.set(s.id, sharedToPaneDocument(s));
    return map;
  }, [documents, teamDocuments, shared]);
}

export type DocumentEntryFor = {
  /** The document's menu props, or null when the Explorer has not loaded it. */
  entryFor: (id: string) => DocumentEntryProps | null;
  /**
   * True once a document the Explorer had loaded has left its lists: moved to the Trash or taken off Shared With
   * Me. False again if it comes back (an undone delete).
   */
  isGone: (id: string) => boolean;
};

export function useDocumentEntryFor({
  onShowHistory,
}: {
  /** Opens one document's history; omitted where the surface has no history dialog. */
  onShowHistory?: (id: string, name: string) => void;
}): DocumentEntryFor {
  const {
    ownerId,
    renamingDocumentId,
    setRenamingDocumentId,
    renameDocument,
    deleteDocument,
    duplicateDocument,
    openMovePickerForDocument,
    dismissShared,
    favouriteIds,
    toggleFavourite,
    prefs,
    toggleRecentExclusion,
  } = useExplorer();
  const byId = useExplorerDocumentsById();

  // Ids seen in the lists, so a document leaving them reads as gone rather than as not loaded yet. Recorded after
  // each render: a document is always seen a render before it can leave.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const id of byId.keys()) seen.current.add(id);
  }, [byId]);

  const recentExcluded = prefs.recentExcludedIds;

  const entryFor = useCallback(
    (id: string): DocumentEntryProps | null => {
      const d = byId.get(id);
      if (!d) return null;
      return {
        document: d,
        ownerId,
        renaming: renamingDocumentId === id,
        onStartRename: () => setRenamingDocumentId(id),
        onCommitRename: (name) => renameDocument(id, name),
        onCancelRename: () => setRenamingDocumentId(null),
        onDuplicate: () => void duplicateDocument(id),
        onDelete: () => void deleteDocument(id),
        onMove: (anchor) => openMovePickerForDocument(id, anchor),
        onDismiss: d.shared ? () => void dismissShared(id) : undefined,
        favourite: favouriteIds.has(id),
        onToggleFavourite: () => toggleFavourite(id),
        recentExcluded: recentExcluded?.includes(id) === true,
        onToggleRecentExclusion: () => toggleRecentExclusion(id),
        // Offline documents never reach the worker, so they have no server history to show
        // (docs/specs/006-document/offline-mode.md).
        onShowHistory:
          onShowHistory && !isOfflineIdSync(id) ? () => onShowHistory(id, d.name) : undefined,
      };
    },
    [
      byId,
      ownerId,
      renamingDocumentId,
      setRenamingDocumentId,
      renameDocument,
      duplicateDocument,
      deleteDocument,
      openMovePickerForDocument,
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
