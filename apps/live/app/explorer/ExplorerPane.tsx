'use client';

import dynamic from 'next/dynamic';
import { useExplorer } from './ExplorerContext';
import { EmptyPane, ListView, PaneHeader, SharedList, SkeletonRows } from './views';

// Lazy-load the heavier panes — each is only mounted on its own
// route, so none of them sit in the shared explorer chunk.
const GalleryPane = dynamic(() => import('@/components/GalleryPane').then((m) => m.GalleryPane));
const TeamPane = dynamic(() => import('@/components/TeamPane').then((m) => m.TeamPane));
const TeamInvitesPane = dynamic(() =>
  import('@/components/TeamInvitesPane').then((m) => m.TeamInvitesPane),
);

// The right pane for whichever /explorer/<section> route is active:
// PaneHeader (title, breadcrumb, contextual CTAs) + the section's
// content. One component for every route page so the sections can't
// drift apart visually — each page under /explorer just renders this;
// the section itself is derived from the URL in useExplorerState.
export function ExplorerPane() {
  const {
    selected,
    go,
    loading,
    ownerId,
    clerkUserId,
    clerkDisplayName,
    paneTitle,
    paneCrumbs,
    paneContent,
    unsortedDiagrams,
    childrenByParent,
    diagramsByFolder,
    setMobileNavOpen,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingDiagramId,
    setRenamingDiagramId,
    renameDiagram,
    deleteDiagram,
    duplicateDiagram,
    openMovePickerForDiagram,
    folderActions,
    shared,
    dismissShared,
    invites,
    acceptInvite,
    declineInvite,
    refreshTeams,
  } = useExplorer();

  return (
    <>
      <PaneHeader
        title={paneTitle}
        crumbs={paneCrumbs}
        onOpenNav={() => setMobileNavOpen(true)}
        onCreateDiagram={
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'team' ||
          selected.kind === 'invites'
            ? undefined
            : () =>
                window.location.assign(
                  selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new',
                )
        }
        onCreateFolder={
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'team' ||
          selected.kind === 'invites' ||
          selected.kind === 'recent'
            ? undefined
            : () => createFolder(selected.kind === 'folder' ? selected.id : null)
        }
        folderLabel={selected.kind === 'folder' ? 'New subfolder' : 'New folder'}
      />

      {loading ? (
        <SkeletonRows />
      ) : selected.kind === 'invites' ? (
        <TeamInvitesPane
          invites={invites}
          onAccept={(invite) =>
            void acceptInvite(invite).then((teamId) => {
              if (teamId) go({ kind: 'team', id: teamId });
            })
          }
          onDecline={(invite) => void declineInvite(invite)}
        />
      ) : selected.kind === 'team' ? (
        ownerId ? (
          <TeamPane
            ownerId={ownerId}
            teamId={selected.id}
            clerkUserId={clerkUserId ?? null}
            clerkDisplayName={clerkDisplayName}
            onTeamsChanged={() => void refreshTeams()}
            onLeftTeam={() => go({ kind: 'recent' })}
          />
        ) : null
      ) : selected.kind === 'gallery' ? (
        ownerId ? (
          <GalleryPane ownerId={ownerId} />
        ) : null
      ) : selected.kind === 'shared' ? (
        <SharedList shared={shared} onDismiss={dismissShared} />
      ) : paneContent.folders.length === 0 &&
        paneContent.diagrams.length === 0 &&
        !paneContent.showUnsortedRow ? (
        <EmptyPane selected={selected} />
      ) : (
        <ListView
          folders={paneContent.folders}
          diagrams={paneContent.diagrams}
          showUnsortedRow={paneContent.showUnsortedRow}
          unsortedCount={unsortedDiagrams.length}
          onOpenUnsorted={() => go({ kind: 'unsorted' })}
          onOpenFolder={(id) => go({ kind: 'folder', id })}
          onCommitRenameFolder={commitRenameFolder}
          onCancelRenameFolder={() => setRenamingFolderId(null)}
          renamingFolderId={renamingFolderId}
          renamingDiagramId={renamingDiagramId}
          onCommitRenameDiagram={renameDiagram}
          onCancelRenameDiagram={() => setRenamingDiagramId(null)}
          folderActions={folderActions}
          onStartRenameDiagram={(id) => setRenamingDiagramId(id)}
          onDuplicateDiagram={(id) => void duplicateDiagram(id)}
          onDeleteDiagram={deleteDiagram}
          onMoveDiagram={openMovePickerForDiagram}
          onDismissShared={dismissShared}
          childrenCount={(id) => childrenByParent.get(id)?.length ?? 0}
          diagramsCount={(id) => diagramsByFolder.get(id)?.length ?? 0}
          // Owner column (desktop): Recent mixes personal + team rows
          // (spec/35), so it's the one list where ownership varies.
          showOwner={selected.kind === 'recent'}
        />
      )}
    </>
  );
}
