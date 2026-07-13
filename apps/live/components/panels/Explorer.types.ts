import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { TeamDiagramRow, TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';

export type ExplorerProps = {
  position: { x: number; y: number } | null;
  // Every diagram known to the local store. Current diagram is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  diagrams: DiagramListItem[];
  // The VIEWER's resolved owner id (self/participant id), threaded down
  // to each DiagramRow so its thumbnail fetch authenticates as the
  // viewer. Distinct from a diagram's own ownerId.
  ownerId: string | null;
  // Every folder for the owner. Empty array = no user folders, but
  // the synthetic Unsorted bucket still renders. See spec/15.
  folders: Folder[];
  // Diagrams shared with the current owner (read-only or edit
  // visitor entries). Empty array hides the section entirely so
  // pure-private users don't see an empty accordion.
  shared?: SharedWithItem[];
  // Teams the signed-in user belongs to + their swept libraries
  // (spec/35). Drive the Teams accordion, team rows in Recent, and the
  // current-team-diagram row. Empty / omitted = no Teams section (the
  // common guest / no-teams case).
  teams?: { id: string; name: string }[];
  teamFolders?: TeamFolderRow[];
  teamDiagrams?: TeamDiagramRow[];
  // The caller's resolved owner id. Team-diagram rows expose a hard
  // Dismiss a single Shared row — drops the shared_with reference
  // server-side so the row no longer surfaces. Optional so consumers
  // that haven't wired the api endpoint can omit it.
  onDismissShared?: (diagramId: string) => void;
  // Navigate to the standalone /live/explorer page. When set, the
  // panel header surfaces an "Expand" button next to the title.
  // True while the initial diagram-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // diagrams" before the API call resolves.
  loading: boolean;
  currentDiagramId: string | null;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  // Optional so consumers that have nowhere to mint a new diagram
  // (e.g. the welcome route, which IS the new-diagram flow) can hide
  // the button entirely. When omitted the row isn't rendered.
  onNewDiagram?: () => void;
  // Optional row-level actions. When provided, each row renders an
  // ellipsis menu that delegates to these handlers.
  onRenameCurrent?: (name: string) => void;
  // Opens the editor's Share dialog in place for the CURRENT diagram's
  // row (its Share tile would otherwise navigate with `?share=1` and
  // reload the very editor session the user is in). Optional: surfaces
  // without a live editor session (status pages, /explorer) omit it and
  // keep the navigation fallback.
  onOpenShareCurrent?: () => void;
  // `beforeRemove` runs after the delete is confirmed and before the row is
  // pulled from the list, so the caller (Explorer) can slide it out first.
  // `opts.skipConfirm` is passed by the panel because it confirms inline
  // via ConfirmPopover (the modal would double-prompt).
  onDeleteDiagram?: (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => void;
  onDuplicateDiagram?: (id: string) => void;
  // Folder mutations. Optional so read-only surfaces can omit them.
  onCreateFolder?: (input: { name: string; parentId: string | null }) => Promise<Folder | void>;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
  // Scope-aware move (spec/35): routes a pick that involves a team on
  // either side (re-folder within a team, personal -> team, team ->
  // personal). When wired, the move picker offers every space.
  onMoveDiagramTo?: (
    diagramId: string,
    dest: { teamId: string | null; folderId: string | null },
  ) => void;
  // Callback the Canvas wires up to track Explorer's bottom edge so
  // the Palette can stack beneath it on mobile (where Explorer
  // banner-pins to the top of the viewport rather than the left
  // corner). Optional: desktop layout doesn't need it.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // Corner-docking bundle (spec/63), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  mobileTopOverridePx?: number;
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
};
