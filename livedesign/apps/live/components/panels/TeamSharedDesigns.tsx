'use client';

import { use, useMemo, useState } from 'react';
import { browser } from 'react-dom';
import type { Folder } from '@livedesign/api-schema';
import { FolderRow, SkeletonRows } from '@/app/explorer/views';
import { scopeDesigns, type LibraryLens } from '@/app/explorer/lens/pane-lens';
import { FilteredEmpty, LensAnnouncer } from '@/app/explorer/lens/LensStates';
import { EmptyState } from '@livedesign/ui';
import { FolderSolidIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { CardView } from '@/app/explorer/CardView';
import { DetailsView } from '@/app/explorer/details/DetailsView';
import type { ExplorerViewProps } from '@/app/explorer/explorer-view-props';
import { TeamLibraryHeader } from '@/components/panels/TeamLibraryHeader';
import { useExplorerViewMode } from '@/app/explorer/useExplorerViewMode';
import { DesignRow } from '@/app/explorer/explorer-route-design-row';
import {
  MoveToFolderDialog,
  type MoveDestination,
  type MoveFolderNode,
} from '@/components/dialogs/MoveToFolderDialog';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { offerDeleteUndo } from '@/lib/design-delete-undo';
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
import { DESIGN_FAILURE, FOLDER_FAILURE } from '@/lib/write-failure-copy';

const NO_FOLDERS: readonly Folder[] = [];

// "Shared designs" on the team page (docs/specs/013-workspace/team-shared-designs.md): the team's folder
// tree + designs, navigated with a small breadcrumb instead of a
// sidebar. The concept (and most of the row components) is the
// personal explorer's, just team-scoped: every joined member can
// create / rename / move / delete folders, re-folder designs, and
// remove a design from the team. The root lists the team's root folders, then its root
// designs, as the personal tree's does (docs/specs/013-workspace/explorer-structure.md).

type Spot = { kind: 'root' } | { kind: 'folder'; id: string };

export function TeamSharedDesigns({
  ownerId,
  teamId,
  teamName,
  moveDests,
  onMoveDesignTo,
  lens,
  onLibraryChange,
}: {
  ownerId: string;
  teamId: string;
  // Shown by the move picker's Team Library card; falls back to "Team".
  teamName?: string;
  // Full move destinations (docs/specs/013-workspace/team-shared-designs.md): the caller's personal folder tree plus
  // EVERY team's library, so a design can be re-homed anywhere (back to My
  // Work, or on to another team) from this page — the space overview + back
  // bar appear once more than one space exists. Absent = design moves stay
  // scoped to this team. Folder moves are always team-scoped (a folder
  // can't change scope).
  moveDests?: {
    personalFolders: { id: string; name: string; parentId: string | null }[];
    teams: { id: string; name: string; folders: MoveFolderNode[] }[];
  };
  // Routes a cross-scope pick (personal / another team) — the explorer's
  // `moveDesignTo`, which picks the right API call from the design's
  // current placement. Same-team picks keep using lib.moveDesign.
  onMoveDesignTo?: (id: string, dest: MoveDestination) => void;
  // A library changed from this page: this team's (null for My Work, from the move picker's New Folder), so the
  // Explorer's own lists (the sidebar, search, every other move picker) follow without a reload.
  onLibraryChange?: (teamId: string | null) => void;
  // The Explorer's lens (docs/specs/013-workspace/explorer-filters.md): while it is set, the
  // library lists every matching design at or below the open spot, its folders stepping aside.
  lens?: LibraryLens;
}) {
  const lib = useTeamLibrary(ownerId, teamId, { onChange: () => onLibraryChange?.(teamId) });
  // Default folders (docs/specs/013-workspace/default-folders.md): a joined member may send new
  // designs to this team's folders.
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
  const [renamingDesignId, setRenamingDesignId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'design'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  // "+ Create" dropdown (mirrors the personal pane header): one compact
  // button instead of two, so the breadcrumb keeps its room on mobile.
  const confirm = useConfirm();
  const toast = useToast();
  // List, card or details layout — the same device-local preference (docs/specs/006-design/design-snapshots.md) the
  // Explorer browse views use, so a card-view user gets cards here too.
  const [viewMode, setViewMode] = useExplorerViewMode();

  const currentFolderId = spot.kind === 'folder' ? spot.id : null;
  // What the open spot holds directly: its folders, then its designs.
  const directFolders =
    spot.kind === 'root' ? lib.rootFolders : (lib.childrenByParent.get(spot.id) ?? []);
  const directDesigns = lib.designsByFolder.get(currentFolderId) ?? [];
  const bare = directFolders.length === 0 && directDesigns.length === 0;
  // A set lens reaches every subfolder of the spot and steps the folder rows aside.
  const lensed = lens?.active === true;
  const reach = lensed
    ? scopeDesigns(currentFolderId, lib.childrenByParent, lib.designsByFolder)
    : directDesigns;
  const visibleFolders = lensed ? [] : directFolders;
  const visibleDesigns = lens ? lens.narrow(reach) : reach;
  // A lensed row from a subfolder names its folder, opening it (recent-folder-chip.md).
  const folderChipFor = (d: { folderId: string | null }) => {
    if (!lensed || d.folderId === currentFolderId) return null;
    const folderId = d.folderId;
    if (folderId === null)
      return { label: 'Team designs', onOpen: () => setSpot({ kind: 'root' }) };
    const folder = lib.folders.find((f) => f.id === folderId);
    return folder
      ? { label: folder.name, onOpen: () => setSpot({ kind: 'folder', id: folder.id }) }
      : null;
  };

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    const root = { label: 'Team designs', onClick: () => setSpot({ kind: 'root' }) };
    if (spot.kind === 'root') return [{ label: 'Team designs' }];
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
  // design-row-shared split).
  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    void lib.renameFolder(id, name);
  };
  const startRenameDesign = (id: string) => setRenamingDesignId(id);
  const commitRenameDesign = (id: string, name: string) => {
    setRenamingDesignId(null);
    void lib.renameDesign(id, name);
  };
  const duplicateDesign = (id: string) => void lib.duplicateDesign(id);
  // No question first (docs/specs/013-workspace/trash.md "Deleting"): it goes to the team's Trash, and the toast offers
  // it back.
  const deleteDesign = async (id: string) => {
    const name = lib.designs.find((d) => d.id === id)?.name;
    if (!(await lib.deleteDesign(id))) {
      toast.error(DESIGN_FAILURE.delete(name));
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
    designs: visibleDesigns,
    ownerId,
    onOpenFolder: (id) => setSpot({ kind: 'folder', id }),
    onCommitRenameFolder: commitRenameFolder,
    onCancelRenameFolder: () => setRenamingFolderId(null),
    renamingFolderId,
    renamingDesignId,
    onCommitRenameDesign: commitRenameDesign,
    onCancelRenameDesign: () => setRenamingDesignId(null),
    folderActions,
    onStartRenameDesign: startRenameDesign,
    onDuplicateDesign: duplicateDesign,
    onDeleteDesign: (id: string) => void deleteDesign(id),
    onMoveDesign: (id) => setMoveTarget({ kind: 'design', id }),
    childrenCount: (id) => lib.childrenByParent.get(id)?.length ?? 0,
    designsCount: (id) => lib.designsByFolder.get(id)?.length ?? 0,
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
        <LensAnnouncer input={lens.input} shown={visibleDesigns.length} total={reach.length} />
      ) : null}
      {lib.loading ? (
        <SkeletonRows count={2} framed={false} />
      ) : lens && lensed && !bare && visibleDesigns.length === 0 ? (
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
              description="Move a design here from My Work, or create a folder to organise ahead."
            />
          ) : (
            <EmptyState
              icon={<FolderSolidIcon open />}
              title="This Folder Is Empty"
              description="Move a design here, or add a subfolder to organise your team's work."
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
        // Same folders + designs as the list, rendered as the Explorer's
        // card grid (docs/specs/006-design/design-snapshots.md). Team designs (DesignSummary) satisfy the
        // grid's PaneDesign contract; the visibility badge is hidden
        // since every card here is a team design.
        <div className="p-3">
          <CardView
            {...teamViewProps}
            // Folder content previews (docs/specs/013-workspace/folder-content-previews.md), from the team library's
            // own indexes — the same ones the counts read.
            folderContents={(id) => ({
              folders: lib.childrenByParent.get(id) ?? [],
              designs: lib.designsByFolder.get(id) ?? [],
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
                (lib.designsByFolder.get(f.id)?.length ?? 0)
              }
              onOpen={() => setSpot({ kind: 'folder', id: f.id })}
              onCommitRename={(name) => commitRenameFolder(f.id, name)}
              onCancelRename={() => setRenamingFolderId(null)}
              getActionsForAnchor={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {visibleDesigns.map((d) => (
            // The Explorer's own row, so a team row matches the FolderRows
            // above it (a local copy had drifted to a 3-column grid).
            <DesignRow
              key={d.id}
              design={d}
              ownerId={ownerId}
              renaming={renamingDesignId === d.id}
              showVisibility={false}
              folderChip={folderChipFor(d)}
              onMove={() => setMoveTarget({ kind: 'design', id: d.id })}
              onStartRename={() => startRenameDesign(d.id)}
              onCommitRename={(name) => commitRenameDesign(d.id, name)}
              onCancelRename={() => setRenamingDesignId(null)}
              onDuplicate={() => duplicateDesign(d.id)}
              onDelete={() => void deleteDesign(d.id)}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {/* Same shared move modal as the personal surfaces (docs/specs/013-workspace/folders.md). With
          `moveDests` (the explorer page supplies it) a DESIGN move offers
          every space — My Work plus each team — so a team design can be
          re-homed back to the personal tree or on to another team from
          right here; the space overview + back bar come with it. This
          team's own folders come from the live lib (fresher than the
          sweep). Folder moves stay scoped to this team: a folder cannot
          change scope, so the wider browse would only offer dead ends. */}
      {moveTarget ? (
        <MoveToFolderDialog
          subjectName={
            (moveTarget.kind === 'design'
              ? lib.designs.find((d) => d.id === moveTarget.id)?.name
              : lib.folders.find((f) => f.id === moveTarget.id)?.name) || 'Untitled'
          }
          subjectKind={moveTarget.kind}
          personalFolders={
            moveTarget.kind === 'design' && moveDests ? moveDests.personalFolders : undefined
          }
          teams={
            moveTarget.kind === 'design' && moveDests
              ? moveDests.teams.map((t) =>
                  t.id === teamId ? { ...t, folders: movePickerFolders } : t,
                )
              : [{ id: teamId, name: teamName ?? 'Team', folders: movePickerFolders }]
          }
          currentTeamId={teamId}
          currentFolderId={
            moveTarget.kind === 'design'
              ? (lib.designs.find((d) => d.id === moveTarget.id)?.folderId ?? null)
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
              void lib.moveDesign(moveTarget.id, dest.folderId);
              return;
            }
            // Leaving this team (to My Work or another team): route via the
            // explorer's placement-aware mover, then refresh this library so
            // the row disappears once the move lands.
            void Promise.resolve(onMoveDesignTo?.(moveTarget.id, dest)).then(() => lib.refresh());
          }}
          onClose={() => setMoveTarget(null)}
        />
      ) : null}
    </div>
  );
}
