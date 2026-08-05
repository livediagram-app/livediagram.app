import type { Folder } from '@/lib/api-client';
import type { FolderPreviewContents } from '@/app/explorer/folder-preview-tiles';
import type { PaneDiagram } from '@/app/explorer/views';

// The props an Explorer pane view takes, shared by ListView and CardView.
//
// ExplorerPane picks between the two at render time
// (`viewMode === 'card' ? CardView : ListView`) off a single props object,
// which only works while the two agree on every prop. CardView's header has
// always said it "takes the SAME props as ListView"; until this type existed,
// nothing checked that claim, and the two ~40-line inline declarations had
// already drifted apart in their comments.
//
// ListView deliberately accepts one prop it never reads (`folderContents`,
// noted below). That is not an oversight to tidy up: it is the price of one
// props object serving both views, and it is cheaper than the alternative of
// ExplorerPane branching its object construction on the view mode.
export type FolderActions = (
  f: Folder,
  anchor: HTMLElement | null,
) => { rename: () => void; newSubfolder: () => void; move: () => void; delete: () => void };

export type ExplorerViewProps = {
  folders: Folder[];
  diagrams: PaneDiagram[];
  // Viewer identity, threaded to each row's thumbnail fetch (spec/67).
  // Null while a guest id is still resolving.
  ownerId: string | null;
  // Adds the desktop Owner column (Recent: "You" vs the team name).
  showOwner?: boolean;
  // True on the "All diagrams" (My Work) view: the synthetic Unsorted
  // row renders at the very top so the root has the same "folder row per
  // child" feel as any non-root folder. Always shown there now (even
  // empty, badge hidden at zero) so My Work isn't bare before anything
  // is filed; Generated renders next to it the same way (spec/15).
  showUnsortedRow: boolean;
  unsortedCount: number;
  onOpenUnsorted: () => void;
  // The Generated synthetic folder row, shown on the My Work (/all) list
  // beside Unsorted (spec/15). Optional: defaults to hidden.
  showGeneratedRow?: boolean;
  generatedCount?: number;
  onOpenGenerated?: () => void;
  // The Offline synthetic folder row (spec/76): diagrams saved only in this
  // browser. Shown on the My Work (/all) list beside Generated.
  showOfflineRow?: boolean;
  offlineCount?: number;
  onOpenOffline?: () => void;
  // The "Dynamic" parent folder row on My Work (/all): opens the
  // /explorer/dynamic view listing the three synthetic folders.
  showDynamicRow?: boolean;
  dynamicCount?: number;
  onOpenDynamic?: () => void;
  onOpenFolder: (id: string) => void;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  renamingFolderId: string | null;
  renamingDiagramId: string | null;
  onCommitRenameDiagram: (id: string, name: string) => void;
  onCancelRenameDiagram: () => void;
  folderActions: FolderActions;
  onStartRenameDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onMoveDiagram: (id: string, anchor: HTMLElement | null) => void;
  // Shared-row action (spec/35), used by Recent's "shared with me" rows.
  onDismissShared?: (id: string) => void;
  // Hide / show in Recent (spec/93).
  recentExcludedIds?: string[];
  // Per-user stars (spec/95).
  favouriteIds?: Set<string>;
  onToggleFavourite?: (id: string) => void;
  // Resolves a row's folder chip (spec/94). Null / omitted = no chip,
  // which is every pane except Recent.
  folderChipFor?: (d: PaneDiagram) => { label: string; onOpen: () => void } | null;
  onToggleRecentExclusion?: (id: string) => void;
  // Opens the diagram's own Timeline (spec/138 §3.4).
  onShowHistory?: (id: string) => void;
  childrenCount: (id: string) => number;
  diagramsCount: (id: string) => number;
  // What a folder directly contains, for its card's content preview
  // (spec/99). Omitted = no preview, just the folder glyph.
  //
  // Card view only: list rows keep their count badge instead, since four
  // snapshots don't fit a row. ListView accepts and ignores it so
  // ExplorerPane can keep building ONE props object for both views.
  folderContents?: (id: string) => FolderPreviewContents;
};

// CardView's two extras. Both are genuinely card-shaped, so they stay off the
// shared type rather than being declared-and-ignored by the list.
export type CardViewProps = ExplorerViewProps & {
  // Team library cards (spec/35) hide the visibility badge: every diagram
  // in that grid is a team diagram, so a per-card "Team"/"Private" badge is
  // noise — its list view omits it too. Defaults on for the Explorer.
  showVisibilityBadge?: boolean;
  // Where the diagram lives (spec/94). Recent only.
  folderChip?: { label: string; onOpen: () => void } | null;
};

/**
 * The per-diagram props both entry components take: `DiagramRow` in the list
 * view and `DiagramCard` in the card view.
 *
 * The two render very differently and share nothing else, but they answer the
 * same question — what can you do with this diagram — so their call sites in
 * views.tsx and CardView.tsx were sixteen identical bindings each. Adding an
 * action meant remembering both, and forgetting one loses it from a whole view
 * with nothing to notice: the component simply never receives the handler.
 *
 * Sharing the TYPE rather than a mapper keeps each component's own JSX intact
 * and still makes the compiler ask the question, because a new required prop
 * fails at both call sites at once.
 */
export type DiagramEntryProps = {
  diagram: PaneDiagram;
  // Viewer identity for the thumbnail fetch (spec/67). Null while a guest id
  // is still resolving; the thumbnail holds its placeholder.
  ownerId: string | null;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  // Shared-row menu action (spec/35): drop it from "Shared with me".
  onDismiss?: () => void;
  // Per-user star (spec/95).
  favourite?: boolean;
  onToggleFavourite?: () => void;
  // Hide / show in Recent (spec/93).
  recentExcluded?: boolean;
  onToggleRecentExclusion?: () => void;
  onShowHistory?: () => void;
  // Adds the desktop Owner cell ("You", the team name, or the sharer).
  showOwner?: boolean;
  // Where the diagram lives (spec/94). Recent only — every other pane IS a
  // folder, so the chip would just repeat its own title.
  folderChip?: { label: string; onOpen: () => void } | null;
};
