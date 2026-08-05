'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { useExplorer } from './ExplorerContext';
import { NewTokenButton } from '@/components/panels/NewTokenButton';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows, type PaneDiagram } from './views';
import { CardView } from './CardView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { DynamicFolderInfo } from './DynamicFolderInfo';
import { TimelineControls } from '@livediagram/ui';
import { DiagramHistoryDialog } from '@/components/panels/DiagramHistoryDialog';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useTimelineFeed } from './useTimelineFeed';

// The browse sections that render a folders + diagrams grid the List/Card
// toggle (spec/67) can swap. Other sections (gallery, themes, tokens,
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
// "?" button in the pane header (spec/56). Sections without a guide (team,
// invites) simply omit it.
const SECTION_HELP: Partial<
  Record<string, { article: HelpArticleKey; title: string; description: string }>
> = {
  timeline: {
    article: 'timeline',
    title: 'Timeline',
    description: 'Everything that has happened across your diagrams, teams and account.',
  },
  recent: {
    article: 'recentDiagrams',
    title: 'Recent',
    description: 'Your most recently opened diagrams, personal and team, in one list.',
  },
  shared: {
    article: 'sharedWithYou',
    title: 'Shared with you',
    description: 'Diagrams other people have shared with you, collected here.',
  },
  gallery: {
    article: 'imageGallery',
    title: 'Image gallery',
    description: 'How uploaded images are stored and reused across diagrams.',
  },
  themes: {
    article: 'customThemes',
    title: 'Custom themes',
    description: 'Build your own palette and reuse it across diagrams.',
  },
  tokens: {
    article: 'apiTokens',
    title: 'API tokens',
    description: 'Create tokens to call the livediagram API from your own scripts.',
  },
  unsorted: {
    article: 'unsorted',
    title: 'The Unsorted folder',
    description: 'Where diagrams live until you file them into a folder.',
  },
  offline: {
    article: 'offlineMode',
    title: 'Offline Mode',
    description: 'Diagrams saved only in this browser, and how to sync them.',
  },
  folder: {
    article: 'folders',
    title: 'Folders',
    description: 'Organise diagrams into a nestable tree of folders.',
  },
  all: {
    article: 'folders',
    title: 'Folders',
    description: 'Organise diagrams into a nestable tree of folders.',
  },
};

// Lazy-load the heavier panes — each is only mounted on its own
// route, so none of them sit in the shared explorer chunk.
const GalleryPane = dynamic(() =>
  import('@/components/panels/GalleryPane').then((m) => m.GalleryPane),
);
const TokensPane = dynamic(() =>
  import('@/components/panels/TokensPane').then((m) => m.TokensPane),
);
const ThemesPane = dynamic(() =>
  import('@/components/panels/ThemesPane').then((m) => m.ThemesPane),
);
const TeamPane = dynamic(() => import('@/components/panels/TeamPane').then((m) => m.TeamPane));
const TeamInvitesPane = dynamic(() =>
  import('@/components/panels/TeamInvitesPane').then((m) => m.TeamInvitesPane),
);
const ProfilePane = dynamic(() =>
  import('@/components/panels/ProfilePane').then((m) => m.ProfilePane),
);
// The Timeline is the landing route, so it's the one lazy pane most
// visitors DO load. Split anyway: the calendar grid + filter popover
// are only reached by someone who switches modes, and holding them out
// of the shared explorer chunk keeps the other sections' first paint
// unaffected by a feature they don't use.
const TimelinePane = dynamic(() =>
  import('@/components/panels/TimelinePane').then((m) => m.TimelinePane),
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
    clerkUserId,
    clerkDisplayName,
    tokens,
    paneTitle,
    paneCrumbs,
    paneContent,
    unsortedDiagrams,
    generatedDiagrams,
    offlineDiagrams,
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
    movePersonalFolders,
    moveTeamDests,
    moveDiagramTo,
  } = useExplorer();
  const { signInHref } = useAuthHrefs();

  // A team you're not a member of 404s in TeamPane (it doesn't leak the
  // name). When that happens, drop the title/breadcrumb above it — there
  // is no team to name. Reset on every navigation so a real team's title
  // isn't suppressed by a stale 404 from the last one.
  const [teamNotFound, setTeamNotFound] = useState(false);
  useEffect(() => {
    setTeamNotFound(false);
  }, [selected]);
  // Where each Recent row lives (spec/94). Recent is the only pane that
  // spans folders — every other one IS a folder, so a chip there would just
  // repeat the pane's own title.
  //
  // Rows shared WITH you carry no folderId at all (they live in the sharer's
  // library, not yours), so they get no chip rather than a misleading one.
  const folderChipFor = useCallback(
    (d: PaneDiagram): { label: string; onOpen: () => void } | null => {
      // Recent AND Favourites both aggregate across folders, so both need
      // to say where a row actually lives (spec/94, spec/95). Every other
      // pane IS a folder, where the chip would just repeat its title.
      const aggregates = selected.kind === 'recent' || selected.kind === 'favourites';
      if (!aggregates || d.shared) return null;
      // A team diagram's folder belongs to the team's library, so the chip
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
  // Which diagram's history dialog is open, if any (spec/138 §3.4).
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <PaneHeader
        title={hideTeamTitle ? '' : paneTitle}
        crumbs={hideTeamTitle ? [] : paneCrumbs}
        onOpenNav={() => setMobileNavOpen(true)}
        helpArticle={sectionHelp?.article}
        helpTitle={sectionHelp?.title}
        helpDescription={sectionHelp?.description}
        headerActions={
          selected.kind === 'timeline' ? (
            <TimelineControls controls={timeline.controls} />
          ) : selected.kind === 'tokens' && clerkUserId ? (
            <NewTokenButton tokens={tokens} />
          ) : undefined
        }
        viewMode={isBrowse ? viewMode : undefined}
        onSetViewMode={isBrowse ? setViewMode : undefined}
        onCreateDiagram={
          // Timeline gets one too. A feed is a record of what happened rather
          // than a container you add to, so this started out omitted and left
          // to the empty state's CTA — but the empty state is exactly what a
          // returning user never sees, and Timeline is now the Explorer
          // landing page (spec/138 §8.1). That made "start a new diagram" a
          // dead end on the first screen of the app.
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'themes' ||
          selected.kind === 'tokens' ||
          selected.kind === 'profile' ||
          selected.kind === 'team' ||
          selected.kind === 'invites' ||
          // Generated / Offline are read-through dynamic views, not places
          // you hand-author into (offline diagrams are created from the /new
          // wizard's Settings toggle).
          selected.kind === 'generated' ||
          selected.kind === 'offline' ||
          selected.kind === 'dynamic'
            ? undefined
            : () =>
                window.location.assign(
                  selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new',
                )
        }
        onCreateFolder={
          selected.kind === 'timeline' ||
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'themes' ||
          selected.kind === 'tokens' ||
          selected.kind === 'profile' ||
          selected.kind === 'team' ||
          selected.kind === 'invites' ||
          selected.kind === 'recent' ||
          selected.kind === 'generated' ||
          selected.kind === 'offline' ||
          selected.kind === 'dynamic'
            ? undefined
            : () => createFolder(selected.kind === 'folder' ? selected.id : null)
        }
        folderLabel={selected.kind === 'folder' ? 'New subfolder' : 'New folder'}
      />

      {/* Dynamic (synthetic) folders explain themselves under the breadcrumb. */}
      <DynamicFolderInfo selected={selected} />

      {/* Timeline runs ahead of the `loading` gate on purpose: that flag
          tracks the DIAGRAM lists, which this section doesn't read, and
          waiting on them would show diagram skeletons on the landing
          page before the feed's own skeleton. */}
      {selected.kind === 'timeline' ? (
        ownerId ? (
          <TimelinePane feed={timeline} ownerId={ownerId} />
        ) : null
      ) : loading ? (
        <SkeletonRows />
      ) : selected.kind === 'profile' ? (
        <ProfilePane />
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
            onLeftTeam={() => go({ kind: 'timeline' })}
            onLoadResult={(found) => setTeamNotFound(!found)}
            // The shared-diagrams move picker offers every space (spec/35):
            // the personal tree + each team, with `moveDiagramTo` routing a
            // cross-scope pick from the diagram's current placement.
            moveDests={{ personalFolders: movePersonalFolders, teams: moveTeamDests }}
            onMoveDiagramTo={moveDiagramTo}
          />
        ) : null
      ) : selected.kind === 'gallery' ? (
        ownerId ? (
          <GalleryPane ownerId={ownerId} />
        ) : null
      ) : selected.kind === 'themes' ? (
        <ThemesPane />
      ) : selected.kind === 'tokens' ? (
        // Signed-in only (spec/61). Reached via the sidebar only when signed
        // in, but a guest could deep-link /explorer/tokens — show a sign-in
        // prompt rather than a TokensPane that would just 403.
        clerkUserId ? (
          <TokensPane tokens={tokens.list} error={tokens.error} onRevoke={tokens.revoke} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Sign in to use API tokens
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              API tokens are an account feature for calling the API from your own scripts.
            </p>
            <a
              href={signInHref}
              className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
            >
              Sign in
            </a>
          </div>
        )
      ) : selected.kind === 'shared' ? (
        <SharedList shared={shared} ownerId={ownerId} onDismiss={dismissShared} />
      ) : paneContent.folders.length === 0 &&
        paneContent.diagrams.length === 0 &&
        !paneContent.showUnsortedRow &&
        // All + Dynamic always lead with synthetic rows, so they're never
        // "empty" even with zero folders and diagrams.
        selected.kind !== 'all' &&
        selected.kind !== 'dynamic' ? (
        <EmptyPane selected={selected} />
      ) : (
        (() => {
          // List and Card take the SAME props (spec/67), so build them
          // once and pick the component by the toggle.
          const ViewComponent = viewMode === 'card' ? CardView : ListView;
          return (
            <ViewComponent
              folders={paneContent.folders}
              diagrams={paneContent.diagrams}
              ownerId={ownerId}
              // The three synthetic folders live inside the Dynamic parent
              // view; My Work (/all) leads with the single Dynamic row.
              showUnsortedRow={selected.kind === 'dynamic'}
              unsortedCount={unsortedDiagrams.length}
              onOpenUnsorted={() => go({ kind: 'unsorted' })}
              showGeneratedRow={selected.kind === 'dynamic'}
              generatedCount={generatedDiagrams.length}
              onOpenGenerated={() => go({ kind: 'generated' })}
              showOfflineRow={selected.kind === 'dynamic'}
              offlineCount={offlineDiagrams.length}
              onOpenOffline={() => go({ kind: 'offline' })}
              showDynamicRow={selected.kind === 'all'}
              dynamicCount={
                unsortedDiagrams.length + generatedDiagrams.length + offlineDiagrams.length
              }
              onOpenDynamic={() => go({ kind: 'dynamic' })}
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
              recentExcludedIds={prefs.recentExcludedIds ?? []}
              onToggleRecentExclusion={toggleRecentExclusion}
              onShowHistory={(id) => {
                const row = paneContent.diagrams.find((d) => d.id === id);
                // Offline diagrams never reach the worker, so they have
                // no server history to show (spec/76).
                if (row && !isOfflineIdSync(id)) setHistoryFor({ id, name: row.name });
              }}
              favouriteIds={favouriteIds}
              onToggleFavourite={toggleFavourite}
              folderChipFor={folderChipFor}
              childrenCount={(id) => childrenByParent.get(id)?.length ?? 0}
              diagramsCount={(id) => diagramsByFolder.get(id)?.length ?? 0}
              // What each folder card previews (spec/99) — the same
              // client-side indexes the counts come from, so no extra fetch.
              folderContents={(id) => ({
                folders: childrenByParent.get(id) ?? [],
                diagrams: diagramsByFolder.get(id) ?? [],
              })}
              // Owner column (desktop): Recent mixes personal + team rows
              // (spec/35), so it's the one list where ownership varies.
              showOwner={selected.kind === 'recent'}
            />
          );
        })()
      )}

      {/* One diagram's own history (spec/138 §3.4), opened from a row's
          menu. Lives at the pane level rather than per row so only one
          is ever mounted. */}
      {ownerId ? (
        <DiagramHistoryDialog
          open={historyFor !== null}
          onClose={() => setHistoryFor(null)}
          ownerId={ownerId}
          diagramId={historyFor?.id ?? null}
          diagramName={historyFor?.name ?? null}
        />
      ) : null}
    </>
  );
}
