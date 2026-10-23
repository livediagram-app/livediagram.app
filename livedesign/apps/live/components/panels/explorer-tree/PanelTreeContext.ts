'use client';

import { createContext, useContext } from 'react';
import type { TeamFolderHandlers } from '../Explorer.types';
import type { PaneDesign } from '@/app/explorer/views';
import type { DefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';

// What every row of the floating Explorer panel's tree can reach
// (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel): the panel's
// expansion, the open design, and the verbs the host wired. Handed down once by
// PanelExplorerTree rather than threaded through every level of the recursion.
export type PanelTree = {
  // The VIEWER's owner id, for thumbnails and Offline Mode conversions in the menus.
  ownerId: string | null;
  currentDesignId: string | null;
  // Ids mid slide-out after a delete (useExplorerRowDelete).
  exitingDesignIds: Set<string>;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  // Any design the reader can reach, by id: the pane's views (Home, the Timeline) give it its menu.
  designById?: (id: string) => PaneDesign | undefined;
  // Opens a folder in the pane (its subfolders, then its designs, under a breadcrumb).
  onOpenFolder?: (folderId: string) => void;
  onOpenDesign: (id: string, shareCode?: string) => void;
  onDeleteDesign?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateDesign?: (id: string) => void;
  onMoveDesignRequest?: (id: string) => void;
  onMoveTeamDesignRequest?: (id: string, teamId: string) => void;
  // Present = the reader's own rows drag onto personal folders and My Work.
  onMoveDesignToFolder?: (designId: string, folderId: string | null) => void;
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
  // "Use as Default for" (docs/specs/013-workspace/default-folders.md), set by PanelExplorerTree.
  defaultFolders?: DefaultFolderMenus;
};

const PanelTreeContext = createContext<PanelTree | null>(null);
export const PanelTreeProvider = PanelTreeContext.Provider;

export function usePanelTree(): PanelTree {
  const tree = useContext(PanelTreeContext);
  if (!tree) throw new Error('usePanelTree outside PanelExplorerTree');
  return tree;
}
