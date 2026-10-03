'use client';

import { createContext, useContext } from 'react';
import type { TeamFolderHandlers } from '../Explorer.types';

// What every row of the floating Explorer panel's tree can reach
// (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel): the panel's
// expansion, the open document, and the verbs the host wired. Handed down once by
// PanelExplorerTree rather than threaded through every level of the recursion.
export type PanelTree = {
  // The VIEWER's owner id, for thumbnails and Offline Mode conversions in the menus.
  ownerId: string | null;
  currentDocumentId: string | null;
  // Ids mid slide-out after a delete (useExplorerRowDelete).
  exitingDocumentIds: Set<string>;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onOpenDocument: (id: string, shareCode?: string) => void;
  onDeleteDocument?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDocument?: (id: string) => void;
  onMoveDocumentRequest?: (id: string) => void;
  onMoveTeamDocumentRequest?: (id: string, teamId: string) => void;
  // Present = the reader's own rows drag onto personal folders and My documents.
  onMoveDocumentToFolder?: (documentId: string, folderId: string | null) => void;
  onDismissShared?: (id: string) => void;
  favouriteIds?: Set<string>;
  onToggleFavourite?: (id: string) => void;
  recentExcludedIds?: string[];
  onToggleRecentExclusion?: (id: string) => void;
  // A folder just created opens renaming.
  pendingRenameFolderId: string | null;
  onRenameFolderCommitted: () => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onTeamFolders?: TeamFolderHandlers;
  onCreateTeamChild: (teamId: string, parentId: string | null) => void;
};

const PanelTreeContext = createContext<PanelTree | null>(null);
export const PanelTreeProvider = PanelTreeContext.Provider;

export function usePanelTree(): PanelTree {
  const tree = useContext(PanelTreeContext);
  if (!tree) throw new Error('usePanelTree outside PanelExplorerTree');
  return tree;
}
