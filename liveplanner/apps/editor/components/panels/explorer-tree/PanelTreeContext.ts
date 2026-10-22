'use client';

import { createContext, useContext } from 'react';
import type { TeamFolderHandlers } from '../Explorer.types';
import type { PaneProject } from '@/app/explorer/views';
import type { DefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';

// What every row of the floating Explorer panel's tree can reach
// (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel): the panel's
// expansion, the open project, and the verbs the host wired. Handed down once by
// PanelExplorerTree rather than threaded through every level of the recursion.
export type PanelTree = {
  // The VIEWER's owner id, for thumbnails and Offline Mode conversions in the menus.
  ownerId: string | null;
  currentProjectId: string | null;
  // Ids mid slide-out after a delete (useExplorerRowDelete).
  exitingProjectIds: Set<string>;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  // Any project the reader can reach, by id: the pane's views (Home) give it its menu.
  projectById?: (id: string) => PaneProject | undefined;
  // Opens a folder in the pane (its subfolders, then its projects, under a breadcrumb).
  onOpenFolder?: (folderId: string) => void;
  onOpenProject: (id: string, shareCode?: string) => void;
  onDeleteProject?: (id: string, anchor: HTMLElement | null) => void;
  onDuplicateProject?: (id: string) => void;
  onMoveProjectRequest?: (id: string) => void;
  onMoveTeamProjectRequest?: (id: string, teamId: string) => void;
  // Present = the reader's own rows drag onto personal folders and My Projects.
  onMoveProjectToFolder?: (projectId: string, folderId: string | null) => void;
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
