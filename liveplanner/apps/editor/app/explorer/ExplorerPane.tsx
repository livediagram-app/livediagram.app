'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo } from 'react';
import { useExplorer } from './ExplorerContext';
import { useProjectEntryFor } from './useProjectEntryFor';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows, type PaneProject } from './views';
import { CardView } from './CardView';
import { DetailsView } from './details/DetailsView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { ViewInfo } from './ViewInfo';
import { PaneLensBar } from './lens/PaneLensBar';
import { FilteredEmpty, LoadFailed } from './lens/LensStates';
import { narrowRows } from './lens/pane-lens';
import { ProjectHistoryDialog } from '@/components/panels/ProjectHistoryDialog';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { explorerPathFor } from './routes';
import { rowLocation } from './row-location';
import { paneHeaderActions } from './pane-header-actions';
import { useTagsPage } from './tags/useTagsPage';
import { homeBannerShown } from '@/lib/home-banner';
import { assignAppLocation } from '@/lib/app-location';
// Evaluated with the eager Explorer chunk, so the load's own path is captured before any in-app navigation
// (entry-path.ts); Home's pane reads it lazily.
import './entry-path';

// The three layouts of a browse section, by the toggle.
const VIEW_COMPONENTS = { list: ListView, card: CardView, details: DetailsView } as const;

// The browse sections that render a folders + projects grid the List/Card
// toggle (docs/specs/006-project/project-snapshots.md) can swap. Other sections (themes,
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
  home: 'home',
  inbox: 'inbox',
  recent: 'recentProjects',
  shared: 'sharedWithYou',
  themes: 'customThemes',
  trash: 'trash',
  offline: 'offlineMode',
  folder: 'folders',
  all: 'folders',
  search: 'explorerFilters',
  tags: 'tags',
};

// Lazy-load the heavier panes — each is only mounted on its own
// route, so none of them sit in the shared explorer chunk.
const TrashSection = dynamic(() => import('./TrashSection').then((m) => m.TrashSection), {
  ssr: false,
});
const ThemesPane = dynamic(
  () => import('@/components/panels/ThemesPane').then((m) => m.ThemesPane),
  { ssr: false },
);
const TeamPane = dynamic(() => import('@/components/panels/TeamPane').then((m) => m.TeamPane), {
  ssr: false,
});
const TeamInvitesPane = dynamic(
  () => import('@/components/panels/TeamInvitesPane').then((m) => m.TeamInvitesPane),
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
    projects: liveDocs,
    teamProjects,
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
    projectsByFolder,
    setMobileNavOpen,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingProjectId,
    setRenamingProjectId,
    renameProject,
    deleteProject,
    duplicateProject,
    openMovePickerForProject,
    folderActions,
    shared,
    dismissShared,
    invites,
    acceptInvite,
    declineInvite,
    movePersonalFolders,
    moveTeamDests,
    moveProjectTo,
    timelineUnread,
    refreshAfterTeamPage,
  } = useExplorer();
  // The shared rows the pane's projects still show, by id: a scan of the projects per shared row was
  // quadratic, rerun on every keystroke in the lens (63 ms at 1,000 rows).
  const shownIds = useMemo(
    () => new Set(paneContent.projects.map((d) => d.id)),
    [paneContent.projects],
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
    (d: PaneProject): { label: string; onOpen: () => void } | null => {
      const where = rowLocation(d, {
        selected,
        lensActive: lensResult.active,
        folderById,
      });
      return where ? { label: where.label, onOpen: () => go(where.opens) } : null;
    },
    [selected, folderById, go, lensResult.active],
  );

  // The Tags page (docs/specs/013-workspace/tags.md): a tag's name as the title, New Tag, and the projects its tags
  // can sit on (the reader's own and their teams'), newest first.
  const tagsPage = useTagsPage(selected, go);
  const taggable = useMemo(
    () =>
      selected.kind === 'tags'
        ? [...liveDocs, ...teamProjects].sort((a, b) => b.savedAt - a.savedAt)
        : [],
    [selected.kind, liveDocs, teamProjects],
  );

  const hideTeamTitle = selected.kind === 'team' && teamNotFound;
  const sectionHelp = SECTION_HELP[selected.kind];
  const [viewMode, setViewMode] = useExplorerViewMode();
  // The toggle only appears on the browse sections (the ones the
  // List/Card swap below applies to).
  const isBrowse = BROWSE_KINDS.has(selected.kind);
  // Which project's history dialog is open, if any (docs/specs/013-workspace/timeline.md §3.4).
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  // Home's Jump Back In cards carry each project's Explorer menu (docs/specs/013-workspace/explorer-home.md).
  const showHistory = useCallback((id: string, name: string) => setHistoryFor({ id, name }), []);
  const homeProjectMenus = useProjectEntryFor({ onShowHistory: showHistory });

  // Which of New project and New folder this section offers (pane-header-actions.ts).
  const offers = paneHeaderActions(selected.kind);
  const newProject = offers.newProject
    ? () => assignAppLocation(selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new')
    : undefined;

  // List, Card and Details take the SAME props (docs/specs/006-project/project-snapshots.md,
  // docs/specs/013-workspace/explorer-details-view.md), so build them once and pick the component by the toggle. The
  // Tags page draws each tag's projects with them too.
  const ViewComponent = VIEW_COMPONENTS[viewMode];
  const projectViewProps = {
    ownerId,
    onOpenFolder: (id: string) => go({ kind: 'folder', id }),
    onCommitRenameFolder: commitRenameFolder,
    onCancelRenameFolder: () => setRenamingFolderId(null),
    renamingFolderId,
    renamingProjectId,
    onCommitRenameProject: renameProject,
    onCancelRenameProject: () => setRenamingProjectId(null),
    folderActions,
    onStartRenameProject: (id: string) => setRenamingProjectId(id),
    onDuplicateProject: (id: string) => void duplicateProject(id),
    onDeleteProject: (id: string) => void deleteProject(id),
    onMoveProject: openMovePickerForProject,
    onDismissShared: (id: string) => void dismissShared(id),
    recentExcludedIds: prefs.recentExcludedIds ?? [],
    onToggleRecentExclusion: toggleRecentExclusion,
    onShowHistory: (id: string) => {
      const row =
        paneContent.projects.find((d) => d.id === id) ?? taggable.find((d) => d.id === id);
      // Offline projects never reach the worker, so they have
      // no server history to show (docs/specs/006-project/offline-mode.md).
      if (row && !isOfflineIdSync(id)) setHistoryFor({ id, name: row.name });
    },
    favouriteIds,
    onToggleFavourite: toggleFavourite,
    folderChipFor,
    childrenCount: (id: string) => childrenByParent.get(id)?.length ?? 0,
    projectsCount: (id: string) => projectsByFolder.get(id)?.length ?? 0,
    // What each folder card previews (docs/specs/013-workspace/folder-content-previews.md) — the same
    // client-side indexes the counts come from, so no extra fetch.
    folderContents: (id: string) => ({
      folders: childrenByParent.get(id) ?? [],
      projects: projectsByFolder.get(id) ?? [],
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
          headerActions={tagsPage.headerActions}
          viewMode={isBrowse ? viewMode : undefined}
          onSetViewMode={isBrowse ? setViewMode : undefined}
          onCreateProject={newProject}
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

      {/* Home runs ahead of the `loading` gate on purpose: that flag tracks the PROJECT lists, which Home doesn't
          read, and waiting on them would show project skeletons on the landing page before Home's own. */}
      {selected.kind === 'home' ? (
        ownerId ? (
          <HomePane
            ownerId={ownerId}
            onSeen={timelineUnread.clear}
            recentHref={explorerPathFor({ kind: 'recent' })}
            onSeeMore={() => go({ kind: 'recent' })}
            projectMenus={homeProjectMenus}
          />
        ) : null
      ) : selected.kind === 'inbox' ? (
        // Like Home, ahead of the project-list `loading` gate: the
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
            accountUserId={accountUserId ?? null}
            accountDisplayName={accountDisplayName}
            onLeftTeam={() => go({ kind: 'home' })}
            onLoadResult={(found) => setNotFoundIn(found ? null : selected)}
            // The shared-projects move picker offers every space (docs/specs/013-workspace/team-shared-projects.md):
            // the personal tree + each team, with `moveProjectTo` routing a
            // cross-scope pick from the project's current placement.
            moveDests={{ personalFolders: movePersonalFolders, teams: moveTeamDests }}
            onMoveProjectTo={moveProjectTo}
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
      ) : selected.kind === 'themes' ? (
        <ThemesPane />
      ) : selected.kind === 'trash' ? (
        <TrashSection />
      ) : selected.kind === 'tags' ? (
        <TagsPane
          projects={taggable}
          tagId={selected.id}
          onOpenTag={tagsPage.openTag}
          onNewTag={tagsPage.newTag}
          renderProjects={(projects) => (
            // A tag gathers personal and team projects, so whose each is varies (the Owner column).
            <ViewComponent {...projectViewProps} folders={[]} projects={projects} showOwner />
          )}
        />
      ) : (selected.kind === 'shared' ? failedReads.shared : failedReads.projects) ? (
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
          {...projectViewProps}
          folders={paneContent.folders}
          projects={paneContent.projects}
          // Owner column (desktop): the views that mix personal, team and shared rows
          // (docs/specs/013-workspace/team-shared-projects.md) are the ones where ownership varies.
          showOwner={selected.kind === 'recent' || selected.kind === 'search'}
        />
      )}

      {/* One project's own history (docs/specs/013-workspace/timeline.md §3.4), opened from a row's
          menu. Lives at the pane level rather than per row so only one
          is ever mounted. */}
      {ownerId ? (
        <ProjectHistoryDialog
          open={historyFor !== null}
          onClose={() => setHistoryFor(null)}
          ownerId={ownerId}
          projectId={historyFor?.id ?? null}
          projectName={historyFor?.name ?? null}
        />
      ) : null}
    </>
  );
}
