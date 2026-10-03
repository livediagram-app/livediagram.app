'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useExplorer } from './ExplorerContext';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows, type PaneDocument } from './views';
import { CardView } from './CardView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { DynamicFolderInfo } from './DynamicFolderInfo';
import { TimelineControls } from '@livediagram/ui';
import { DocumentHistoryDialog } from '@/components/panels/DocumentHistoryDialog';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useTimelineFeed } from './useTimelineFeed';
import { useExplorerImport } from './useExplorerImport';
import { explorerPathFor } from './routes';

// The browse sections that render a folders + documents grid the List/Card
// toggle (docs/specs/006-document/document-snapshots.md) can swap. Other sections (gallery, themes,
// profile, team, invites, shared) have their own fixed layout.
const BROWSE_KINDS = new Set([
  'recent',
  'all',
  'folder',
  'unsorted',
  'favourites',
  'generated',
  'offline',
  'dynamic',
]);

// Each Explorer section deep-links its matching help-centre article from a
// Help button in the pane header (docs/specs/018-help/contextual-help-links.md); the button's hover card copy comes
// from HELP_LINK_COPY. Sections without a guide (team, invites) simply omit
// it.
const SECTION_HELP: Partial<Record<string, HelpArticleKey>> = {
  // The Home article covers Home and All activity (docs/specs/013-workspace/explorer-home.md).
  home: 'timeline',
  timeline: 'timeline',
  activity: 'activity',
  recent: 'recentDocuments',
  shared: 'sharedWithYou',
  gallery: 'imageGallery',
  themes: 'customThemes',
  trash: 'trash',
  unsorted: 'unsorted',
  offline: 'offlineMode',
  folder: 'folders',
  all: 'folders',
};

// Lazy-load the heavier panes — each is only mounted on its own
// route, so none of them sit in the shared explorer chunk.
const GalleryPane = dynamic(
  () => import('@/components/panels/GalleryPane').then((m) => m.GalleryPane),
  { ssr: false },
);
const TrashSection = dynamic(() => import('./TrashSection').then((m) => m.TrashSection), {
  ssr: false,
});
const ThemesPane = dynamic(
  () => import('@/components/panels/ThemesPane').then((m) => m.ThemesPane),
  { ssr: false },
);
const ShapeLibrariesPane = dynamic(
  () => import('@/components/panels/ShapeLibrariesPane').then((m) => m.ShapeLibrariesPane),
  { ssr: false },
);
const TeamPane = dynamic(() => import('@/components/panels/TeamPane').then((m) => m.TeamPane), {
  ssr: false,
});
const TeamInvitesPane = dynamic(
  () => import('@/components/panels/TeamInvitesPane').then((m) => m.TeamInvitesPane),
  { ssr: false },
);
// The Timeline is the landing route, so it's the one lazy pane most
// visitors DO load. Split anyway: the calendar grid + filter popover
// are only reached by someone who switches modes, and holding them out
// of the shared explorer chunk keeps the other sections' first paint
// unaffected by a feature they don't use.
const TimelinePane = dynamic(
  () => import('@/components/panels/TimelinePane').then((m) => m.TimelinePane),
  { ssr: false },
);
// Home is the landing route (docs/specs/013-workspace/explorer-home.md), lazy like every pane so
// the shared explorer chunk stays the same size for the other sections.
const HomePane = dynamic(
  () => import('@/components/panels/home/HomePane').then((m) => m.HomePane),
  { ssr: false },
);
const ActivityPane = dynamic(
  () => import('@/components/panels/ActivityPane').then((m) => m.ActivityPane),
  { ssr: false },
);

// The right pane for whichever /explorer/<section> route is active:
// PaneHeader (title, breadcrumb, contextual CTAs) + the section's
// content. One component for every route page so the sections can't
// drift apart visually — each page under /explorer just renders this;
// the section itself is derived from the URL in useExplorerState.
export function ExplorerPane() {
  const {
    prefs,
    folderById,
    favouriteIds,
    toggleFavourite,
    toggleRecentExclusion,
    selected,
    go,
    loading,
    ownerId,
    refreshPersonal,
    clerkUserId,
    clerkDisplayName,
    activity,
    paneTitle,
    paneCrumbs,
    paneContent,
    unsortedDocuments,
    generatedDocuments,
    offlineDocuments,
    childrenByParent,
    documentsByFolder,
    setMobileNavOpen,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingDocumentId,
    setRenamingDocumentId,
    renameDocument,
    deleteDocument,
    duplicateDocument,
    openMovePickerForDocument,
    folderActions,
    shared,
    dismissShared,
    invites,
    acceptInvite,
    declineInvite,
    refreshTeams,
    movePersonalFolders,
    moveTeamDests,
    moveDocumentTo,
    timelineUnread,
  } = useExplorer();

  // A team you're not a member of 404s in TeamPane (it doesn't leak the
  // name). When that happens, drop the title/breadcrumb above it — there
  // is no team to name. Kept with the node it was found missing in, so a
  // real team's title is never suppressed by a stale 404 from the last one.
  const [notFoundIn, setNotFoundIn] = useState<typeof selected | null>(null);
  const teamNotFound = notFoundIn === selected;
  // Where each Recent row lives (docs/specs/013-workspace/recent-folder-chip.md). Recent is the only pane that
  // spans folders — every other one IS a folder, so a chip there would just
  // repeat the pane's own title.
  //
  // Rows shared WITH you carry no folderId at all (they live in the sharer's
  // library, not yours), so they get no chip rather than a misleading one.
  const folderChipFor = useCallback(
    (d: PaneDocument): { label: string; onOpen: () => void } | null => {
      // Recent AND Favourites both aggregate across folders, so both need
      // to say where a row actually lives (docs/specs/013-workspace/recent-folder-chip.md, docs/specs/013-workspace/favourites.md). Every other
      // pane IS a folder, where the chip would just repeat its title.
      const aggregates = selected.kind === 'recent' || selected.kind === 'favourites';
      if (!aggregates || d.shared) return null;
      // A team document's folder belongs to the team's library, so the chip
      // jumps into that team rather than your personal tree.
      if (d.team) {
        // Team folders live in the team's own tree, which `folderById`
        // (your personal folders) doesn't index — so the chip names the
        // TEAM and opens its library, which is the location that matters
        // for a team row anyway.
        return { label: d.team.name, onOpen: () => go({ kind: 'team', id: d.team!.id }) };
      }
      if (!d.folderId) {
        // No folder is still a location: the synthetic Unsorted view.
        return { label: 'Unsorted', onOpen: () => go({ kind: 'unsorted' }) };
      }
      const folder = folderById.get(d.folderId);
      if (!folder) return null;
      return { label: folder.name, onOpen: () => go({ kind: 'folder', id: folder.id }) };
    },
    [selected.kind, folderById, go],
  );

  const hideTeamTitle = selected.kind === 'team' && teamNotFound;
  const sectionHelp = SECTION_HELP[selected.kind];
  const [viewMode, setViewMode] = useExplorerViewMode();
  // The toggle only appears on the browse sections (the ones the
  // List/Card swap below applies to).
  const isBrowse = BROWSE_KINDS.has(selected.kind);
  // The Timeline's data + control state lives here rather than inside
  // its pane, because its controls render in the header row below while
  // its feed renders in the body. Gated like the other section hooks so
  // visiting Recent doesn't fetch a feed nobody is looking at.
  const timeline = useTimelineFeed(ownerId, selected.kind === 'timeline');
  // Which document's history dialog is open, if any (docs/specs/013-workspace/timeline.md §3.4).
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);

  const newDocument =
    // Home and All activity get one too. Neither is a container you add to, but Home is the
    // first screen of the app (docs/specs/013-workspace/explorer-home.md), where starting a
    // document must never be a dead end; it navigates to /new and files nothing here.
    //
    // Activity does NOT: a new document puts nothing on an inbox of
    // open actions and threads (docs/specs/013-workspace/activity-page.md §1).
    selected.kind === 'activity' ||
    selected.kind === 'shared' ||
    selected.kind === 'gallery' ||
    selected.kind === 'themes' ||
    selected.kind === 'shape-libraries' ||
    selected.kind === 'trash' ||
    selected.kind === 'team' ||
    selected.kind === 'invites' ||
    // Generated / Offline are read-through dynamic views, not places
    // you hand-author into (offline documents are created from the /new
    // wizard's Settings toggle).
    selected.kind === 'generated' ||
    selected.kind === 'offline' ||
    selected.kind === 'dynamic'
      ? undefined
      : () =>
          window.location.assign(
            selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new',
          );
  // Imports sit beside New document: imported boards land where new documents do.
  const imports = useExplorerImport({
    ownerId,
    folderId: selected.kind === 'folder' ? selected.id : null,
    onDocumentsCreated: () => {
      if (ownerId) void refreshPersonal(ownerId);
    },
  });

  return (
    <>
      {imports.dialogs}
      <PaneHeader
        title={hideTeamTitle ? '' : paneTitle}
        crumbs={hideTeamTitle ? [] : paneCrumbs}
        onOpenNav={() => setMobileNavOpen(true)}
        helpArticle={sectionHelp}
        headerActions={
          selected.kind === 'timeline' || newDocument ? (
            <>
              {selected.kind === 'timeline' ? (
                <TimelineControls controls={timeline.controls} />
              ) : null}
              {newDocument && selected.kind !== 'home' ? imports.toolbar : null}
            </>
          ) : undefined
        }
        viewMode={isBrowse ? viewMode : undefined}
        onSetViewMode={isBrowse ? setViewMode : undefined}
        onCreateDocument={newDocument}
        onCreateFolder={
          selected.kind === 'home' ||
          selected.kind === 'timeline' ||
          selected.kind === 'activity' ||
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'themes' ||
          selected.kind === 'shape-libraries' ||
          selected.kind === 'trash' ||
          selected.kind === 'team' ||
          selected.kind === 'invites' ||
          selected.kind === 'recent' ||
          selected.kind === 'generated' ||
          selected.kind === 'offline' ||
          selected.kind === 'dynamic'
            ? undefined
            : () => createFolder(selected.kind === 'folder' ? selected.id : null)
        }
        folderLabel={selected.kind === 'folder' ? 'New Subfolder' : 'New Folder'}
      />

      {/* Dynamic (synthetic) folders explain themselves under the breadcrumb. */}
      <DynamicFolderInfo selected={selected} />

      {/* Timeline runs ahead of the `loading` gate on purpose: that flag
          tracks the DOCUMENT lists, which this section doesn't read, and
          waiting on them would show document skeletons on the landing
          page before the feed's own skeleton. */}
      {selected.kind === 'home' ? (
        // Ahead of the `loading` gate, like the Timeline: Home reads its own data.
        ownerId ? (
          <HomePane
            ownerId={ownerId}
            onSeen={timelineUnread.clear}
            allActivityHref={explorerPathFor({ kind: 'timeline' })}
            onSeeAll={() => go({ kind: 'timeline' })}
          />
        ) : null
      ) : selected.kind === 'timeline' ? (
        ownerId ? (
          <TimelinePane
            feed={timeline}
            ownerId={ownerId}
            onShowHistory={(id, name) => setHistoryFor({ id, name })}
          />
        ) : null
      ) : selected.kind === 'activity' ? (
        // Like the Timeline, ahead of the document-list `loading` gate: the
        // section reads its own feed (docs/specs/013-workspace/activity-page.md §5).
        <ActivityPane feed={activity} />
      ) : loading ? (
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
            onLeftTeam={() => go({ kind: 'home' })}
            onLoadResult={(found) => setNotFoundIn(found ? null : selected)}
            // The shared-documents move picker offers every space (docs/specs/013-workspace/team-shared-documents.md):
            // the personal tree + each team, with `moveDocumentTo` routing a
            // cross-scope pick from the document's current placement.
            moveDests={{ personalFolders: movePersonalFolders, teams: moveTeamDests }}
            onMoveDocumentTo={moveDocumentTo}
          />
        ) : null
      ) : selected.kind === 'gallery' ? (
        ownerId ? (
          <GalleryPane ownerId={ownerId} />
        ) : null
      ) : selected.kind === 'themes' ? (
        <ThemesPane />
      ) : selected.kind === 'shape-libraries' ? (
        <ShapeLibrariesPane />
      ) : selected.kind === 'trash' ? (
        <TrashSection />
      ) : selected.kind === 'shared' ? (
        <SharedList shared={shared} ownerId={ownerId} onDismiss={dismissShared} />
      ) : paneContent.folders.length === 0 &&
        paneContent.documents.length === 0 &&
        !paneContent.showUnsortedRow &&
        // All + Dynamic always lead with synthetic rows, so they're never
        // "empty" even with zero folders and documents.
        selected.kind !== 'all' &&
        selected.kind !== 'dynamic' ? (
        <EmptyPane selected={selected} />
      ) : (
        (() => {
          // List and Card take the SAME props (docs/specs/006-document/document-snapshots.md), so build them
          // once and pick the component by the toggle.
          const ViewComponent = viewMode === 'card' ? CardView : ListView;
          return (
            <ViewComponent
              folders={paneContent.folders}
              documents={paneContent.documents}
              ownerId={ownerId}
              // The three synthetic folders live inside the Dynamic parent
              // view; My documents (/all) leads with the single Dynamic row.
              showUnsortedRow={selected.kind === 'dynamic'}
              unsortedCount={unsortedDocuments.length}
              onOpenUnsorted={() => go({ kind: 'unsorted' })}
              showGeneratedRow={selected.kind === 'dynamic'}
              generatedCount={generatedDocuments.length}
              onOpenGenerated={() => go({ kind: 'generated' })}
              showOfflineRow={selected.kind === 'dynamic'}
              offlineCount={offlineDocuments.length}
              onOpenOffline={() => go({ kind: 'offline' })}
              showDynamicRow={selected.kind === 'all'}
              dynamicCount={
                unsortedDocuments.length + generatedDocuments.length + offlineDocuments.length
              }
              onOpenDynamic={() => go({ kind: 'dynamic' })}
              onOpenFolder={(id) => go({ kind: 'folder', id })}
              onCommitRenameFolder={commitRenameFolder}
              onCancelRenameFolder={() => setRenamingFolderId(null)}
              renamingFolderId={renamingFolderId}
              renamingDocumentId={renamingDocumentId}
              onCommitRenameDocument={renameDocument}
              onCancelRenameDocument={() => setRenamingDocumentId(null)}
              folderActions={folderActions}
              onStartRenameDocument={(id) => setRenamingDocumentId(id)}
              onDuplicateDocument={(id) => void duplicateDocument(id)}
              onDeleteDocument={deleteDocument}
              onMoveDocument={openMovePickerForDocument}
              onDismissShared={dismissShared}
              recentExcludedIds={prefs.recentExcludedIds ?? []}
              onToggleRecentExclusion={toggleRecentExclusion}
              onShowHistory={(id) => {
                const row = paneContent.documents.find((d) => d.id === id);
                // Offline documents never reach the worker, so they have
                // no server history to show (docs/specs/006-document/offline-mode.md).
                if (row && !isOfflineIdSync(id)) setHistoryFor({ id, name: row.name });
              }}
              favouriteIds={favouriteIds}
              onToggleFavourite={toggleFavourite}
              folderChipFor={folderChipFor}
              childrenCount={(id) => childrenByParent.get(id)?.length ?? 0}
              documentsCount={(id) => documentsByFolder.get(id)?.length ?? 0}
              // What each folder card previews (docs/specs/013-workspace/folder-content-previews.md) — the same
              // client-side indexes the counts come from, so no extra fetch.
              folderContents={(id) => ({
                folders: childrenByParent.get(id) ?? [],
                documents: documentsByFolder.get(id) ?? [],
              })}
              // Owner column (desktop): Recent mixes personal + team rows
              // (docs/specs/013-workspace/team-shared-documents.md), so it's the one list where ownership varies.
              showOwner={selected.kind === 'recent'}
            />
          );
        })()
      )}

      {/* One document's own history (docs/specs/013-workspace/timeline.md §3.4), opened from a row's
          menu. Lives at the pane level rather than per row so only one
          is ever mounted. */}
      {ownerId ? (
        <DocumentHistoryDialog
          open={historyFor !== null}
          onClose={() => setHistoryFor(null)}
          ownerId={ownerId}
          documentId={historyFor?.id ?? null}
          documentName={historyFor?.name ?? null}
        />
      ) : null}
    </>
  );
}
