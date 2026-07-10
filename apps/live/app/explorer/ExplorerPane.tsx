'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useExplorer } from './ExplorerContext';
import { NewTokenButton } from '@/components/panels/NewTokenButton';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import type { HelpArticleKey } from '@/lib/help-articles';
import { ListView, PaneHeader, SharedList, SkeletonRows } from './views';
import { CardView } from './CardView';
import { useExplorerViewMode } from './useExplorerViewMode';
import { EmptyPane } from './ExplorerEmptyState';
import { DynamicFolderInfo } from './DynamicFolderInfo';

// The browse sections that render a folders + diagrams grid the List/Card
// toggle (spec/67) can swap. Other sections (gallery, themes, tokens,
// profile, team, invites, shared) have their own fixed layout.
const BROWSE_KINDS = new Set(['recent', 'all', 'folder', 'unsorted', 'generated', 'offline']);

// Each Explorer section deep-links its matching help-centre article from a
// "?" button in the pane header (spec/56). Sections without a guide (team,
// invites) simply omit it.
const SECTION_HELP: Partial<
  Record<string, { article: HelpArticleKey; title: string; description: string }>
> = {
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
  const hideTeamTitle = selected.kind === 'team' && teamNotFound;
  const sectionHelp = SECTION_HELP[selected.kind];
  const [viewMode, setViewMode] = useExplorerViewMode();
  // The toggle only appears on the browse sections (the ones the
  // List/Card swap below applies to).
  const isBrowse = BROWSE_KINDS.has(selected.kind);

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
          selected.kind === 'tokens' && clerkUserId ? <NewTokenButton tokens={tokens} /> : undefined
        }
        viewMode={isBrowse ? viewMode : undefined}
        onSetViewMode={isBrowse ? setViewMode : undefined}
        onCreateDiagram={
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
          selected.kind === 'offline'
            ? undefined
            : () =>
                window.location.assign(
                  selected.kind === 'folder' ? `/new?folder=${selected.id}` : '/new',
                )
        }
        onCreateFolder={
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'themes' ||
          selected.kind === 'tokens' ||
          selected.kind === 'profile' ||
          selected.kind === 'team' ||
          selected.kind === 'invites' ||
          selected.kind === 'recent' ||
          selected.kind === 'generated' ||
          selected.kind === 'offline'
            ? undefined
            : () => createFolder(selected.kind === 'folder' ? selected.id : null)
        }
        folderLabel={selected.kind === 'folder' ? 'New subfolder' : 'New folder'}
      />

      {/* Dynamic (synthetic) folders explain themselves under the breadcrumb. */}
      <DynamicFolderInfo selected={selected} />

      {loading ? (
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
            onLeftTeam={() => go({ kind: 'recent' })}
            onLoadResult={(found) => setTeamNotFound(!found)}
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
        !paneContent.showUnsortedRow ? (
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
              showUnsortedRow={paneContent.showUnsortedRow}
              unsortedCount={unsortedDiagrams.length}
              onOpenUnsorted={() => go({ kind: 'unsorted' })}
              // Generated sits beside Unsorted on the My Work (/all) list.
              showGeneratedRow={selected.kind === 'all'}
              generatedCount={generatedDiagrams.length}
              onOpenGenerated={() => go({ kind: 'generated' })}
              // Offline sits beside Generated on the My Work (/all) list
              // (spec/76), always shown so the browser-only bucket is
              // discoverable.
              showOfflineRow={selected.kind === 'all'}
              offlineCount={offlineDiagrams.length}
              onOpenOffline={() => go({ kind: 'offline' })}
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
          );
        })()
      )}
    </>
  );
}
