'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo } from 'react';
import { useExplorer } from './ExplorerContext';
import { useDesignEntryFor } from './useDesignEntryFor';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows, type PaneDesign } from './views';
import { CardView } from './CardView';
import { DetailsView } from './details/DetailsView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { ViewInfo } from './ViewInfo';
import { PaneLensBar } from './lens/PaneLensBar';
import { FilteredEmpty, LoadFailed } from './lens/LensStates';
import { narrowRows } from './lens/pane-lens';
import { TimelineControls } from '@livedesign/ui';
import { DesignHistoryDialog } from '@/components/panels/DesignHistoryDialog';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useTimelineFeed } from './useTimelineFeed';
import { explorerPathFor } from './routes';
import { rowLocation } from './row-location';
import { paneHeaderActions } from './pane-header-actions';
import { useTagsPage } from './tags/useTagsPage';
import { homeBannerShown } from '@/lib/home-banner';
import { assignAppLocation } from '@/lib/app-location';

// The three layouts of a browse section, by the toggle.
const VIEW_COMPONENTS = { list: ListView, card: CardView, details: DetailsView } as const;

// The browse sections that render a folders + designs grid the List/Card
// toggle (docs/specs/006-design/design-snapshots.md) can swap. Other sections (gallery,
// profile, team, invites, shared) have their own fixed layout.
const BROWSE_KINDS = new Set([
  'recent',
  'all',
  'folder',
  'search',
  'favourites',
  'offline',
  'tags',
]);

// Each Explorer section deep-links its matching help-centre article from a
// Help button in the pane header (docs/specs/018-help/contextual-help-links.md); the button's hover card copy comes
// from HELP_LINK_COPY. Sections without a guide (team, invites) simply omit
// it.
const SECTION_HELP: Partial<Record<string, HelpArticleKey>> = {
  // The Home article covers Home and the Timeline (docs/specs/013-workspace/explorer-home.md).
  home: 'timeline',
  timeline: 'timeline',
  inbox: 'inbox',
  recent: 'recentDesigns',
  shared: 'sharedWithYou',
  gallery: 'imageGallery',
  trash: 'trash',
  offline: 'offlineMode',
  folder: 'folders',
  all: 'folders',
  search: 'explorerFilters',
  tags: 'tags',
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
const TeamPane = dynamic(() => import('@/components/panels/TeamPane').then((m) => m.TeamPane), {
  ssr: false,
});
const InvitationsOnLiveworkspace = dynamic(
  () =>
    import('@/components/panels/ManagedOnLiveworkspace').then((m) => m.InvitationsOnLiveworkspace),
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
// The Tags page (docs/specs/013-workspace/tags.md), lazy like every pane.
const TagsPane = dynamic(() => import('./tags/TagsPane').then((m) => m.TagsPane), {
  ssr: false,
});
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
    designs: liveDocs,
    teamDesigns,
    folderById,
    favouriteIds,
    toggleFavourite,
    toggleRecentExclusion,
    selected,
    go,
    loading,
    ownerId,
    refreshPersonal,
    accountUserId,
    accountDisplayName,
    activity,
    paneTitle,
    paneCrumbs,
    paneContent,
    lens,
    lensResult,
    failedReads,
    childrenByParent,
    designsByFolder,
    setMobileNavOpen,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingDesignId,
    setRenamingDesignId,
    renameDesign,
    deleteDesign,
    duplicateDesign,
    openMovePickerForDesign,
    folderActions,
    shared,
    dismissShared,
    movePersonalFolders,
    moveTeamDests,
    moveDesignTo,
    timelineUnread,
    refreshAfterTeamPage,
  } = useExplorer();
  // The shared rows the pane's designs still show, by id: a scan of the designs per shared row was
  // quadratic, rerun on every keystroke in the lens (63 ms at 1,000 rows).
  const shownIds = useMemo(
    () => new Set(paneContent.designs.map((d) => d.id)),
    [paneContent.designs],
  );

  // A team you're not a member of 404s in TeamPane (it doesn't leak the
  // name). When that happens, drop the title/breadcrumb above it — there
  // is no team to name. Kept with the node it was found missing in, so a
  // real team's title is never suppressed by a stale 404 from the last one.
  const [notFoundIn, setNotFoundIn] = useState<typeof selected | null>(null);
  const teamNotFound = notFoundIn === selected;
  // Where each row lives (docs/specs/013-workspace/recent-folder-chip.md), on the views that list more than one place
  // (row-location.ts).
  const folderChipFor = useCallback(
    (d: PaneDesign): { label: string; onOpen: () => void } | null => {
      const where = rowLocation(d, {
        selected,
        lensActive: lensResult.active,
        folderById,
      });
      return where ? { label: where.label, onOpen: () => go(where.opens) } : null;
    },
    [selected, folderById, go, lensResult.active],
  );

  // The Tags page (docs/specs/013-workspace/tags.md): a tag's name as the title, New Tag, and the designs its tags
  // can sit on (the reader's own and their teams'), newest first.
  const tagsPage = useTagsPage(selected, go);
  const taggable = useMemo(
    () =>
      selected.kind === 'tags'
        ? [...liveDocs, ...teamDesigns].sort((a, b) => b.savedAt - a.savedAt)
        : [],
    [selected.kind, liveDocs, teamDesigns],
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
  // Which design's history dialog is open, if any (docs/specs/013-workspace/timeline.md §3.4).
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  // Home's Jump Back In cards carry each design's Explorer menu (docs/specs/013-workspace/explorer-home.md).
  const showHistory = useCallback((id: string, name: string) => setHistoryFor({ id, name }), []);
  const homeDesignMenus = useDesignEntryFor({ onShowHistory: showHistory });

  // Which of New design and New folder this section offers (pane-header-actions.ts).
  const offers = paneHeaderActions(selected.kind);
  const newDesign = offers.newDesign
    ? () => assignAppLocation(selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new')
    : undefined;

  // List, Card and Details take the SAME props (docs/specs/006-design/design-snapshots.md,
  // docs/specs/013-workspace/explorer-details-view.md), so build them once and pick the component by the toggle. The
  // Tags page draws each tag's designs with them too.
  const ViewComponent = VIEW_COMPONENTS[viewMode];
  const designViewProps = {
    ownerId,
    onOpenFolder: (id: string) => go({ kind: 'folder', id }),
    onCommitRenameFolder: commitRenameFolder,
    onCancelRenameFolder: () => setRenamingFolderId(null),
    renamingFolderId,
    renamingDesignId,
    onCommitRenameDesign: renameDesign,
    onCancelRenameDesign: () => setRenamingDesignId(null),
    folderActions,
    onStartRenameDesign: (id: string) => setRenamingDesignId(id),
    onDuplicateDesign: (id: string) => void duplicateDesign(id),
    onDeleteDesign: (id: string) => void deleteDesign(id),
    onMoveDesign: openMovePickerForDesign,
    onDismissShared: (id: string) => void dismissShared(id),
    recentExcludedIds: prefs.recentExcludedIds ?? [],
    onToggleRecentExclusion: toggleRecentExclusion,
    onShowHistory: (id: string) => {
      const row = paneContent.designs.find((d) => d.id === id) ?? taggable.find((d) => d.id === id);
      // Offline designs never reach the worker, so they have
      // no server history to show (docs/specs/006-design/offline-mode.md).
      if (row && !isOfflineIdSync(id)) setHistoryFor({ id, name: row.name });
    },
    favouriteIds,
    onToggleFavourite: toggleFavourite,
    folderChipFor,
    childrenCount: (id: string) => childrenByParent.get(id)?.length ?? 0,
    designsCount: (id: string) => designsByFolder.get(id)?.length ?? 0,
    // What each folder card previews (docs/specs/013-workspace/folder-content-previews.md) — the same
    // client-side indexes the counts come from, so no extra fetch.
    folderContents: (id: string) => ({
      folders: childrenByParent.get(id) ?? [],
      designs: designsByFolder.get(id) ?? [],
    }),
  };

  return (
    <>
      {tagsPage.dialog}
      {/* Home's hero is its page header (docs/specs/013-workspace/explorer-home.md "The hero"); with the banner
          hidden, Home takes the ordinary one. */}
      {selected.kind === 'home' && homeBannerShown(prefs) ? null : (
        <PaneHeader
          title={hideTeamTitle ? '' : (tagsPage.title ?? paneTitle)}
          crumbs={hideTeamTitle ? [] : (tagsPage.crumbs ?? paneCrumbs)}
          onOpenNav={() => setMobileNavOpen(true)}
          helpArticle={sectionHelp}
          headerActions={
            selected.kind === 'timeline' || tagsPage.headerActions ? (
              <>
                {selected.kind === 'timeline' ? (
                  <TimelineControls controls={timeline.controls} />
                ) : null}
                {tagsPage.headerActions}
              </>
            ) : undefined
          }
          viewMode={isBrowse ? viewMode : undefined}
          onSetViewMode={isBrowse ? setViewMode : undefined}
          onCreateDesign={newDesign}
          onCreateFolder={
            offers.newFolder
              ? () => void createFolder(selected.kind === 'folder' ? selected.id : null)
              : undefined
          }
          folderLabel={selected.kind === 'folder' ? 'New Subfolder' : 'New Folder'}
        />
      )}

      {/* A view the app gathers explains itself under the breadcrumb. */}
      <ViewInfo selected={selected} />
      {/* The lens's chips and live region (explorer-filters.md "The chip row"). */}
      {lens.view !== null ? (
        <PaneLensBar
          showIssues={!(lensResult.active && lensResult.shown === 0 && !lensResult.empty)}
        />
      ) : null}

      {/* Timeline runs ahead of the `loading` gate on purpose: that flag
          tracks the DESIGN lists, which this section doesn't read, and
          waiting on them would show design skeletons on the landing
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
            designMenus={homeDesignMenus}
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
        // Like the Timeline, ahead of the design-list `loading` gate: the
        // section reads its own feed (docs/specs/013-workspace/inbox.md §5).
        <ActivityPane feed={activity} />
      ) : loading ? (
        <SkeletonRows />
      ) : selected.kind === 'invites' ? (
        <InvitationsOnLiveworkspace />
      ) : selected.kind === 'team' ? (
        ownerId ? (
          <TeamPane
            ownerId={ownerId}
            teamId={selected.id}
            accountUserId={accountUserId ?? null}
            accountDisplayName={accountDisplayName}
            onLeftTeam={() => go({ kind: 'home' })}
            onLoadResult={(found) => setNotFoundIn(found ? null : selected)}
            // The shared-designs move picker offers every space (docs/specs/013-workspace/team-shared-designs.md):
            // the personal tree + each team, with `moveDesignTo` routing a
            // cross-scope pick from the design's current placement.
            moveDests={{ personalFolders: movePersonalFolders, teams: moveTeamDests }}
            onMoveDesignTo={moveDesignTo}
            // What the team page changes, the sidebar, search and every move picker show at once.
            onLibraryChange={refreshAfterTeamPage}
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
      ) : selected.kind === 'trash' ? (
        <TrashSection />
      ) : selected.kind === 'tags' ? (
        <TagsPane
          designs={taggable}
          tagId={selected.id}
          onOpenTag={tagsPage.openTag}
          onNewTag={tagsPage.newTag}
          renderDesigns={(designs) => (
            // A tag gathers personal and team designs, so whose each is varies (the Owner column).
            <ViewComponent {...designViewProps} folders={[]} designs={designs} showOwner />
          )}
        />
      ) : (selected.kind === 'shared' ? failedReads.shared : failedReads.designs) ? (
        // A failed read never reads as an empty account (explorer-filters.md "States").
        <LoadFailed onRetry={() => (ownerId ? void refreshPersonal(ownerId) : undefined)} />
      ) : lensResult.empty ? (
        <EmptyPane selected={selected} />
      ) : lensResult.active && lensResult.shown === 0 ? (
        <FilteredEmpty issues={lens.parsed.issues} onClear={() => lens.setInput('')} />
      ) : selected.kind === 'shared' ? (
        <SharedList
          shared={shared.filter((s) => shownIds.has(s.id))}
          ownerId={ownerId}
          onDismiss={(id) => void dismissShared(id)}
        />
      ) : (
        <ViewComponent
          {...designViewProps}
          folders={paneContent.folders}
          designs={paneContent.designs}
          // Owner column (desktop): the views that mix personal, team and shared rows
          // (docs/specs/013-workspace/team-shared-designs.md) are the ones where ownership varies.
          showOwner={selected.kind === 'recent' || selected.kind === 'search'}
        />
      )}

      {/* One design's own history (docs/specs/013-workspace/timeline.md §3.4), opened from a row's
          menu. Lives at the pane level rather than per row so only one
          is ever mounted. */}
      {ownerId ? (
        <DesignHistoryDialog
          open={historyFor !== null}
          onClose={() => setHistoryFor(null)}
          ownerId={ownerId}
          designId={historyFor?.id ?? null}
          designName={historyFor?.name ?? null}
        />
      ) : null}
    </>
  );
}
