import type { ProjectListItem, Folder, SharedWithItem } from '@/lib/api-client';
import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MovablePanelPopoverProps } from '@/components/primitives/MovablePanel.types';
import type { TeamProjectRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';

// Folder mutations inside a team library, for the panel's team tree.
// Create returns the new folder so the tree can open its parent and
// start renaming it, the way the personal tree does.
export type TeamFolderHandlers = {
  create: (teamId: string, parentId: string | null) => Promise<{ id: string } | undefined>;
  rename: (id: string, name: string) => void;
  delete: (id: string) => void;
};

export type ExplorerProps = {
  position: { x: number; y: number } | null;
  // Every project known to the local store. Current project is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  projects: ProjectListItem[];
  // The VIEWER's resolved owner id (self/participant id), threaded down
  // to each ProjectRow so its thumbnail fetch authenticates as the
  // viewer. Distinct from a project's own ownerId.
  ownerId: string | null;
  // Every folder for the owner. Empty array = no user folders, but
  // My Projects still renders. See docs/specs/013-workspace/folders.md.
  folders: Folder[];
  // Projects shared with the current owner (read-only or edit
  // visitor entries). Empty array hides the section entirely so
  // pure-private users don't see an empty accordion.
  shared?: SharedWithItem[];
  // Teams the signed-in user belongs to + their swept libraries
  // (docs/specs/013-workspace/team-shared-projects.md). Drive the Teams accordion, team rows in Recent, and the
  // current-team-project row. Empty / omitted = no Teams section (the
  // common guest / no-teams case).
  teams?: { id: string; name: string }[];
  teamFolders?: TeamFolderRow[];
  teamProjects?: TeamProjectRow[];
  // The caller's resolved owner id. Team-project rows expose a hard
  // Dismiss a single Shared row — drops the shared_with reference
  // server-side so the row no longer surfaces. Optional so consumers
  // that haven't wired the api endpoint can omit it.
  onDismissShared?: (projectId: string) => void;
  // Navigate to the standalone /live/explorer page. When set, the
  // panel header surfaces an "Expand" button next to the title.
  // True while the initial project-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // projects" before the API call resolves.
  loading: boolean;
  currentProjectId: string | null;
  // Projects this user hid from Recent, and the toggle (docs/specs/013-workspace/hide-from-recent.md). Recent
  // is the only section that honours the list.
  recentExcludedIds: string[];
  onToggleRecentExclusion: (projectId: string) => void;
  // Per-user stars (docs/specs/013-workspace/favourites.md).
  favouriteIds: Set<string>;
  onToggleFavourite: (projectId: string) => void;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  onOpenProject: (id: string, shareCode?: string) => void;
  // Optional so consumers that have nowhere to mint a new project
  // (e.g. the welcome route, which IS the new-project flow) can hide
  // the button entirely. When omitted the row isn't rendered.
  onNewProject?: () => void;
  // Optional row-level actions. When provided, each row renders an
  // ellipsis menu that delegates to these handlers.
  onRenameCurrent?: (name: string) => void;
  // `beforeRemove` runs before the row is pulled from the list, so the caller (Explorer) can slide it out first;
  // `opts.onRestored` after an Undo, for a row the list does not hold (a team row the panel hid).
  onDeleteProject?: (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { onRestored?: () => void; name?: string },
  ) => void;
  onDuplicateProject?: (id: string) => void;
  // Folder mutations. Optional so read-only surfaces can omit them.
  onCreateFolder?: (input: { name: string; parentId: string | null }) => Promise<Folder | void>;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  // The same three for a TEAM's folders (docs/specs/013-workspace/team-shared-projects.md): the panel's team tree
  // offers rename / new subfolder / delete like the personal tree. Absent
  // = the team tree is browse-only.
  onTeamFolders?: TeamFolderHandlers;
  onMoveProjectToFolder?: (projectId: string, folderId: string | null) => void;
  // The panel's Trash restored or deleted a project: the host refetches its lists.
  onLibraryChanged?: () => void;
  // Scope-aware move (docs/specs/013-workspace/team-shared-projects.md): routes a pick that involves a team on
  // either side (re-folder within a team, personal -> team, team ->
  // personal). When wired, the move picker offers every space.
  onMoveProjectTo?: (
    projectId: string,
    dest: { teamId: string | null; folderId: string | null },
    // Where the project is coming from (null = the personal tree), so a
    // personal -> team move counts as Team·Added·Project (docs/specs/017-telemetry/telemetry.md).
    fromTeamId?: string | null,
  ) => void;
  // The header ⋯ menu's verbs beyond new / open (docs/specs/013-workspace/folders.md). Each optional:
  // an absent handler drops its row.
  menuActions?: ExplorerMenuActions;
  // Corner-docking bundle (docs/specs/007-editor/panel-docking.md), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
  // The Toolbar layout's popover under the menu button
  // (docs/specs/007-editor/toolbar-layout.md), forwarded to the inner MovablePanel.
} & MovablePanelPopoverProps;

export type ExplorerMenuActions = {
  onShare?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  onOpenSettings?: () => void;
};
