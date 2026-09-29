'use client';

import { useState } from 'react';
import type { Folder } from '@livediagram/api-schema';
import { FolderRow, SkeletonRows, UnsortedRow } from '@/app/explorer/views';
import { EmptyState } from '@livediagram/ui';
import { FolderSolidIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { CardView } from '@/app/explorer/CardView';
import { TeamLibraryHeader } from '@/components/panels/TeamLibraryHeader';
import { useExplorerViewMode } from '@/app/explorer/useExplorerViewMode';
import { DocumentRow } from '@/app/explorer/explorer-route-document-row';
import {
  MoveToFolderDialog,
  type MoveDestination,
  type MoveFolderNode,
} from '@/components/dialogs/MoveToFolderDialog';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useTeamLibrary } from '@/hooks/persistence/useTeamLibrary';
import { apiCreateFolder } from '@/lib/api-client';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import { track } from '@/lib/telemetry';
import { folderDescendants } from '@/lib/folder-tree';
import { TEAM_TRASH_RESTORE_HINT } from '@/lib/trash-copy';

// "Shared documents" on the team page (docs/specs/013-workspace/team-shared-documents.md): the team's folder
// tree + documents, navigated with a small breadcrumb instead of a
// sidebar. The concept (and most of the row components) is the
// personal explorer's, just team-scoped: every joined member can
// create / rename / move / delete folders, re-folder documents, and
// remove a document from the team (back to its owner's personal
// Unsorted). The Unsorted bucket is synthetic and undeletable, same
// as the personal tree.

type Spot = { kind: 'root' } | { kind: 'unsorted' } | { kind: 'folder'; id: string };

export function TeamSharedDocuments({
  ownerId,
  teamId,
  teamName,
  moveDests,
  onMoveDocumentTo,
}: {
  ownerId: string;
  teamId: string;
  // Shown by the move picker's Team Library card; falls back to "Team".
  teamName?: string;
  // Full move destinations (docs/specs/013-workspace/team-shared-documents.md): the caller's personal folder tree plus
  // EVERY team's library, so a document can be re-homed anywhere (back to My
  // Work, or on to another team) from this page — the space overview + back
  // bar appear once more than one space exists. Absent = document moves stay
  // scoped to this team. Folder moves are always team-scoped (a folder
  // can't change scope).
  moveDests?: {
    personalFolders: { id: string; name: string; parentId: string | null }[];
    teams: { id: string; name: string; folders: MoveFolderNode[] }[];
  };
  // Routes a cross-scope pick (personal / another team) — the explorer's
  // `moveDocumentTo`, which picks the right API call from the document's
  // current placement. Same-team picks keep using lib.moveDocument.
  onMoveDocumentTo?: (id: string, dest: MoveDestination) => void;
}) {
  const lib = useTeamLibrary(ownerId, teamId);
  // Deep link: /explorer/team?id=<team>&folder=<id> opens with that
  // folder focused (the search panel's team-folder results navigate
  // here). Safe to read window in the initialiser: the explorer
  // chrome only mounts post-auth on the client, never in SSG output.
  const [spot, setSpot] = useState<Spot>(() => {
    if (typeof window === 'undefined') return { kind: 'root' };
    const folder = new URLSearchParams(window.location.search).get('folder');
    return folder ? { kind: 'folder', id: folder } : { kind: 'root' };
  });
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'document'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  // "+ Create" dropdown (mirrors the personal pane header): one compact
  // button instead of two, so the breadcrumb keeps its room on mobile.
  const confirm = useConfirm();
  // List vs card layout — the same device-local preference (docs/specs/006-document/document-snapshots.md) the
  // Explorer browse views use, so a card-view user gets cards here too.
  const [viewMode, setViewMode] = useExplorerViewMode();

  const unsorted = lib.documentsByFolder.get(null) ?? [];
  const currentFolderId = spot.kind === 'folder' ? spot.id : null;
  const visibleFolders =
    spot.kind === 'root'
      ? lib.rootFolders
      : spot.kind === 'folder'
        ? (lib.childrenByParent.get(spot.id) ?? [])
        : [];
  const visibleDocuments =
    spot.kind === 'unsorted'
      ? unsorted
      : spot.kind === 'folder'
        ? (lib.documentsByFolder.get(spot.id) ?? [])
        : [];

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    const root = { label: 'Team documents', onClick: () => setSpot({ kind: 'root' }) };
    if (spot.kind === 'root') return [{ label: 'Team documents' }];
    if (spot.kind === 'unsorted') return [root, { label: 'Unsorted' }];
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
      const ok = await confirm({
        title: 'Delete team folder?',
        message: `"${f.name || 'This folder'}" will be deleted. Its subfolders move to the top level and its documents move to the team's Unsorted.`,
        confirmLabel: 'Delete folder',
      });
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
  // document-row-shared split).
  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    void lib.renameFolder(id, name);
  };
  const startRenameDocument = (id: string) => setRenamingDocumentId(id);
  const commitRenameDocument = (id: string, name: string) => {
    setRenamingDocumentId(null);
    void lib.renameDocument(id, name);
  };
  const duplicateDocument = (id: string) => void lib.duplicateDocument(id);
  const deleteDocument = async (id: string) => {
    const d = lib.documents.find((x) => x.id === id);
    const notice = await fetchSharedTabsNotice(ownerId, id, 'delete');
    const ok = await confirm({
      title: 'Delete team document?',
      message: [
        `"${d?.name || 'This document'}" will be deleted for the whole team.`,
        notice,
        TEAM_TRASH_RESTORE_HINT,
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Delete',
    });
    if (ok) void lib.deleteDocument(id);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
      {lib.loading ? (
        <SkeletonRows count={2} framed={false} />
      ) : visibleFolders.length === 0 &&
        visibleDocuments.length === 0 &&
        !(spot.kind === 'root' && unsorted.length > 0) ? (
        // The Explorer's empty-state card (docs/specs/013-workspace/folders.md), inset so its border
        // sits inside this section's own.
        <div className="p-3">
          {spot.kind === 'root' ? (
            <EmptyState
              icon={<TeamIcon />}
              title="Nothing Shared Yet"
              description="Move a document here from your personal explorer, or create a folder to organise ahead."
            />
          ) : (
            <EmptyState
              icon={<FolderSolidIcon open />}
              title="This Folder Is Empty"
              description="Move a document here, or add a subfolder to organise your team's work."
            />
          )}
        </div>
      ) : viewMode === 'card' ? (
        // Same folders + documents as the list, rendered as the Explorer's
        // card grid (docs/specs/006-document/document-snapshots.md). Team documents (DocumentSummary) satisfy the
        // grid's PaneDocument contract; the visibility badge is hidden
        // since every card here is a team document.
        <div className="p-3">
          <CardView
            folders={visibleFolders}
            documents={visibleDocuments}
            ownerId={ownerId}
            showUnsortedRow={spot.kind === 'root' && unsorted.length > 0}
            unsortedCount={unsorted.length}
            onOpenUnsorted={() => setSpot({ kind: 'unsorted' })}
            onOpenFolder={(id) => setSpot({ kind: 'folder', id })}
            onCommitRenameFolder={commitRenameFolder}
            onCancelRenameFolder={() => setRenamingFolderId(null)}
            renamingFolderId={renamingFolderId}
            renamingDocumentId={renamingDocumentId}
            onCommitRenameDocument={commitRenameDocument}
            onCancelRenameDocument={() => setRenamingDocumentId(null)}
            folderActions={folderActions}
            onStartRenameDocument={startRenameDocument}
            onDuplicateDocument={duplicateDocument}
            onDeleteDocument={deleteDocument}
            onMoveDocument={(id) => setMoveTarget({ kind: 'document', id })}
            childrenCount={(id) => lib.childrenByParent.get(id)?.length ?? 0}
            documentsCount={(id) => lib.documentsByFolder.get(id)?.length ?? 0}
            // Folder content previews (docs/specs/013-workspace/folder-content-previews.md), from the team library's
            // own indexes — the same ones the counts above read.
            folderContents={(id) => ({
              folders: lib.childrenByParent.get(id) ?? [],
              documents: lib.documentsByFolder.get(id) ?? [],
            })}
            showVisibilityBadge={false}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {spot.kind === 'root' && unsorted.length > 0 ? (
            <UnsortedRow count={unsorted.length} onOpen={() => setSpot({ kind: 'unsorted' })} />
          ) : null}
          {visibleFolders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              renaming={renamingFolderId === f.id}
              childCount={
                (lib.childrenByParent.get(f.id)?.length ?? 0) +
                (lib.documentsByFolder.get(f.id)?.length ?? 0)
              }
              onOpen={() => setSpot({ kind: 'folder', id: f.id })}
              onCommitRename={(name) => commitRenameFolder(f.id, name)}
              onCancelRename={() => setRenamingFolderId(null)}
              getActionsForAnchor={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {visibleDocuments.map((d) => (
            // The Explorer's own row, so a team row matches the FolderRows
            // above it (a local copy had drifted to a 3-column grid).
            <DocumentRow
              key={d.id}
              document={d}
              ownerId={ownerId}
              renaming={renamingDocumentId === d.id}
              showVisibility={false}
              onMove={() => setMoveTarget({ kind: 'document', id: d.id })}
              onStartRename={() => startRenameDocument(d.id)}
              onCommitRename={(name) => commitRenameDocument(d.id, name)}
              onCancelRename={() => setRenamingDocumentId(null)}
              onDuplicate={() => duplicateDocument(d.id)}
              onDelete={() => deleteDocument(d.id)}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {/* Same shared move modal as the personal surfaces (docs/specs/013-workspace/folders.md). With
          `moveDests` (the explorer page supplies it) a DOCUMENT move offers
          every space — Personal Space plus each team — so a team document can be
          re-homed back to the personal tree or on to another team from
          right here; the space overview + back bar come with it. This
          team's own folders come from the live lib (fresher than the
          sweep). Folder moves stay scoped to this team: a folder cannot
          change scope, so the wider browse would only offer dead ends. */}
      {moveTarget ? (
        <MoveToFolderDialog
          subjectName={
            (moveTarget.kind === 'document'
              ? lib.documents.find((d) => d.id === moveTarget.id)?.name
              : lib.folders.find((f) => f.id === moveTarget.id)?.name) || 'Untitled'
          }
          subjectKind={moveTarget.kind}
          personalFolders={
            moveTarget.kind === 'document' && moveDests ? moveDests.personalFolders : undefined
          }
          teams={
            moveTarget.kind === 'document' && moveDests
              ? moveDests.teams.map((t) =>
                  t.id === teamId ? { ...t, folders: movePickerFolders } : t,
                )
              : [{ id: teamId, name: teamName ?? 'Team', folders: movePickerFolders }]
          }
          currentTeamId={teamId}
          currentFolderId={
            moveTarget.kind === 'document'
              ? (lib.documents.find((d) => d.id === moveTarget.id)?.folderId ?? null)
              : (lib.folders.find((f) => f.id === moveTarget.id)?.parentId ?? null)
          }
          onCreateFolder={async (name, parentId, destTeamId) => {
            // In-team creates go through the lib so the local list updates
            // immediately. Other scopes (personal / another team, reachable
            // via moveDests) create through the API directly: the fresh
            // folder is a valid destination straight away, and the sweep
            // picks its tile up on the next explorer refresh.
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
              return { id: folder.id, name: folder.name, parentId: folder.parentId };
            } catch {
              return null;
            }
          }}
          onPick={(dest) => {
            if (moveTarget.kind === 'folder') {
              void lib.moveFolder(moveTarget.id, dest.folderId);
              return;
            }
            if (dest.teamId === teamId) {
              void lib.moveDocument(moveTarget.id, dest.folderId);
              return;
            }
            // Leaving this team (to Personal Space or another team): route via the
            // explorer's placement-aware mover, then refresh this library so
            // the row disappears once the move lands.
            void Promise.resolve(onMoveDocumentTo?.(moveTarget.id, dest)).then(() => lib.refresh());
          }}
          onClose={() => setMoveTarget(null)}
        />
      ) : null}
    </div>
  );
}
