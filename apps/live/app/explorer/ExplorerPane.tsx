'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useExplorer } from './ExplorerContext';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows, type PaneDocument } from './views';
import { CardView } from './CardView';
import { DetailsView } from './details/DetailsView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { ViewInfo } from './ViewInfo';
import { PaneLensBar } from './lens/PaneLensBar';
import { FilteredEmpty, LoadFailed } from './lens/LensStates';
import { narrowRows } from './lens/pane-lens';
import { TimelineControls } from '@livediagram/ui';
import { DocumentHistoryDialog } from '@/components/panels/DocumentHistoryDialog';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useTimelineFeed } from './useTimelineFeed';
import { useExplorerImport } from './useExplorerImport';
import { explorerPathFor } from './routes';
import { VIEW_TITLES } from './view-titles';
import { paneHeaderActions } from './pane-header-actions';

// The three layouts of a browse section, by the toggle.
const VIEW_COMPONENTS = { list: ListView, card: CardView, details: DetailsView } as const;

// The browse sections that render a folders + documents grid the List/Card
// toggle (docs/specs/006-document/document-snapshots.md) can swap. Other sections (gallery, themes,
// profile, team, invites, shared) have their own fixed layout.
const BROWSE_KINDS = new Set(['recent', 'all', 'folder', 'search', 'favourites', 'offline']);

// Each Explorer section deep-links its matching help-centre article from a
// Help button in the pane header (docs/specs/018-help/contextual-help-links.md); the button's hover card copy comes
// from HELP_LINK_COPY. Sections without a guide (team, invites) simply omit
// it.
const SECTION_HELP: Partial<Record<string, HelpArticleKey>> = {
  // The Home article covers Home and the Timeline (docs/specs/013-workspace/explorer-home.md).
  home: 'timeline',
  timeline: 'timeline',
  inbox: 'inbox',
  recent: 'recentDocuments',
  shared: 'sharedWithYou',
  gallery: 'imageGallery',
  themes: 'customThemes',
  trash: 'trash',
  offline: 'offlineMode',
  folder: 'folders',
  all: 'folders',
  search: 'explorerFilters',
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
    lens,
    lensResult,
    failedReads,
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
  // Where each row lives (docs/specs/013-workspace/recent-folder-chip.md), on the views that list
  // more than one place: Recent, Favourites and Search results, and a scoped view whose lens
  // reaches into its subfolders (explorer-filters.md "Views"). Elsewhere every row sits in the
  // view's own folder, where the chip would only repeat its title.
  //
  // Rows shared WITH you carry no folderId at all (they live in the sharer's
  // library, not yours), so they get no chip rather than a misleading one.
  const folderChipFor = useCallback(
    (d: PaneDocument): { label: string; onOpen: () => void } | null => {
      if (d.shared) return null;
      const aggregates =
        selected.kind === 'recent' || selected.kind === 'favourites' || selected.kind === 'search';
      const reaching = lensResult.active && (selected.kind === 'all' || selected.kind === 'folder');
      if (!aggregates && !reaching) return null;
      // A row in the folder the reader is in needs no chip.
      const here = selected.kind === 'folder' ? selected.id : null;
      if (reaching && d.folderId === here) return null;
      // A team document's folder belongs to the team's library, which `folderById` (your
      // personal folders) doesn't index: the chip names the TEAM and opens its library.
      if (d.team) {
        return { label: d.team.name, onOpen: () => go({ kind: 'team', id: d.team!.id }) };
      }
      if (!d.folderId) {
        // The root is a location too: My documents.
        return { label: VIEW_TITLES.all, onOpen: () => go({ kind: 'all' }) };
      }
      const folder = folderById.get(d.folderId);
      if (!folder) return null;
      return { label: folder.name, onOpen: () => go({ kind: 'folder', id: folder.id }) };
    },
    [selected, folderById, go, lensResult.active],
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

  // Which of New document, New folder and Import from this section offers (pane-header-actions.ts).
  const offers = paneHeaderActions(selected.kind);
  const newDocument = offers.newDocument
    ? () =>
        window.location.assign(selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new')
    : undefined;
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
          selected.kind === 'timeline' || offers.importFrom ? (
            <>
              {selected.kind === 'timeline' ? (
                <TimelineControls controls={timeline.controls} />
              ) : null}
              {offers.importFrom ? imports.toolbar : null}
            </>
          ) : undefined
        }
        viewMode={isBrowse ? viewMode : undefined}
        onSetViewMode={isBrowse ? setViewMode : undefined}
        onCreateDocument={newDocument}
        onCreateFolder={
          offers.newFolder
            ? () => createFolder(selected.kind === 'folder' ? selected.id : null)
            : undefined
        }
        folderLabel={selected.kind === 'folder' ? 'New Subfolder' : 'New Folder'}
      />

      {/* A view the app gathers explains itself under the breadcrumb. */}
      <ViewInfo selected={selected} />
      {/* The lens's chips and live region (explorer-filters.md "The chip row"). */}
      {lens.view !== null ? (
        <PaneLensBar
          showIssues={!(lensResult.active && lensResult.shown === 0 && !lensResult.empty)}
        />
      ) : null}

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
            timelineHref={explorerPathFor({ kind: 'timeline' })}
            onSeeTimeline={() => go({ kind: 'timeline' })}
            recentHref={explorerPathFor({ kind: 'recent' })}
            onSeeMore={() => go({ kind: 'recent' })}
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
      ) : selected.kind === 'inbox' ? (
        // Like the Timeline, ahead of the document-list `loading` gate: the
        // section reads its own feed (docs/specs/013-workspace/inbox.md §5).
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
            // The team library reads its own rows, so it narrows them itself.
            lens={{
              active: lensResult.active,
              input: lens.input,
              issues: lens.parsed.issues,
              narrow: (rows) => narrowRows(rows, lens.parsed.lens, ownerId, lens.now),
              clear: () => lens.setInput(''),
            }}
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
      ) : (selected.kind === 'shared' ? failedReads.shared : failedReads.documents) ? (
        // A failed read never reads as an empty account (explorer-filters.md "States").
        <LoadFailed onRetry={() => (ownerId ? void refreshPersonal(ownerId) : undefined)} />
      ) : lensResult.empty ? (
        <EmptyPane selected={selected} />
      ) : lensResult.active && lensResult.shown === 0 ? (
        <FilteredEmpty issues={lens.parsed.issues} onClear={() => lens.setInput('')} />
      ) : selected.kind === 'shared' ? (
        <SharedList
          shared={shared.filter((s) => paneContent.documents.some((d) => d.id === s.id))}
          ownerId={ownerId}
          onDismiss={dismissShared}
        />
      ) : (
        (() => {
          // List, Card and Details take the SAME props (docs/specs/006-document/document-snapshots.md,
          // docs/specs/013-workspace/explorer-details-view.md), so build them once and pick the component
          // by the toggle.
          const ViewComponent = VIEW_COMPONENTS[viewMode];
          return (
            <ViewComponent
              folders={paneContent.folders}
              documents={paneContent.documents}
              ownerId={ownerId}
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
              // Owner column (desktop): the views that mix personal, team and shared rows
              // (docs/specs/013-workspace/team-shared-documents.md) are the ones where ownership varies.
              showOwner={selected.kind === 'recent' || selected.kind === 'search'}
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
