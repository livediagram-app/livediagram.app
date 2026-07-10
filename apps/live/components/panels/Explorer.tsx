'use client';

import { memo, useEffect, useState } from 'react';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { OpenIcon, PlusIcon } from '@/components/panels/explorer-icons';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { DiagramRow } from '@/components/panels/explorer-views';
import { ExplorerSections } from '@/components/panels/ExplorerSections';

import type { ExplorerProps } from './Explorer.types';
import { useExplorerViewModel } from './useExplorerViewModel';
import { useExplorerRowDelete } from './useExplorerRowDelete';

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
//
// Wrapped in React.memo at the export below so it skips re-rendering on
// the editor's per-drag-frame churn: CanvasChrome stabilises its handler
// props (useStableCallbacks) and EditorView memoises its list/team
// props, so shallow prop equality holds while a shape is being dragged.
function ExplorerImpl({
  position,
  diagrams,
  ownerId,
  folders,
  loading,
  currentDiagramId,
  onMoveTo,
  onReset,
  onOpenDiagram,
  onNewDiagram,
  onRenameCurrent,
  onOpenShareCurrent,
  onDeleteDiagram,
  onDuplicateDiagram,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDiagramToFolder,
  shared = [],
  teams = [],
  teamFolders = [],
  teamDiagrams = [],
  onDismissShared,
  onSize,
  dock,
  mobileOpenOverride,
  mobileTopOverridePx,
  onMobileClose,
  mobileDockAnchor,
  forceDockMode,
}: ExplorerProps) {
  // Mobile viewport ⇒ render nothing. Mobile users reach the
  // Explorer from the AuthControls "Explorer" menu item (spec/07)
  // instead, freeing the small canvas of the floating panel and
  // its bottom-dock entry point. Tracked in state + a media-query
  // listener so a desktop → mobile resize / device-rotate flips
  // the panel without a page reload. Initial value reads sync so
  // the static-export build doesn't paint a desktop-shaped panel
  // a tick before the effect runs.
  // Mobile-aware flag, kept up-to-date via a matchMedia listener so a
  // device rotation / desktop-to-mobile resize repositions correctly.
  // Previously Explorer was hidden entirely on mobile (the canvas is
  // small enough that the panel ate the whole screen), but signed-out
  // users had no other way to switch diagrams, so the panel now also
  // shows on mobile, banner-collapsed at the very top of the viewport
  // above the Palette.
  const [isMobile, setIsMobile] = useState(isMobileViewportSync);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // Re-render every 30s so the "Updated X ago" strings stay fresh
  // while the panel is open. Cheap when the panel is minimised (this
  // function returns early below before the interval is set up).
  useRelativeTimeTick();
  // Expansion state for each folder node + Unsorted (keyed by
  // folder id, or the literal 'unsorted' for the synthetic bucket).
  // Team rows + team folders share this map too (ids are globally
  // unique). Defaults to all collapsed so the panel stays compact.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the diagram row whose Move dialog is open. Stored here
  // (vs. in DiagramRow) so the modal doesn't nest inside row portals.
  const [moveTargetDiagramId, setMoveTargetDiagramId] = useState<string | null>(null);
  // Folder id newly created via the New folder button — used to drop
  // the row into rename mode immediately after the API returns.
  const [pendingRenameFolderId, setPendingRenameFolderId] = useState<string | null>(null);
  // Row delete lifecycle (confirm popover, exit animation, optimistic
  // team-row hide + pruning) lives in useExplorerRowDelete.
  const {
    exitingDiagramIds,
    deleteConfirm,
    setDeleteConfirm,
    deleteAnchorRef,
    deletedTeamIds,
    openDeleteConfirm,
    runDelete,
  } = useExplorerRowDelete({ diagrams, teamDiagrams, onDeleteDiagram });

  // (Previously: `if (hideOnMobile) return null;` — Explorer now
  // renders on mobile too, banner-collapsed by default. The panel
  // sits at the top of the canvas above the Palette.)

  // All derived collections below are useMemo'd against their real
  // inputs (diagrams, folders, currentDiagramId): Explorer holds a
  // pile of internal state (accordion open flags, expandedFolders,
  // moveTargetDiagramId, exitingDiagramIds, the 30s relative-time
  // tick from useRelativeTimeTick) that re-renders the component
  // frequently without changing the underlying lists. Without these
  // memos every accordion toggle rebuilt foldersByParent +
  // diagramsByFolder + sorted both, and re-walked the folder tree
  // just to render a different chevron.
  const {
    current,
    currentTeam,
    currentShared,
    recents,
    foldersByTeam,
    diagramsByTeam,
    foldersByParent,
    diagramsByFolder,
    offlineDiagrams,
  } = useExplorerViewModel({
    diagrams,
    folders,
    currentDiagramId,
    shared,
    teamFolders,
    teamDiagrams,
    deletedTeamIds,
  });

  const toggleFolder = (key: string) =>
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCreateChild = async (parentId: string) => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId });
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
      setPendingRenameFolderId(folder.id);
    }
  };

  // Anchor for the header's combined New / Open menu (spec/15): the two
  // separate header chips merged into one button whose popover offers
  // both actions, so the title row carries a single piece of chrome.
  const [newOpenAnchor, setNewOpenAnchor] = useState<HTMLElement | null>(null);

  // The anchor argument survives in the row-callback signature (the
  // delete flow's ConfirmPopover still anchors), but the move flow is
  // a centred modal now (spec/15) and ignores it.
  const openMovePicker = (diagramId: string) => {
    setMoveTargetDiagramId(diagramId);
  };

  return (
    <MovablePanel
      title="Explorer"
      dataTourId="explorer"
      position={position}
      // On mobile the panel becomes a full-width top banner (matches
      // the Palette's banner pattern) so users can switch diagrams
      // without leaving the canvas. On desktop it stays in the
      // top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      width={isMobile ? 'w-auto' : 'w-64'}
      onReset={onReset}
      onMoveTo={onMoveTo}
      // New-diagram + Open actions live in the header, just left of
      // the reset-position button (mr-1 spaces it away from that
      // cluster), merged into ONE chip whose popover offers both
      // (spec/15) so the title row carries a single piece of chrome.
      // Icon + text match the panel title's slate (not brand) so the
      // chip reads as quiet header chrome; a subtle border + hover
      // tint keep it recognisably a button. Open navigates to the
      // full-page Explorer's Recent list (the same destination the
      // /new page's "Open Explorer" footer uses).
      headerActions={
        onNewDiagram ? (
          <>
            <button
              type="button"
              aria-label="New or open a diagram"
              aria-haspopup="menu"
              aria-expanded={newOpenAnchor !== null}
              onClick={(e) => setNewOpenAnchor((a) => (a ? null : e.currentTarget))}
              className="mr-1 inline-flex h-5 items-center gap-1 rounded border border-slate-200 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <PlusIcon />
              New
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 4.5 6 7.5 9 4.5" />
              </svg>
            </button>
            {newOpenAnchor ? (
              <PortalMenu anchor={newOpenAnchor} onClose={() => setNewOpenAnchor(null)}>
                <MenuItem
                  icon={<PlusIcon />}
                  label="New diagram"
                  onClick={() => {
                    setNewOpenAnchor(null);
                    onNewDiagram();
                  }}
                />
                <MenuItem
                  icon={<OpenIcon />}
                  label="Open Explorer"
                  onClick={() => {
                    setNewOpenAnchor(null);
                    window.location.href = '/explorer/recent';
                  }}
                />
              </PortalMenu>
            ) : null}
          </>
        ) : (
          // No new-diagram handler (types allow it) → a single action
          // doesn't need a menu; keep the plain Open link.
          <a
            href="/explorer/recent"
            className="mr-1 inline-flex h-5 items-center gap-1 rounded border border-slate-200 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <OpenIcon />
            Open
          </a>
        )
      }
      {...dock}
      onSize={onSize}
      mobileOpenOverride={mobileOpenOverride}
      mobileTopOverridePx={mobileTopOverridePx}
      onMobileClose={onMobileClose}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      // Mobile auto-collapse fires on any tap outside the panel's
      // DOM. Ellipsis menus (PortalMenu, role="menu") and confirm
      // modals (ConfirmDialog, role="dialog") render via React
      // portals into document.body, so a tap on "Rename" or "Delete"
      // counts as outside and would collapse the panel just as the
      // rename input is about to mount. Treat both ARIA roles as
      // "inside" so the user can finish the action they started.
      outsideExceptSelector='[role="menu"],[role="dialog"]'
      collapsible
    >
      <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
        {(current ?? currentTeam ?? currentShared) ? (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              {current ? (
                <li
                  className={
                    exitingDiagramIds.has(current.id)
                      ? 'animate-slide-row-out overflow-hidden'
                      : 'animate-slide-row-in overflow-hidden'
                  }
                >
                  <DiagramRow
                    item={current}
                    ownerId={ownerId}
                    active
                    draggable={!!onMoveDiagramToFolder}
                    onOpen={() => onOpenDiagram(current.id)}
                    onRename={onRenameCurrent}
                    onOpenShare={onOpenShareCurrent}
                    onDelete={
                      openDeleteConfirm
                        ? (anchor) => openDeleteConfirm(current.id, anchor)
                        : undefined
                    }
                    onDuplicate={
                      onDuplicateDiagram ? () => onDuplicateDiagram(current.id) : undefined
                    }
                    onMoveRequest={
                      onMoveDiagramToFolder ? () => openMovePicker(current.id) : undefined
                    }
                  />
                </li>
              ) : currentTeam ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DiagramRow
                    item={currentTeam}
                    ownerId={ownerId}
                    active
                    onOpen={() => onOpenDiagram(currentTeam.id)}
                    onRename={onRenameCurrent}
                    onOpenShare={onOpenShareCurrent}
                    // Any joined member may delete a team diagram
                    // (spec/35); the api enforces team membership.
                    onDelete={
                      openDeleteConfirm
                        ? (anchor) => openDeleteConfirm(currentTeam.id, anchor)
                        : undefined
                    }
                  />
                </li>
              ) : currentShared ? (
                <li className="animate-slide-row-in overflow-hidden">
                  <DiagramRow
                    item={{ ...currentShared, folderId: null, shareCode: null, ownerId: '' }}
                    ownerId={ownerId}
                    // item.shareCode is nulled (no "has a share link"
                    // badge for a shared-with-me row), so authorise the
                    // thumbnail via the share code separately (spec/67).
                    thumbnailShareCode={currentShared.shareCode}
                    active
                    onOpen={() => onOpenDiagram(currentShared.id, currentShared.shareCode)}
                  />
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {/* Recent / My Work / Teams as a single tab bar (was three
            stacked accordions) so only one list takes vertical space.
            Shared-with-you diagrams interleave into Recent (matching the
            /explorer page); My Work holds the folder tree + Unsorted
            (spec/15); Teams mirrors it per team (spec/35). The card owns
            its own tab state and hides itself when no section has
            anything to show — see ExplorerSections. */}
        <ExplorerSections
          loading={loading}
          ownerId={ownerId}
          currentDiagramId={currentDiagramId}
          diagrams={diagrams}
          folders={folders}
          teams={teams}
          recents={recents}
          foldersByParent={foldersByParent}
          diagramsByFolder={diagramsByFolder}
          offlineDiagrams={offlineDiagrams}
          foldersByTeam={foldersByTeam}
          diagramsByTeam={diagramsByTeam}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          pendingRenameFolderId={pendingRenameFolderId}
          onRenameFolderCommitted={() => setPendingRenameFolderId(null)}
          exitingDiagramIds={exitingDiagramIds}
          onOpenDiagram={onOpenDiagram}
          onDismissShared={onDismissShared}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onCreateChild={handleCreateChild}
          onDeleteDiagram={openDeleteConfirm}
          onDuplicateDiagram={onDuplicateDiagram}
          onMoveDiagramRequest={onMoveDiagramToFolder ? openMovePicker : undefined}
          onMoveDiagramToFolder={onMoveDiagramToFolder}
        />

        {/* Sign-in prompt for signed-out guests. */}
        <SignInPrompt />
      </div>

      {/* Move-destination modal (spec/15), shared with the /explorer
          page. The panel scopes it to personal folders: team moves
          (spec/35) live on the full explorer page. */}
      {moveTargetDiagramId && onMoveDiagramToFolder ? (
        <MoveToFolderDialog
          subjectName={diagrams.find((d) => d.id === moveTargetDiagramId)?.name || 'Untitled'}
          subjectKind="diagram"
          personalRootLabel="Unsorted"
          personalFolders={folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
          currentFolderId={diagrams.find((d) => d.id === moveTargetDiagramId)?.folderId ?? null}
          onPick={({ folderId }) => {
            onMoveDiagramToFolder(moveTargetDiagramId, folderId);
          }}
          onClose={() => setMoveTargetDiagramId(null)}
        />
      ) : null}

      {deleteConfirm && deleteAnchorRef.current ? (
        <ConfirmPopover
          anchor={deleteAnchorRef.current}
          message={`Delete "${
            diagrams.find((d) => d.id === deleteConfirm.id)?.name ||
            teamDiagrams.find((d) => d.id === deleteConfirm.id)?.name ||
            'this diagram'
          }"? Its tabs, history and share links go with it.`}
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
