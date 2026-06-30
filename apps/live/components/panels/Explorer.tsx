'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { PlusIcon } from '@/components/panels/explorer-icons';
import {
  DiagramRow,
  FolderNode,
  SharedRow,
  UnsortedNode,
} from '@/components/panels/explorer-views';
import { ExplorerTabBar, type ExplorerTab } from '@/components/panels/ExplorerTabBar';
import { TeamNode } from '@/components/panels/explorer-team-views';

import type { ExplorerProps } from './Explorer.types';
import { useExplorerViewModel } from './useExplorerViewModel';

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
  // The three sections (Recent / My Work / Teams) are a single tab bar
  // instead of three stacked accordions, so only one list takes
  // vertical space at a time. `selectedTab` is the user's pick; the
  // section actually rendered falls back to the first available tab
  // when the pick isn't currently shown (Teams hidden for a solo user,
  // Recent empty on a fresh account), resolved just before the return.
  const [selectedTab, setSelectedTab] = useState<string>('recent');
  // Re-clicking the active tab collapses the section list (the tab bar
  // stays put), like toggling an accordion shut; clicking any tab while
  // collapsed reopens it. Selecting a different tab always expands.
  // Starts collapsed so the panel opens compact — just the tab bar,
  // no list — until the user picks a section.
  const [tabsCollapsed, setTabsCollapsed] = useState(true);
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
  // Diagrams currently mid slide-out animation. Adding the id to this
  // set switches the row's <li> className from animate-slide-row-in to
  // animate-slide-row-out for ~220ms, then we forward the real delete
  // to the parent so the row is removed from the underlying
  // `diagrams` prop. Without the delay the row disappears instantly
  // and a fresh "5 with the same name" Explorer feels unresponsive.
  const [exitingDiagramIds, setExitingDiagramIds] = useState<Set<string>>(new Set());
  // Inline delete confirmation: the row's menu hands up the id + its menu
  // button as the anchor; we open a ConfirmPopover beside it. Confirming
  // runs the delete (skipping the modal — the popover IS the confirm) and
  // slides the row out first via the beforeRemove hook.
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  // Team diagrams aren't in the personal `diagrams` prop, so the parent's
  // delete (which prunes the personal list + fires a fire-and-forget API
  // DELETE) can't drop a team row from view, and the team-library sweep
  // won't re-fetch in time. Track confirmed team deletes locally and hide
  // those rows optimistically; the set is pruned once the sweep catches up.
  const [deletedTeamIds, setDeletedTeamIds] = useState<Set<string>>(new Set());
  const openDeleteConfirm = onDeleteDiagram
    ? (id: string, anchor: HTMLElement | null) => {
        deleteAnchorRef.current = anchor;
        setDeleteConfirm({ id });
      }
    : undefined;
  const runDelete = (id: string) => {
    if (!onDeleteDiagram) return;
    // A team diagram lives in the swept library, not the personal list,
    // so hide it locally on confirm (the parent's delete can't).
    if (teamDiagrams.some((d) => d.id === id)) {
      setDeletedTeamIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    void onDeleteDiagram(
      id,
      () =>
        new Promise<void>((resolve) => {
          setExitingDiagramIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          window.setTimeout(resolve, 220);
        }),
      { skipConfirm: true },
    );
  };

  // Once a deleted diagram actually leaves the list, drop its id from the
  // exiting set. Pruning here (rather than clearing on the timeout) avoids a
  // one-frame flicker where the row would slide back in just before unmount,
  // and keeps the set from growing across repeated deletes.
  useEffect(() => {
    setExitingDiagramIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(diagrams.map((d) => d.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (present.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [diagrams]);

  // Same pruning for team deletes: once the library sweep re-fetches
  // without the deleted id, drop it from the local hide-set so the set
  // can't grow unbounded.
  useEffect(() => {
    setDeletedTeamIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(teamDiagrams.map((d) => d.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (present.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [teamDiagrams]);

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

  // The anchor argument survives in the row-callback signature (the
  // delete flow's ConfirmPopover still anchors), but the move flow is
  // a centred modal now (spec/15) and ignores it.
  const openMovePicker = (diagramId: string) => {
    setMoveTargetDiagramId(diagramId);
  };

  // Available section tabs, in display order. A section only earns a
  // tab when it has something to show — these guards mirror the old
  // per-accordion render conditions exactly, so nothing that used to
  // appear disappears and an empty section never becomes dead chrome.
  const sectionTabs: ExplorerTab[] = [];
  if (loading || recents.length > 0) sectionTabs.push({ id: 'recent', label: 'Recent' });
  if (!(diagrams.length === 0 && folders.length === 0))
    sectionTabs.push({ id: 'work', label: 'My Work' });
  if (teams.length > 0) sectionTabs.push({ id: 'teams', label: 'Teams' });
  // Resolve the rendered tab: the user's pick when still available,
  // else the first available section (null only on a blank account,
  // where the whole tabbed card is hidden below).
  const activeTab = sectionTabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : (sectionTabs[0]?.id ?? null);
  const handleSelectTab = (id: string) => {
    if (tabsCollapsed) {
      setTabsCollapsed(false);
      setSelectedTab(id);
    } else if (id === activeTab) {
      setTabsCollapsed(true);
    } else {
      setSelectedTab(id);
    }
  };

  return (
    <MovablePanel
      title="Explorer"
      position={position}
      // On mobile the panel becomes a full-width top banner (matches
      // the Palette's banner pattern) so users can switch diagrams
      // without leaving the canvas. On desktop it stays in the
      // top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      width={isMobile ? 'w-auto' : 'w-64'}
      onReset={onReset}
      onMoveTo={onMoveTo}
      // New-diagram action lives in the header, just left of the
      // reset-position button (mr-1 spaces it away from that cluster).
      // Compact "New" + icon so it fits the title row.
      headerActions={
        onNewDiagram ? (
          <button
            type="button"
            onClick={onNewDiagram}
            // Icon + text match the panel title's slate (not brand) so
            // the button reads as quiet header chrome; a subtle border +
            // hover tint keep it recognisably a button.
            className="mr-1 inline-flex h-5 items-center gap-1 rounded border border-slate-200 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <PlusIcon />
            New
          </button>
        ) : undefined
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
            (spec/15); Teams mirrors it per team (spec/35). The whole
            card is hidden when no section has anything to show. */}
        {sectionTabs.length > 0 && activeTab ? (
          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-1.5 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/60">
            <ExplorerTabBar
              tabs={sectionTabs}
              // Collapsed ⇒ no tab reads as selected; clicking any tab reopens.
              activeId={tabsCollapsed ? '' : activeTab}
              onSelect={handleSelectTab}
            />

            {tabsCollapsed ? null : activeTab === 'recent' ? (
              loading ? (
                <ul className="flex flex-col gap-1" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                      aria-hidden
                    >
                      <span className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-slate-200" />
                      <span
                        className="h-3 animate-pulse rounded bg-slate-200"
                        style={{ width: `${70 - i * 12}%` }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="scrollbar-slim flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                  {recents.map((entry) =>
                    entry.kind === 'shared' ? (
                      // A diagram shared with you: opens on the share
                      // link, dismissable — never the viewer's to
                      // rename / move / delete.
                      <SharedRow
                        key={entry.s.id}
                        item={entry.s}
                        active={false}
                        onOpen={() => onOpenDiagram(entry.s.id, entry.s.shareCode)}
                        onDismiss={onDismissShared ? () => onDismissShared(entry.s.id) : undefined}
                      />
                    ) : (
                      <li
                        key={entry.d.id}
                        className={
                          exitingDiagramIds.has(entry.d.id)
                            ? 'animate-slide-row-out overflow-hidden'
                            : 'animate-slide-row-in overflow-hidden'
                        }
                      >
                        <DiagramRow
                          item={entry.d}
                          ownerId={ownerId}
                          active={false}
                          // Team diagrams (spec/35) open for any joined
                          // member; their rename / move / delete live
                          // on the /explorer page + team page, so the
                          // panel keeps team rows open-only.
                          draggable={entry.kind === 'own' && !!onMoveDiagramToFolder}
                          onOpen={() => onOpenDiagram(entry.d.id)}
                          onDelete={
                            entry.kind === 'own' && openDeleteConfirm
                              ? (anchor) => openDeleteConfirm(entry.d.id, anchor)
                              : undefined
                          }
                          onDuplicate={
                            entry.kind === 'own' && onDuplicateDiagram
                              ? () => onDuplicateDiagram(entry.d.id)
                              : undefined
                          }
                          onMoveRequest={
                            entry.kind === 'own' && onMoveDiagramToFolder
                              ? () => openMovePicker(entry.d.id)
                              : undefined
                          }
                        />
                      </li>
                    ),
                  )}
                </ul>
              )
            ) : activeTab === 'work' ? (
              <ul className="flex flex-col gap-0.5">
                {(foldersByParent.get(null) ?? []).map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    ownerId={ownerId}
                    depth={0}
                    foldersByParent={foldersByParent}
                    diagramsByFolder={diagramsByFolder}
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    currentDiagramId={currentDiagramId}
                    pendingRenameId={pendingRenameFolderId}
                    onRenameFolderCommitted={() => setPendingRenameFolderId(null)}
                    onOpenDiagram={onOpenDiagram}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    onCreateChild={handleCreateChild}
                    onDeleteDiagram={openDeleteConfirm}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id) => openMovePicker(id) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ))}
                {(diagramsByFolder.get(null) ?? []).length > 0 ? (
                  <UnsortedNode
                    ownerId={ownerId}
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    diagrams={diagramsByFolder.get(null) ?? []}
                    currentDiagramId={currentDiagramId}
                    onOpenDiagram={onOpenDiagram}
                    onDeleteDiagram={openDeleteConfirm}
                    exitingDiagramIds={exitingDiagramIds}
                    onDuplicateDiagram={onDuplicateDiagram}
                    onMoveDiagramRequest={
                      onMoveDiagramToFolder ? (id) => openMovePicker(id) : undefined
                    }
                    onMoveDiagramToFolder={onMoveDiagramToFolder}
                  />
                ) : null}
              </ul>
            ) : activeTab === 'teams' ? (
              <ul className="flex flex-col gap-0.5">
                {teams.map((t) => (
                  <TeamNode
                    key={t.id}
                    team={t}
                    ownerId={ownerId}
                    folders={foldersByTeam.get(t.id) ?? []}
                    diagrams={diagramsByTeam.get(t.id) ?? []}
                    currentDiagramId={currentDiagramId}
                    expanded={expandedFolders}
                    onToggleExpanded={toggleFolder}
                    onOpenDiagram={(id) => onOpenDiagram(id)}
                    onOpenTeam={(teamId) =>
                      window.location.assign(`/explorer/team?id=${encodeURIComponent(teamId)}`)
                    }
                    // Hard delete on team-library rows, any joined
                    // member (spec/35); the api enforces membership.
                    onDeleteDiagram={openDeleteConfirm}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

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
