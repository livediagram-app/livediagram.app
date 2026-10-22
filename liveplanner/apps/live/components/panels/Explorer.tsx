'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ProductNavLinks } from '@liveplanner/ui';
import { ProjectRowShell } from './ProjectRowShell';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { apiCreateFolder } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { logMoveFailure } from '@/lib/move-failure';
import { FOLDER_FAILURE } from '@/lib/write-failure-copy';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import {
  isTreeSection,
  PanelExplorerTree,
  paneFolderParent,
} from '@/components/panels/explorer-tree/PanelExplorerTree';
import {
  PanelTreeProvider,
  type PanelTree,
} from '@/components/panels/explorer-tree/PanelTreeContext';
import { sharedToPaneProject, type PaneProject } from '@/app/explorer/views';
import { ExplorerRail } from '@/components/panels/explorer-panel/ExplorerRail';
import { ExplorerPanelPane } from '@/components/panels/explorer-panel/ExplorerPanelPane';
import { ExplorerCurrentProject } from '@/components/panels/explorer-panel/ExplorerCurrentProject';
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

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
//
// Wrapped in React.memo at the export below so it skips re-rendering on
// the editor's per-drag-frame churn: CanvasChrome stabilises its handler
// props (useStableCallbacks) and EditorView memoises its list/team
// props, so shallow prop equality holds while a shape is being dragged.
function ExplorerImpl({
  position,
  projects: liveDocs,
  ownerId,
  folders,
  loading,
  currentProjectId,
  onMoveTo,
  onReset,
  onOpenProject,
  onNewProject,
  menuActions,
  onRenameCurrent,
  onDeleteProject,
  onDuplicateProject,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onTeamFolders,
  onMoveProjectToFolder,
  onMoveProjectTo,
  shared = [],
  teams = [],
  teamFolders = [],
  teamProjects = [],
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
  const toast = useToast();
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
  // users had no other way to switch projects, so the panel now also
  // shows on mobile, banner-collapsed at the very top of the viewport
  // above the Palette.
  const isMobile = useIsMobileViewport();
  // The stacked layout (section chips over the pane): on a phone, and in the corner panel that stands beside the
  // new-project wizard and the status screens, which must stay narrow or it covers their card.
  const stacked = isMobile || !asPopover;
  // A phone's popover is a sheet down to the tab bar, which its chips and pane fill.
  const sheet = isMobile && !!asPopover;
  // Expansion state for each row of the tree (keyed by folder or team id, or
  // a prefixed key such as `space:my-projects` for the fixed rows).
  // Team rows + team folders share this map too (ids are globally
  // unique). Defaults to all collapsed so the panel stays compact.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the project row whose Move dialog is open (`teamId` set =
  // it's a team-library project, so the picker opens on that team and a
  // pick routes through the scope-aware onMoveProjectTo). Stored here
  // (vs. in ProjectRow) so the modal doesn't nest inside row portals.
  const [moveTarget, setMoveTarget] = useState<{ id: string; teamId: string | null } | null>(null);
  // Folder id newly created via the New folder button — used to drop
  // the row into rename mode immediately after the API returns.
  const [pendingRenameFolderId, setPendingRenameFolderId] = useState<string | null>(null);
  // The folder open in the pane (docs/specs/013-workspace/explorer-structure.md "The pane"), for the section it was
  // opened in: another section starts at its root. Held here, not in the tree, so the header's New Folder makes the
  // folder where the reader is looking.
  const [openFolder, setOpenFolder] = useState<{ section: string; id: string | null }>({
    section: '',
    id: null,
  });
  // Row delete lifecycle (exit animation, optimistic team-row hide + pruning, Undo) lives in useExplorerRowDelete.
  // A delete asks nothing first (docs/specs/013-workspace/trash.md "Deleting").
  const { exitingProjectIds, deletedTeamIds, deleteRow } = useExplorerRowDelete({
    projects: liveDocs,
    teamProjects,
    onDeleteProject,
  });

  // (Previously: `if (hideOnMobile) return null;` — Explorer now
  // renders on mobile too, banner-collapsed by default. The panel
  // sits at the top of the canvas above the Palette.)

  // All derived collections below are useMemo'd against their real
  // inputs (projects, folders, currentProjectId): Explorer holds a
  // pile of internal state (accordion open flags, expandedFolders,
  // moveTargetProjectId, exitingProjectIds) that re-renders the component
  // frequently without changing the underlying lists. Without these
  // memos every accordion toggle rebuilt foldersByParent +
  // projectsByFolder + sorted both, and re-walked the folder tree
  // just to render a different chevron.
  const {
    current,
    currentTeam,
    currentShared,
    foldersByTeam,
    projectsByTeam,
    foldersByParent,
    projectsByFolder,
    offlineProjects,
  } = useExplorerViewModel({
    projects: liveDocs,
    folders,
    currentProjectId,
    shared,
    teamFolders,
    teamProjects,
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
      // A folder card's New Subfolder opens that folder, so the new one shows with its name field.
      openInPane(parentId);
      setPendingRenameFolderId(folder.id);
    }
  };
  // The team tree's New Subfolder: same gesture, the team's library.
  const handleCreateTeamChild = async (teamId: string, parentId: string | null) => {
    if (!onTeamFolders) return;
    const folder = await onTeamFolders.create(teamId, parentId);
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId ?? teamId]: true }));
      openInPane(parentId);
      setPendingRenameFolderId(folder.id);
    }
  };

  // The row callbacks still hand up an anchor, but the move flow is a centred modal
  // (docs/specs/013-workspace/folders.md) and the delete asks nothing, so neither reads it.
  const openMovePicker = (projectId: string) => {
    setMoveTarget({ id: projectId, teamId: null });
  };

  const tree: PanelTree = {
    ownerId,
    currentProjectId,
    exitingProjectIds,
    expanded: expandedFolders,
    onToggle: toggleFolder,
    onOpenProject,
    onDeleteProject: deleteRow ? (id: string) => deleteRow(id) : undefined,
    onDuplicateProject,
    onMoveProjectRequest: onMoveProjectToFolder ? openMovePicker : undefined,
    // A team row's move opens the picker for that team; the pick then routes through
    // the scope-aware onMoveProjectTo (docs/specs/013-workspace/team-shared-projects.md).
    onMoveTeamProjectRequest: onMoveProjectTo
      ? (id, teamId) => setMoveTarget({ id, teamId })
      : undefined,
    onMoveProjectToFolder,
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

  // Every project the reader can reach, by id: Home's rows carry its menu.
  const projectsById = useMemo(() => {
    const byId = new Map<string, PaneProject>();
    for (const d of liveDocs) byId.set(d.id, d);
    for (const d of teamProjects) byId.set(d.id, d);
    for (const s of shared) if (!byId.has(s.id)) byId.set(s.id, sharedToPaneProject(s));
    return byId;
  }, [liveDocs, teamProjects, shared]);
  const paneTree: PanelTree = { ...tree, projectById: (id) => projectsById.get(id) };

  // The rail's sections, and the one shown: remembered (Home on each opening of a phone's sheet), else Home.
  const divider = sidebarDivider(minimalChrome);
  const groups = useMemo(
    () => panelSectionGroups({ teams, hasBrowserProjects: offlineProjects.length > 0 }),
    [teams, offlineProjects.length],
  );
  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = asPopover === true && popoverOpen === true;
  const [section, pick] = useExplorerPanelSection(groups, { homeOnOpen: sheet, open: shown });
  const openInPane = (id: string | null) => setOpenFolder({ section: sectionKey(section), id });
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name;
  const badges: Record<string, number | undefined> = {
    shared: shared.length || undefined,
    browser: offlineProjects.length || undefined,
  };
  // The folder open in the pane, while it is still in the space shown; else the space's root.
  const paneFolderId =
    openFolder.section === sectionKey(section)
      ? paneFolderParent(
          section.kind === 'team'
            ? (foldersByTeam.get(section.id) ?? [])
            : [...foldersByParent.values()].flat(),
          openFolder.id,
        )
      : null;
  // New Folder in the folder open in the pane, or at the root of My Projects or of the team shown.
  const newFolder =
    section.kind === 'mine' && onCreateFolder
      ? () =>
          void (paneFolderId
            ? handleCreateChild(paneFolderId)
            : onCreateFolder({ name: 'New folder', parentId: null }).then((folder) => {
                if (folder) setPendingRenameFolderId(folder.id);
              }))
      : section.kind === 'team' && onTeamFolders
        ? () => void handleCreateTeamChild(section.id, paneFolderId)
        : undefined;

  const currentCard = current ? (
    <ProjectRowShell exiting={exitingProjectIds.has(current.id)} enter={false}>
      <ExplorerCurrentProject
        item={current}
        ownerId={ownerId}
        onOpen={() => onOpenProject(current.id)}
        onRename={onRenameCurrent}
        onDelete={deleteRow ? () => deleteRow(current.id) : undefined}
        onDuplicate={onDuplicateProject ? () => onDuplicateProject(current.id) : undefined}
        onMoveRequest={onMoveProjectToFolder ? () => openMovePicker(current.id) : undefined}
      />
    </ProjectRowShell>
  ) : currentTeam ? (
    <ExplorerCurrentProject
      item={currentTeam}
      ownerId={ownerId}
      onOpen={() => onOpenProject(currentTeam.id)}
      onRename={onRenameCurrent}
      // Any joined member may delete a team project (docs/specs/013-workspace/team-shared-projects.md); the api
      // enforces team membership.
      onDelete={deleteRow ? () => deleteRow(currentTeam.id) : undefined}
      onMoveRequest={
        onMoveProjectTo
          ? () => setMoveTarget({ id: currentTeam.id, teamId: currentTeam.team.id })
          : undefined
      }
    />
  ) : currentShared ? (
    <ExplorerCurrentProject
      item={{ ...currentShared, folderId: null, shareCode: null, ownerId: '' }}
      ownerId={ownerId}
      // The share code authorises the thumbnail (docs/specs/006-project/project-snapshots.md).
      thumbnailShareCode={currentShared.shareCode}
      onOpen={() => onOpenProject(currentShared.id, currentShared.shareCode)}
    />
  ) : null;

  return (
    <MovablePanel
      helpArticle="explorerPanel"
      title="Explorer"
      dataTourId="explorer"
      layoutChrome
      // Never faded by Panel opacity: its menus open outside it (docs/specs/007-editor/user-preferences.md).
      opaque
      position={position}
      // On mobile the panel becomes a full-width top banner (matches
      // the Palette's banner pattern) so users can switch projects
      // without leaving the canvas. On desktop it stays in the
      // top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      // Wide enough on a desktop for the rail beside a pane of the Explorer page's own views.
      width={isMobile ? 'w-auto' : 'w-80'}
      popoverWidth="w-[38rem]"
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onReset={onReset}
      onMoveTo={onMoveTo}
      // The ⋯ menu (docs/specs/013-workspace/folders.md): new / open, share / export, then search /
      // Licences / settings. It replaced a "+ New" chip whose popover held
      // only the first two.
      // A phone's sheet drops it: every entry is a tap away there already (the New chip, the footer's Explorer, the
      // top bar's Share, the toolbars' Search and Settings).
      headerActions={
        sheet ? undefined : (
          <ExplorerHeaderMenu
            onNewProject={onNewProject}
            actions={menuActions}
            helpArticle="explorerPanel"
          />
        )
      }
      {...dock}
      popoverOpen={popoverOpen}
      onPopoverClose={onPopoverClose}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      collapsible
    >
      <div className={`flex min-h-0 flex-col ${sheet ? 'flex-1' : ''}`}>
        {/* On a phone's sheet the card and the rail and pane scroll as one, over the pinned footer: pinned, the card
            and the sign-in note left a short phone's pane a sliver (43px on an iPhone SE) that hid its own words.
            Elsewhere this box is `contents`, adding nothing to the layout. */}
        <div
          data-explorer-sheet-scroll={sheet ? '' : undefined}
          className={
            sheet
              ? 'scrollbar-slim flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
              : 'contents'
          }
        >
          {/* The card, then the sign-in note under it (an onboarding notice: Minimal chrome drops it,
            docs/specs/007-editor/power-user-mode.md). */}
          <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1 empty:hidden">
            {currentCard}
            {minimalChrome ? null : <SignInPrompt bar />}
          </div>

          {/* The rail and the pane (docs/specs/013-workspace/explorer-structure.md "The editor's Explorer"): side by side
            on a desktop, the rail a row of section chips over the pane on a phone. */}
          <div
            className={`flex border-t border-slate-200 dark:border-slate-700/70 ${
              // On a phone the chips and pane fill what is left of the sheet under its card and over its footer, and
              // never less than 18rem (room for a section's first rows): below that the sheet scrolls the card away instead. A
              // floating stacked panel shares what is left of the screen.
              sheet
                ? 'min-h-[18rem] flex-1 flex-col'
                : stacked
                  ? 'max-h-[max(14rem,calc(100dvh-30rem))] flex-col'
                  : 'h-[min(30rem,62vh)]'
            }`}
          >
            <ExplorerRail
              groups={groups}
              selected={section}
              onPick={pick}
              badges={badges}
              teamName={teamName}
              divider={divider}
              phone={stacked}
              onNewProject={onNewProject}
              onDropToMyProjects={
                onMoveProjectToFolder ? (id) => onMoveProjectToFolder(id, null) : undefined
              }
            />
            <PanelTreeProvider value={paneTree}>
              <ExplorerPanelPane
                section={section}
                teamName={teamName}
                ownerId={ownerId}
                currentProjectId={currentProjectId}
                onOpenProject={onOpenProject}
                onNewFolder={newFolder}
                inFolder={paneFolderId !== null}
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
                      ownIndex={{ foldersByParent, projectsByFolder }}
                      offlineProjects={offlineProjects}
                      teams={teams}
                      foldersByTeam={foldersByTeam}
                      projectsByTeam={projectsByTeam}
                      folderId={paneFolderId}
                      onOpenFolder={openInPane}
                    />
                  ) : null
                }
              />
            </PanelTreeProvider>
          </div>
        </div>

        {/* The product's surfaces, which the editor header no longer carries as a menu. */}
        <ProductNavLinks
          current="editor"
          // A phone's sheet spreads the links across its width.
          className={`overflow-x-auto border-t border-slate-200 px-1.5 py-1 [scrollbar-width:none] dark:border-slate-700/70 ${sheet ? 'justify-between' : ''}`}
        />
      </div>

      {/* Move-destination modal (docs/specs/013-workspace/folders.md), the same shared placement
          browser as the /explorer page. With the scope-aware
          onMoveProjectTo wired (signed-in sessions with teams), the picker
          offers every space — My Projects plus each team — so a team project
          can be re-homed to the personal tree (and vice versa) right from
          the editor. Purely personal picks keep the optimistic
          onMoveProjectToFolder path. */}
      {moveTarget && (onMoveProjectToFolder || onMoveProjectTo)
        ? (() => {
            const teamRow = moveTarget.teamId
              ? teamProjects.find((d) => d.id === moveTarget.id)
              : undefined;
            const personalRow = liveDocs.find((d) => d.id === moveTarget.id);
            const teamDests = onMoveProjectTo
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
                subjectKind="project"
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
                  } catch (err) {
                    // The tile keeps the name typed, for another try.
                    logMoveFailure('new-folder', '', err);
                    toast.error(FOLDER_FAILURE.create(name));
                    return null;
                  }
                }}
                onPick={(dest) => {
                  if (dest.teamId === null && moveTarget.teamId === null) {
                    onMoveProjectToFolder?.(moveTarget.id, dest.folderId);
                  } else {
                    onMoveProjectTo?.(moveTarget.id, dest, moveTarget.teamId);
                  }
                }}
                onClose={() => setMoveTarget(null)}
              />
            );
          })()
        : null}
    </MovablePanel>
  );
}

const NOOP = () => {};

export const Explorer = memo(ExplorerImpl);
