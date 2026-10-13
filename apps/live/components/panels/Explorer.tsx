'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ProductNavLinks } from '@livediagram/ui';
import { DocumentRowShell } from './DocumentRowShell';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { apiCreateFolder } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import {
  isTreeSection,
  PanelExplorerTree,
} from '@/components/panels/explorer-tree/PanelExplorerTree';
import type { PanelTree } from '@/components/panels/explorer-tree/PanelTreeContext';
import { ExplorerRail } from '@/components/panels/explorer-panel/ExplorerRail';
import { ExplorerPanelPane } from '@/components/panels/explorer-panel/ExplorerPanelPane';
import { ExplorerCurrentDocument } from '@/components/panels/explorer-panel/ExplorerCurrentDocument';
import { useExplorerPanelSection } from '@/components/panels/explorer-panel/useExplorerPanelSection';
import {
  panelSectionGroups,
  sectionKey,
  sectionLabel,
} from '@/components/panels/explorer-panel/panel-sections';
import { sidebarDivider } from '@/app/explorer/sidebar/sidebar-structure';

import type { ExplorerProps } from './Explorer.types';
import { useExplorerViewModel } from './useExplorerViewModel';
import { useExplorerRowDelete } from './useExplorerRowDelete';
import { deleteConfirmationMessage } from '@/lib/delete-confirmation';

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
//
// Wrapped in React.memo at the export below so it skips re-rendering on
// the editor's per-drag-frame churn: CanvasChrome stabilises its handler
// props (useStableCallbacks) and EditorView memoises its list/team
// props, so shallow prop equality holds while a shape is being dragged.
function ExplorerImpl({
  position,
  documents: liveDocs,
  ownerId,
  folders,
  loading,
  currentDocumentId,
  onMoveTo,
  onReset,
  onOpenDocument,
  onNewDocument,
  menuActions,
  onRenameCurrent,
  onDeleteDocument,
  onDuplicateDocument,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onTeamFolders,
  onMoveDocumentToFolder,
  onMoveDocumentTo,
  shared = [],
  teams = [],
  teamFolders = [],
  teamDocuments = [],
  onDismissShared,
  dock,
  popoverOpen,
  onPopoverClose,
  popoverAnchor,
  asPopover,
  dismissOnOutside,
  recentExcludedIds,
  onToggleRecentExclusion,
  favouriteIds,
  onToggleFavourite,
  onLibraryChanged,
}: ExplorerProps) {
  const minimalChrome = useMinimalChrome();
  // Mobile viewport ⇒ render nothing. Mobile users reach the
  // Explorer from the AuthControls "Explorer" menu item (docs/specs/007-editor/live-app.md)
  // instead, freeing the small canvas of the floating panel and
  // its bottom-dock entry point. The shared useIsMobileViewport hook
  // re-renders on a desktop → mobile resize / device-rotate, so the
  // panel flips without a page reload, and a client mount reads the
  // query synchronously, so it never paints a desktop-shaped panel a
  // tick before correcting.
  // Previously Explorer was hidden entirely on mobile (the canvas is
  // small enough that the panel ate the whole screen), but signed-out
  // users had no other way to switch documents, so the panel now also
  // shows on mobile, banner-collapsed at the very top of the viewport
  // above the Palette.
  const isMobile = useIsMobileViewport();
  // Expansion state for each row of the tree (keyed by folder or team id, or
  // a prefixed key such as `space:my-documents` for the fixed rows).
  // Team rows + team folders share this map too (ids are globally
  // unique). Defaults to all collapsed so the panel stays compact.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the document row whose Move dialog is open (`teamId` set =
  // it's a team-library document, so the picker opens on that team and a
  // pick routes through the scope-aware onMoveDocumentTo). Stored here
  // (vs. in DocumentRow) so the modal doesn't nest inside row portals.
  const [moveTarget, setMoveTarget] = useState<{ id: string; teamId: string | null } | null>(null);
  // Folder id newly created via the New folder button — used to drop
  // the row into rename mode immediately after the API returns.
  const [pendingRenameFolderId, setPendingRenameFolderId] = useState<string | null>(null);
  // Row delete lifecycle (confirm popover, exit animation, optimistic
  // team-row hide + pruning) lives in useExplorerRowDelete.
  const {
    exitingDocumentIds,
    deleteConfirm,
    setDeleteConfirm,
    deletedTeamIds,
    openDeleteConfirm,
    runDelete,
  } = useExplorerRowDelete({ documents: liveDocs, teamDocuments, ownerId, onDeleteDocument });

  // (Previously: `if (hideOnMobile) return null;` — Explorer now
  // renders on mobile too, banner-collapsed by default. The panel
  // sits at the top of the canvas above the Palette.)

  // All derived collections below are useMemo'd against their real
  // inputs (documents, folders, currentDocumentId): Explorer holds a
  // pile of internal state (accordion open flags, expandedFolders,
  // moveTargetDocumentId, exitingDocumentIds) that re-renders the component
  // frequently without changing the underlying lists. Without these
  // memos every accordion toggle rebuilt foldersByParent +
  // documentsByFolder + sorted both, and re-walked the folder tree
  // just to render a different chevron.
  const {
    current,
    currentTeam,
    currentShared,
    foldersByTeam,
    documentsByTeam,
    foldersByParent,
    documentsByFolder,
    offlineDocuments,
  } = useExplorerViewModel({
    documents: liveDocs,
    folders,
    currentDocumentId,
    shared,
    teamFolders,
    teamDocuments,
    deletedTeamIds,
  });

  const toggleFolder = (key: string) =>
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  // Stable, so a folder row's effect that clears the request runs once.
  const clearPendingRename = useCallback(() => setPendingRenameFolderId(null), []);

  const handleCreateChild = async (parentId: string) => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId });
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
      setPendingRenameFolderId(folder.id);
    }
  };
  // The team tree's New Subfolder: same gesture, the team's library.
  const handleCreateTeamChild = async (teamId: string, parentId: string | null) => {
    if (!onTeamFolders) return;
    const folder = await onTeamFolders.create(teamId, parentId);
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId ?? teamId]: true }));
      setPendingRenameFolderId(folder.id);
    }
  };

  // The anchor argument survives in the row-callback signature (the
  // delete flow's ConfirmPopover still anchors), but the move flow is
  // a centred modal now (docs/specs/013-workspace/folders.md) and ignores it.
  const openMovePicker = (documentId: string) => {
    setMoveTarget({ id: documentId, teamId: null });
  };

  const tree: PanelTree = {
    ownerId,
    currentDocumentId,
    exitingDocumentIds,
    expanded: expandedFolders,
    onToggle: toggleFolder,
    onOpenDocument,
    onDeleteDocument: openDeleteConfirm,
    onDuplicateDocument,
    onMoveDocumentRequest: onMoveDocumentToFolder ? openMovePicker : undefined,
    // A team row's move opens the picker for that team; the pick then routes through
    // the scope-aware onMoveDocumentTo (docs/specs/013-workspace/team-shared-documents.md).
    onMoveTeamDocumentRequest: onMoveDocumentTo
      ? (id, teamId) => setMoveTarget({ id, teamId })
      : undefined,
    onMoveDocumentToFolder,
    onDismissShared,
    favouriteIds,
    onToggleFavourite,
    recentExcludedIds,
    onToggleRecentExclusion,
    pendingRenameFolderId,
    onRenameFolderCommitted: clearPendingRename,
    onRenameFolder,
    onDeleteFolder,
    onCreateChild: (parentId) => void handleCreateChild(parentId),
    onTeamFolders,
    onCreateTeamChild: (teamId, parentId) => void handleCreateTeamChild(teamId, parentId),
  };

  // The rail's sections, and the one shown: remembered, else the space holding the open document.
  const divider = sidebarDivider(minimalChrome);
  const groups = useMemo(
    () => panelSectionGroups({ teams, hasBrowserDocuments: offlineDocuments.length > 0 }),
    [teams, offlineDocuments.length],
  );
  const [section, pick] = useExplorerPanelSection(groups);
  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = !asPopover || popoverOpen === true;
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name;
  const badges: Record<string, number | undefined> = {
    shared: shared.length || undefined,
    browser: offlineDocuments.length || undefined,
  };
  // New Folder at the root of My documents or of the team shown.
  const newFolder =
    section.kind === 'mine' && onCreateFolder
      ? () =>
          void onCreateFolder({ name: 'New folder', parentId: null }).then((folder) => {
            if (folder) setPendingRenameFolderId(folder.id);
          })
      : section.kind === 'team' && onTeamFolders
        ? () => void handleCreateTeamChild(section.id, null)
        : undefined;

  const currentCard = current ? (
    <DocumentRowShell exiting={exitingDocumentIds.has(current.id)}>
      <ExplorerCurrentDocument
        item={current}
        ownerId={ownerId}
        onOpen={() => onOpenDocument(current.id)}
        onRename={onRenameCurrent}
        onDelete={openDeleteConfirm ? (anchor) => openDeleteConfirm(current.id, anchor) : undefined}
        onDuplicate={onDuplicateDocument ? () => onDuplicateDocument(current.id) : undefined}
        onMoveRequest={onMoveDocumentToFolder ? () => openMovePicker(current.id) : undefined}
      />
    </DocumentRowShell>
  ) : currentTeam ? (
    <ExplorerCurrentDocument
      item={currentTeam}
      ownerId={ownerId}
      onOpen={() => onOpenDocument(currentTeam.id)}
      onRename={onRenameCurrent}
      // Any joined member may delete a team document (docs/specs/013-workspace/team-shared-documents.md); the api
      // enforces team membership.
      onDelete={
        openDeleteConfirm ? (anchor) => openDeleteConfirm(currentTeam.id, anchor) : undefined
      }
      onMoveRequest={
        onMoveDocumentTo
          ? () => setMoveTarget({ id: currentTeam.id, teamId: currentTeam.team.id })
          : undefined
      }
    />
  ) : currentShared ? (
    <ExplorerCurrentDocument
      item={{ ...currentShared, folderId: null, shareCode: null, ownerId: '' }}
      ownerId={ownerId}
      // The share code authorises the thumbnail (docs/specs/006-document/document-snapshots.md).
      thumbnailShareCode={currentShared.shareCode}
      onOpen={() => onOpenDocument(currentShared.id, currentShared.shareCode)}
    />
  ) : null;

  return (
    <MovablePanel
      helpArticle="explorerPanel"
      title="Explorer"
      dataTourId="explorer"
      layoutChrome
      position={position}
      // On mobile the panel becomes a full-width top banner (matches
      // the Palette's banner pattern) so users can switch documents
      // without leaving the canvas. On desktop it stays in the
      // top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      // Wide enough on a desktop for the rail beside a pane of the Explorer page's own views.
      width={isMobile ? 'w-auto' : 'w-[38rem] max-w-[calc(100vw-2rem)]'}
      popoverWidth={isMobile ? 'w-[calc(100vw-1rem)]' : 'w-[38rem]'}
      onReset={onReset}
      onMoveTo={onMoveTo}
      // The ⋯ menu (docs/specs/013-workspace/folders.md): new / open, share / export, then search /
      // GitHub / settings. It replaced a "+ New" chip whose popover held
      // only the first two.
      headerActions={
        <ExplorerHeaderMenu
          onNewDocument={onNewDocument}
          actions={menuActions}
          helpArticle="explorerPanel"
        />
      }
      {...dock}
      popoverOpen={popoverOpen}
      onPopoverClose={onPopoverClose}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      collapsible
    >
      <div className="flex min-h-0 flex-col">
        {currentCard ? <div className="px-2.5 pb-2.5 pt-1">{currentCard}</div> : null}

        {/* The rail and the pane (docs/specs/013-workspace/explorer-structure.md "The editor's Explorer"): side by side
            on a desktop, the rail a row of section chips over the pane on a phone. */}
        <div
          className={`flex border-t border-slate-200 dark:border-slate-700/70 ${
            // On a phone the chips and pane share what is left under the panel's top, card and footer, over the tab bar.
            isMobile ? 'max-h-[max(14rem,calc(100dvh-25rem))] flex-col' : 'h-[min(30rem,62vh)]'
          }`}
        >
          <ExplorerRail
            groups={groups}
            selected={section}
            onPick={pick}
            badges={badges}
            teamName={teamName}
            divider={divider}
            phone={isMobile}
            onDropToMyDocuments={
              onMoveDocumentToFolder ? (id) => onMoveDocumentToFolder(id, null) : undefined
            }
          />
          <ExplorerPanelPane
            section={section}
            teamName={teamName}
            ownerId={ownerId}
            currentDocumentId={currentDocumentId}
            onOpenDocument={onOpenDocument}
            onPick={pick}
            onNewFolder={newFolder}
            onLibraryChanged={onLibraryChanged ?? NOOP}
            tree={
              isTreeSection(section) ? (
                <PanelExplorerTree
                  // A new section opens at its root.
                  key={sectionKey(section)}
                  section={section}
                  rootLabel={sectionLabel(section, teamName)}
                  tree={tree}
                  busy={loading}
                  shared={shared}
                  ownIndex={{ foldersByParent, documentsByFolder }}
                  offlineDocuments={offlineDocuments}
                  teams={teams}
                  foldersByTeam={foldersByTeam}
                  documentsByTeam={documentsByTeam}
                />
              ) : null
            }
            // Sign-in prompt for signed-out guests; an onboarding notice, so Minimal chrome drops it
            // (docs/specs/007-editor/power-user-mode.md).
            footer={minimalChrome ? null : <SignInPrompt bar />}
          />
        </div>

        {/* The product's surfaces, which the editor header no longer carries as a menu. */}
        <ProductNavLinks
          current="editor"
          className="overflow-x-auto border-t border-slate-200 px-1.5 py-1 [scrollbar-width:none] dark:border-slate-700/70"
        />
      </div>

      {/* Move-destination modal (docs/specs/013-workspace/folders.md), the same shared placement
          browser as the /explorer page. With the scope-aware
          onMoveDocumentTo wired (signed-in sessions with teams), the picker
          offers every space — My documents plus each team — so a team document
          can be re-homed to the personal tree (and vice versa) right from
          the editor. Purely personal picks keep the optimistic
          onMoveDocumentToFolder path. */}
      {moveTarget && (onMoveDocumentToFolder || onMoveDocumentTo)
        ? (() => {
            const teamRow = moveTarget.teamId
              ? teamDocuments.find((d) => d.id === moveTarget.id)
              : undefined;
            const personalRow = liveDocs.find((d) => d.id === moveTarget.id);
            const teamDests = onMoveDocumentTo
              ? teams.map((t) => ({
                  id: t.id,
                  name: t.name,
                  folders: teamFolders
                    .filter((f) => f.teamId === t.id)
                    .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
                }))
              : undefined;
            return (
              <MoveToFolderDialog
                subjectName={teamRow?.name || personalRow?.name || 'Untitled'}
                subjectKind="document"
                personalFolders={folders.map((f) => ({
                  id: f.id,
                  name: f.name,
                  parentId: f.parentId,
                }))}
                teams={teamDests}
                currentTeamId={moveTarget.teamId}
                currentFolderId={
                  teamRow ? (teamRow.folderId ?? null) : (personalRow?.folderId ?? null)
                }
                onCreateFolder={async (name, parentId, destTeamId) => {
                  // Personal creates go through the host's folder hook (the
                  // panel's tree updates immediately); team creates hit the
                  // API directly, same as the team page's picker.
                  if (destTeamId === null) {
                    if (!onCreateFolder) return null;
                    const created = await onCreateFolder({ name, parentId });
                    return created
                      ? { id: created.id, name: created.name, parentId: created.parentId }
                      : null;
                  }
                  if (!ownerId) return null;
                  try {
                    const folder = await apiCreateFolder(ownerId, {
                      id: crypto.randomUUID(),
                      name,
                      parentId,
                      teamId: destTeamId,
                    });
                    track('Folder', 'Created', 'Team');
                    return { id: folder.id, name: folder.name, parentId: folder.parentId };
                  } catch {
                    return null;
                  }
                }}
                onPick={(dest) => {
                  if (dest.teamId === null && moveTarget.teamId === null) {
                    onMoveDocumentToFolder?.(moveTarget.id, dest.folderId);
                  } else {
                    onMoveDocumentTo?.(moveTarget.id, dest, moveTarget.teamId);
                  }
                }}
                onClose={() => setMoveTarget(null)}
              />
            );
          })()
        : null}

      {deleteConfirm ? (
        <ConfirmPopover
          anchor={deleteConfirm.anchor}
          message={(() => {
            const personal = liveDocs.find((d) => d.id === deleteConfirm.id);
            const team = teamDocuments.find((d) => d.id === deleteConfirm.id);
            const doc = personal ?? team;
            return deleteConfirmationMessage({
              name: doc?.name,
              hasShareLinks: (doc?.shareCode ?? null) !== null,
              sharedTabsNotice: deleteConfirm.notice,
              team: !personal && !!team,
            });
          })()}
          confirmLabel="Delete"
          onConfirm={() => {
            const id = deleteConfirm.id;
            setDeleteConfirm(null);
            runDelete(id);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      ) : null}
    </MovablePanel>
  );
}

const NOOP = () => {};

export const Explorer = memo(ExplorerImpl);
