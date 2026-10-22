'use client';

import { use, useMemo, useState } from 'react';
import { browser } from 'react-dom';
import type { Folder } from '@liveplanner/api-schema';
import { FolderRow, SkeletonRows } from '@/app/explorer/views';
import { scopeProjects, type LibraryLens } from '@/app/explorer/lens/pane-lens';
import { FilteredEmpty, LensAnnouncer } from '@/app/explorer/lens/LensStates';
import { EmptyState } from '@liveplanner/ui';
import { FolderSolidIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { CardView } from '@/app/explorer/CardView';
import { DetailsView } from '@/app/explorer/details/DetailsView';
import type { ExplorerViewProps } from '@/app/explorer/explorer-view-props';
import { TeamLibraryHeader } from '@/components/panels/TeamLibraryHeader';
import { useExplorerViewMode } from '@/app/explorer/useExplorerViewMode';
import { ProjectRow } from '@/app/explorer/explorer-route-project-row';
import {
  MoveToFolderDialog,
  type MoveDestination,
  type MoveFolderNode,
} from '@/components/dialogs/MoveToFolderDialog';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { offerDeleteUndo } from '@/lib/project-delete-undo';
import { useTeamLibrary } from '@/hooks/persistence/useTeamLibrary';
import { apiCreateFolder } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { folderDescendants } from '@/lib/folder-tree';
import { folderDeleteConfirmation } from '@/lib/folder-delete-confirmation';
import { useDefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';
import { folderDefaultKeys } from '@/lib/placement-defaults/default-destination';
import { placementDefaultsSnapshot } from '@/lib/placement-defaults/placement-defaults-store';
import { LIST_CARD } from '@/components/primitives/surface-classes';
import { logMoveFailure } from '@/lib/move-failure';
import { PROJECT_FAILURE, FOLDER_FAILURE } from '@/lib/write-failure-copy';

const NO_FOLDERS: readonly Folder[] = [];

// "Shared projects" on the team page (docs/specs/013-workspace/team-shared-projects.md): the team's folder
// tree + projects, navigated with a small breadcrumb instead of a
// sidebar. The concept (and most of the row components) is the
// personal explorer's, just team-scoped: every joined member can
// create / rename / move / delete folders, re-folder projects, and
// remove a project from the team. The root lists the team's root folders, then its root
// projects, as the personal tree's does (docs/specs/013-workspace/explorer-structure.md).

type Spot = { kind: 'root' } | { kind: 'folder'; id: string };

export function TeamSharedProjects({
  ownerId,
  teamId,
  teamName,
  moveDests,
  onMoveProjectTo,
  lens,
  onLibraryChange,
}: {
  ownerId: string;
  teamId: string;
  // Shown by the move picker's Team Library card; falls back to "Team".
  teamName?: string;
  // Full move destinations (docs/specs/013-workspace/team-shared-projects.md): the caller's personal folder tree plus
  // EVERY team's library, so a project can be re-homed anywhere (back to My
  // Work, or on to another team) from this page — the space overview + back
  // bar appear once more than one space exists. Absent = project moves stay
  // scoped to this team. Folder moves are always team-scoped (a folder
  // can't change scope).
  moveDests?: {
    personalFolders: { id: string; name: string; parentId: string | null }[];
    teams: { id: string; name: string; folders: MoveFolderNode[] }[];
  };
  // Routes a cross-scope pick (personal / another team) — the explorer's
  // `moveProjectTo`, which picks the right API call from the project's
  // current placement. Same-team picks keep using lib.moveProject.
  onMoveProjectTo?: (id: string, dest: MoveDestination) => void;
  // A library changed from this page: this team's (null for My Work, from the move picker's New Folder), so the
  // Explorer's own lists (the sidebar, search, every other move picker) follow without a reload.
  onLibraryChange?: (teamId: string | null) => void;
  // The Explorer's lens (docs/specs/013-workspace/explorer-filters.md): while it is set, the
  // library lists every matching project at or below the open spot, its folders stepping aside.
  lens?: LibraryLens;
}) {
  const lib = useTeamLibrary(ownerId, teamId, { onChange: () => onLibraryChange?.(teamId) });
  // Default folders (docs/specs/013-workspace/default-folders.md): a joined member may send new
  // projects to this team's folders.
  const teamFolderLists = useMemo(() => ({ [teamId]: lib.folders }), [teamId, lib.folders]);
  const defaultFolders = useDefaultFolderMenus(ownerId, {
    personal: NO_FOLDERS,
    team: teamFolderLists,
    teams: useMemo(() => [{ id: teamId, name: teamName ?? 'Team' }], [teamId, teamName]),
  });
  // Deep link: /explorer/team?id=<team>&folder=<id> opens with that
  // folder focused (the search panel's team-folder results navigate
  // here). The explorer renders in the browser only (use(browser()), docs/specs/003-system-architecture/
  // react-state-and-effects.md "Rendering in the browser only"), so the initialiser reads the address.
  use(browser());
  const [spot, setSpot] = useState<Spot>(() => {
    const folder = new URLSearchParams(window.location.search).get('folder');
    return folder ? { kind: 'folder', id: folder } : { kind: 'root' };
  });
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'project'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  // "+ Create" dropdown (mirrors the personal pane header): one compact
  // button instead of two, so the breadcrumb keeps its room on mobile.
  const confirm = useConfirm();
  const toast = useToast();
  // List, card or details layout — the same device-local preference (docs/specs/006-project/project-snapshots.md) the
  // Explorer browse views use, so a card-view user gets cards here too.
  const [viewMode, setViewMode] = useExplorerViewMode();

  const currentFolderId = spot.kind === 'folder' ? spot.id : null;
  // What the open spot holds directly: its folders, then its projects.
  const directFolders =
    spot.kind === 'root' ? lib.rootFolders : (lib.childrenByParent.get(spot.id) ?? []);
  const directProjects = lib.projectsByFolder.get(currentFolderId) ?? [];
  const bare = directFolders.length === 0 && directProjects.length === 0;
  // A set lens reaches every subfolder of the spot and steps the folder rows aside.
  const lensed = lens?.active === true;
  const reach = lensed
    ? scopeProjects(currentFolderId, lib.childrenByParent, lib.projectsByFolder)
    : directProjects;
  const visibleFolders = lensed ? [] : directFolders;
  const visibleProjects = lens ? lens.narrow(reach) : reach;
  // A lensed row from a subfolder names its folder, opening it (recent-folder-chip.md).
  const folderChipFor = (d: { folderId: string | null }) => {
    if (!lensed || d.folderId === currentFolderId) return null;
    const folderId = d.folderId;
    if (folderId === null)
      return { label: 'Team projects', onOpen: () => setSpot({ kind: 'root' }) };
    const folder = lib.folders.find((f) => f.id === folderId);
    return folder
      ? { label: folder.name, onOpen: () => setSpot({ kind: 'folder', id: folder.id }) }
      : null;
  };

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    const root = { label: 'Team projects', onClick: () => setSpot({ kind: 'root' }) };
    if (spot.kind === 'root') return [{ label: 'Team projects' }];
    const chain = lib.breadcrumb(spot.id);
    return [
      root,
      ...chain.slice(0, -1).map((f) => ({
        label: f.name,
        onClick: () => setSpot({ kind: 'folder', id: f.id }),
      })),
      { label: chain[chain.length - 1]?.name ?? 'Folder' },
    ];
  })();

  // The anchor survives in the row-callback signature (FolderRow's
  // menu passes it) but the move flow is a centred modal now and
  // ignores it.
  const folderActions = (f: Folder, _anchor: HTMLElement | null) => ({
    defaults: defaultFolders.forFolder({ id: f.id, teamId }),
    rename: () => setRenamingFolderId(f.id),
    newSubfolder: () =>
      void lib.createFolder(f.id).then((created) => {
        if (created) {
          setSpot({ kind: 'folder', id: f.id });
          setRenamingFolderId(created.id);
        }
      }),
    move: () => {
      setMoveTarget({ kind: 'folder', id: f.id });
    },
    delete: async () => {
      const ok = await confirm(
        folderDeleteConfirmation({
          name: f.name,
          parentName: lib.folders.find((p) => p.id === f.parentId)?.name ?? null,
          scope: 'team',
          defaultKeys: folderDefaultKeys(f.id, placementDefaultsSnapshot().defaults),
        }),
      );
      if (!ok) return;
      await lib.deleteFolder(f.id);
      if (spot.kind === 'folder' && spot.id === f.id) setSpot({ kind: 'root' });
    },
  });

  // Move-picker folder nodes: every team folder (the picker rebuilds
  // the tree from parentId), minus the moved folder's own subtree
  // (cycle prevention, mirroring the personal picker).
  const movePickerFolders = (() => {
    if (!moveTarget) return [];
    const excluded =
      moveTarget.kind === 'folder'
        ? folderDescendants(lib.childrenByParent, moveTarget.id)
        : new Set<string>();
    return lib.folders
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }));
  })();

  // Row callbacks, shared by the list rows and the card grid so the two
  // layouts can't drift on what an action does (mirrors the Explorer's
  // project-row-shared split).
  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    void lib.renameFolder(id, name);
  };
  const startRenameProject = (id: string) => setRenamingProjectId(id);
  const commitRenameProject = (id: string, name: string) => {
    setRenamingProjectId(null);
    void lib.renameProject(id, name);
  };
  const duplicateProject = (id: string) => void lib.duplicateProject(id);
  // No question first (docs/specs/013-workspace/trash.md "Deleting"): it goes to the team's Trash, and the toast offers
  // it back.
  const deleteProject = async (id: string) => {
    const name = lib.projects.find((d) => d.id === id)?.name;
    if (!(await lib.deleteProject(id))) {
      toast.error(PROJECT_FAILURE.delete(name));
      return;
    }
    offerDeleteUndo(toast, {
      ownerId,
      id,
      name,
      trash: 'Team',
      onRestored: () => void lib.refresh(),
    });
  };

  // The props the card grid and the Details view share (ExplorerViewProps), built once.
  const teamViewProps: ExplorerViewProps = {
    folders: visibleFolders,
    projects: visibleProjects,
    ownerId,
    onOpenFolder: (id) => setSpot({ kind: 'folder', id }),
    onCommitRenameFolder: commitRenameFolder,
    onCancelRenameFolder: () => setRenamingFolderId(null),
    renamingFolderId,
    renamingProjectId,
    onCommitRenameProject: commitRenameProject,
    onCancelRenameProject: () => setRenamingProjectId(null),
    folderActions,
    onStartRenameProject: startRenameProject,
    onDuplicateProject: duplicateProject,
    onDeleteProject: (id: string) => void deleteProject(id),
    onMoveProject: (id) => setMoveTarget({ kind: 'project', id }),
    childrenCount: (id) => lib.childrenByParent.get(id)?.length ?? 0,
    projectsCount: (id) => lib.projectsByFolder.get(id)?.length ?? 0,
    folderChipFor,
  };

  return (
    <div className={LIST_CARD}>
      {/* ---------- Breadcrumb + new-folder ---------- */}
      <TeamLibraryHeader
        crumbs={crumbs}
        teamId={teamId}
        currentFolderId={currentFolderId}
        inFolder={spot.kind === 'folder'}
        viewMode={viewMode}
        setViewMode={setViewMode}
        createFolder={lib.createFolder}
        setRenamingFolderId={setRenamingFolderId}
      />

      {/* ---------- Rows ---------- */}
      {lens ? (
        <LensAnnouncer input={lens.input} shown={visibleProjects.length} total={reach.length} />
      ) : null}
      {lib.loading ? (
        <SkeletonRows count={2} framed={false} />
      ) : lens && lensed && !bare && visibleProjects.length === 0 ? (
        <div className="p-3">
          <FilteredEmpty issues={lens.issues} onClear={lens.clear} />
        </div>
      ) : bare ? (
        // The Explorer's empty-state card (docs/specs/013-workspace/folders.md), inset so its border
        // sits inside this section's own.
        <div className="p-3">
          {spot.kind === 'root' ? (
            <EmptyState
              icon={<TeamIcon />}
              title="Nothing Shared Yet"
              description="Move a project here from My Work, or create a folder to organise ahead."
            />
          ) : (
            <EmptyState
              icon={<FolderSolidIcon open />}
              title="This Folder Is Empty"
              description="Move a project here, or add a subfolder to organise your team's work."
            />
          )}
        </div>
      ) : viewMode === 'details' ? (
        // The Explorer's Details view (docs/specs/013-workspace/explorer-details-view.md), from the
        // same props as the cards.
        <div className="p-3">
          <DetailsView {...teamViewProps} />
        </div>
      ) : viewMode === 'card' ? (
        // Same folders + projects as the list, rendered as the Explorer's
        // card grid (docs/specs/006-project/project-snapshots.md). Team projects (ProjectSummary) satisfy the
        // grid's PaneProject contract; the visibility badge is hidden
        // since every card here is a team project.
        <div className="p-3">
          <CardView
            {...teamViewProps}
            // Folder content previews (docs/specs/013-workspace/folder-content-previews.md), from the team library's
            // own indexes — the same ones the counts read.
            folderContents={(id) => ({
              folders: lib.childrenByParent.get(id) ?? [],
              projects: lib.projectsByFolder.get(id) ?? [],
            })}
            showVisibilityBadge={false}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {visibleFolders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              renaming={renamingFolderId === f.id}
              childCount={
                (lib.childrenByParent.get(f.id)?.length ?? 0) +
                (lib.projectsByFolder.get(f.id)?.length ?? 0)
              }
              onOpen={() => setSpot({ kind: 'folder', id: f.id })}
              onCommitRename={(name) => commitRenameFolder(f.id, name)}
              onCancelRename={() => setRenamingFolderId(null)}
              getActionsForAnchor={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {visibleProjects.map((d) => (
            // The Explorer's own row, so a team row matches the FolderRows
            // above it (a local copy had drifted to a 3-column grid).
            <ProjectRow
              key={d.id}
              project={d}
              ownerId={ownerId}
              renaming={renamingProjectId === d.id}
              showVisibility={false}
              folderChip={folderChipFor(d)}
              onMove={() => setMoveTarget({ kind: 'project', id: d.id })}
              onStartRename={() => startRenameProject(d.id)}
              onCommitRename={(name) => commitRenameProject(d.id, name)}
              onCancelRename={() => setRenamingProjectId(null)}
              onDuplicate={() => duplicateProject(d.id)}
              onDelete={() => void deleteProject(d.id)}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {/* Same shared move modal as the personal surfaces (docs/specs/013-workspace/folders.md). With
          `moveDests` (the explorer page supplies it) a PROJECT move offers
          every space — My Work plus each team — so a team project can be
          re-homed back to the personal tree or on to another team from
          right here; the space overview + back bar come with it. This
          team's own folders come from the live lib (fresher than the
          sweep). Folder moves stay scoped to this team: a folder cannot
          change scope, so the wider browse would only offer dead ends. */}
      {moveTarget ? (
        <MoveToFolderDialog
          subjectName={
            (moveTarget.kind === 'project'
              ? lib.projects.find((d) => d.id === moveTarget.id)?.name
              : lib.folders.find((f) => f.id === moveTarget.id)?.name) || 'Untitled'
          }
          subjectKind={moveTarget.kind}
          personalFolders={
            moveTarget.kind === 'project' && moveDests ? moveDests.personalFolders : undefined
          }
          teams={
            moveTarget.kind === 'project' && moveDests
              ? moveDests.teams.map((t) =>
                  t.id === teamId ? { ...t, folders: movePickerFolders } : t,
                )
              : [{ id: teamId, name: teamName ?? 'Team', folders: movePickerFolders }]
          }
          currentTeamId={teamId}
          currentFolderId={
            moveTarget.kind === 'project'
              ? (lib.projects.find((d) => d.id === moveTarget.id)?.folderId ?? null)
              : (lib.folders.find((f) => f.id === moveTarget.id)?.parentId ?? null)
          }
          onCreateFolder={async (name, parentId, destTeamId) => {
            // In-team creates go through the lib so the local list updates
            // immediately. Other scopes (personal / another team, reachable
            // via moveDests) create through the API directly: the fresh
            // folder is a valid destination straight away, and the Explorer's
            // lists hear of it through onLibraryChange.
            if (destTeamId === teamId) {
              const created = await lib.createFolder(parentId, name);
              return created
                ? { id: created.id, name: created.name, parentId: created.parentId }
                : null;
            }
            try {
              const folder = await apiCreateFolder(ownerId, {
                id: crypto.randomUUID(),
                name,
                parentId,
                teamId: destTeamId,
              });
              track('Folder', 'Created', destTeamId ? 'Team' : undefined);
              onLibraryChange?.(destTeamId ?? null);
              return { id: folder.id, name: folder.name, parentId: folder.parentId };
            } catch (err) {
              // The tile keeps the name typed, for another try.
              logMoveFailure('new-folder', '', err);
              toast.error(FOLDER_FAILURE.create(name));
              return null;
            }
          }}
          onPick={(dest) => {
            if (moveTarget.kind === 'folder') {
              void lib.moveFolder(moveTarget.id, dest.folderId);
              return;
            }
            if (dest.teamId === teamId) {
              void lib.moveProject(moveTarget.id, dest.folderId);
              return;
            }
            // Leaving this team (to My Work or another team): route via the
            // explorer's placement-aware mover, then refresh this library so
            // the row disappears once the move lands.
            void Promise.resolve(onMoveProjectTo?.(moveTarget.id, dest)).then(() => lib.refresh());
          }}
          onClose={() => setMoveTarget(null)}
        />
      ) : null}
    </div>
  );
}
