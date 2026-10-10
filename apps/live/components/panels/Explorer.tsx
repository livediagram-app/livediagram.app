'use client';

import { memo, useCallback, useState } from 'react';
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
import { DocumentRow } from '@/components/panels/DocumentRow';
import { PanelExplorerTree } from '@/components/panels/explorer-tree/PanelExplorerTree';

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
      width={isMobile ? 'w-auto' : 'w-64'}
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
      <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
        {(current ?? currentTeam ?? currentShared) ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white">
              Current Document
            </p>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              {current ? (
                <DocumentRowShell exiting={exitingDocumentIds.has(current.id)}>
                  <DocumentRow
                    item={current}
                    ownerId={ownerId}
                    active
                    draggable={!!onMoveDocumentToFolder}
                    onOpen={() => onOpenDocument(current.id)}
                    onRename={onRenameCurrent}
                    onDelete={
                      openDeleteConfirm
                        ? (anchor) => openDeleteConfirm(current.id, anchor)
                        : undefined
                    }
                    onDuplicate={
                      onDuplicateDocument ? () => onDuplicateDocument(current.id) : undefined
                    }
                    onMoveRequest={
                      onMoveDocumentToFolder ? () => openMovePicker(current.id) : undefined
                    }
                  />
                </DocumentRowShell>
              ) : currentTeam ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DocumentRow
                    item={currentTeam}
                    ownerId={ownerId}
                    active
                    onOpen={() => onOpenDocument(currentTeam.id)}
                    onRename={onRenameCurrent}
                    // Any joined member may delete a team document
                    // (docs/specs/013-workspace/team-shared-documents.md); the api enforces team membership.
                    onDelete={
                      openDeleteConfirm
                        ? (anchor) => openDeleteConfirm(currentTeam.id, anchor)
                        : undefined
                    }
                    // Change Folder for a team document (docs/specs/013-workspace/team-shared-documents.md): opens the
                    // move picker on this team's tree, with My documents + the
                    // other teams one Back away. Routed through the
                    // scope-aware onMoveDocumentTo.
                    onMoveRequest={
                      onMoveDocumentTo
                        ? () => setMoveTarget({ id: currentTeam.id, teamId: currentTeam.team.id })
                        : undefined
                    }
                  />
                </li>
              ) : currentShared ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DocumentRow
                    item={{ ...currentShared, folderId: null, shareCode: null, ownerId: '' }}
                    ownerId={ownerId}
                    // item.shareCode is nulled (no "has a share link"
                    // badge for a shared-with-me row), so authorise the
                    // thumbnail via the share code separately (docs/specs/006-document/document-snapshots.md).
                    thumbnailShareCode={currentShared.shareCode}
                    active
                    onOpen={() => onOpenDocument(currentShared.id, currentShared.shareCode)}
                  />
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {/* The sidebar's three groups, Overview, Spaces and More, built from the same rows and
            keyboard model (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel). */}
        <PanelExplorerTree
          tree={{
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
          }}
          busy={loading}
          shared={shared}
          ownIndex={{ foldersByParent, documentsByFolder }}
          offlineDocuments={offlineDocuments}
          teams={teams}
          foldersByTeam={foldersByTeam}
          documentsByTeam={documentsByTeam}
        />

        {/* Sign-in prompt for signed-out guests; an onboarding notice, so
            Minimal chrome drops it (docs/specs/007-editor/power-user-mode.md). */}
        {minimalChrome ? null : <SignInPrompt />}
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

export const Explorer = memo(ExplorerImpl);
