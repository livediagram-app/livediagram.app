'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useExplorer } from './ExplorerContext';
import { NewTokenButton } from '@/components/panels/NewTokenButton';
import type { HelpArticleKey } from '@/lib/help-articles';
import { EmptyPane, ListView, PaneHeader, SharedList, SkeletonRows } from './views';

// Each Explorer section deep-links its matching help-centre article from a
// "?" button in the pane header (spec/56). Sections without a guide (team,
// invites) simply omit it.
const SECTION_HELP: Partial<
  Record<string, { article: HelpArticleKey; title: string; description: string }>
> = {
  recent: {
    article: 'recentDiagrams',
    title: 'Recent diagrams',
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
        onCreateDiagram={
          selected.kind === 'shared' ||
          selected.kind === 'gallery' ||
          selected.kind === 'themes' ||
          selected.kind === 'tokens' ||
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
          selected.kind === 'themes' ||
          selected.kind === 'tokens' ||
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
            <p className="mt-1 text-xs text-slate-400">
              API tokens are an account feature for calling the API from your own scripts.
            </p>
            <a
              href="/sign-in/"
              className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
            >
              Sign in
            </a>
          </div>
        )
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
