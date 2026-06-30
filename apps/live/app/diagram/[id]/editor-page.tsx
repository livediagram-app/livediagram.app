'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';
import { setSessionSharePassword } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { Explorer } from '@/components/panels/Explorer';
import { DiagramLoading } from '@/components/chrome/DiagramLoading';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { EditorContext } from './EditorContext';
import { EditorView } from './EditorView';
import { useEditorState } from './useEditorState';

const NotFound = dynamic(() => import('@/components/chrome/NotFound').then((m) => m.NotFound));
const ApiErrorPage = dynamic(() =>
  import('@/components/chrome/ApiErrorPage').then((m) => m.ApiErrorPage),
);
const SharePasswordGate = dynamic(() =>
  import('@/components/dialogs/SharePasswordGate').then((m) => m.SharePasswordGate),
);

const LOAD_ERROR_MESSAGE =
  'We couldn’t load this diagram: the server didn’t respond. Check your connection and try again.';

// `embed` mounts the read-only embed view (spec/33): same state, same
// EditorView, with the chrome / identity / edit gates flipped by the
// flag. The /live/embed route passes it; the /diagram route doesn't.
export default function LivePage({ embed = false }: { embed?: boolean } = {}) {
  const state = useEditorState({ embed });
  // Anonymous telemetry (spec/22): one emit per rendered embed iframe
  // document. Fires once on mount; the /diagram route never sets `embed`.
  useEffect(() => {
    if (embed) track('Session', 'Opened', 'Embed');
  }, [embed]);
  // Tab title reflects the diagram: "<name> | livediagram" (falls back to
  // Untitled when the diagram has no name yet). Updates as the user renames.
  useEffect(() => {
    const name = state.diagramName?.trim();
    document.title = `${name || 'Untitled diagram'} | livediagram`;
  }, [state.diagramName]);
  const {
    diagramNotFound,
    loadError,
    sharePasswordGate,
    loadingDiagram,
    explorerPosition,
    diagramList,
    folders,
    diagramListLoading,
    sharedDiagrams,
    dismissSharedDiagram,
    openDiagram,
    newDiagram,
    deleteDiagram,
    duplicateDiagram,
    createFolder,
    renameFolder,
    deleteFolder,
    moveDiagramToFolder,
    setExplorerPosition,
    diagramOwnerName,
    setSharePasswordGate,
    setLoadingDiagram,
    setPasswordRetry,
  } = state;

  // The full Explorer panel that sits behind the error / not-found status
  // screens (identical in both), built once from state. Just a React
  // element until a branch returns it, so building it on every render is
  // free when no status screen shows.
  const fullExplorer = (
    <Explorer
      position={explorerPosition}
      diagrams={diagramList}
      ownerId={state.selfParticipant?.id ?? null}
      folders={folders}
      loading={diagramListLoading}
      shared={sharedDiagrams}
      onDismissShared={dismissSharedDiagram}
      currentDiagramId={null}
      onMoveTo={(x, y) => setExplorerPosition({ x, y })}
      onReset={() => setExplorerPosition(null)}
      onOpenDiagram={openDiagram}
      onNewDiagram={newDiagram}
      onDeleteDiagram={deleteDiagram}
      onDuplicateDiagram={(id) => void duplicateDiagram(id)}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveDiagramToFolder={moveDiagramToFolder}
    />
  );

  // The load FAILED (network / 5xx) rather than 404'd. Retryable, so
  // show the error card (with the Explorer behind it for navigation)
  // instead of NotFound. Retry re-runs hydration via a full reload.
  if (loadError) {
    const card = (
      <ApiErrorPage onRetry={() => window.location.reload()} message={LOAD_ERROR_MESSAGE} />
    );
    // Embed frames get the bare retry card: an app header + Explorer
    // panel inside someone else's page is noise (spec/33).
    return embed ? (
      <EmbedShell>{card}</EmbedShell>
    ) : (
      <StatusShell title="Couldn’t load diagram" explorer={fullExplorer}>
        {card}
      </StatusShell>
    );
  }

  if (diagramNotFound) {
    // The create-new escape opens the full app in a new tab from an embed
    // (rather than navigating the host page's iframe), in place otherwise.
    return embed ? (
      <EmbedShell>
        <NotFound
          onCreateNew={() => window.open(`${window.location.origin}/new`, '_blank', 'noopener')}
        />
      </EmbedShell>
    ) : (
      <StatusShell title="Diagram not found" explorer={fullExplorer}>
        <NotFound onCreateNew={() => window.location.assign(`${window.location.origin}/new`)} />
      </StatusShell>
    );
  }

  // Password gate (spec/24): a visitor opened a protected diagram's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request. In an
  // embed the gate renders headerless inside the iframe (spec/33).
  if (sharePasswordGate) {
    return (
      <StatusShell title="Password required" showHeader={!embed}>
        <SharePasswordGate
          invalid={sharePasswordGate.invalid}
          ownerName={diagramOwnerName}
          onSubmit={(pw) => {
            setSharePasswordGate(null);
            setSessionSharePassword(pw);
            setLoadingDiagram(true);
            setPasswordRetry((n) => n + 1);
          }}
        />
      </StatusShell>
    );
  }

  if (loadingDiagram) {
    return (
      <div className="flex h-dvh flex-col">
        <DiagramLoading />
      </div>
    );
  }

  return (
    <EditorContext.Provider value={state}>
      {/* Owner-scoped custom themes (spec/44): keyed by the current
          user's id (Clerk or guest self id) so the theme picker /
          builder share one source of truth and getTheme resolves saved
          themes referenced by this diagram's tabs. */}
      <CustomThemeProvider
        ownerId={state.selfParticipant?.id ?? null}
        onThemeDeleted={state.resetTabsUsingTheme}
      >
        <EditorView />
      </CustomThemeProvider>
    </EditorContext.Provider>
  );
}

// Full-height status chrome (error / not-found / password gate): the
// editor header (title-only, every action disabled) over a slate surface
// that holds the status card and, optionally, the Explorer for
// navigation. Shared by the status branches so the header + main wrapper
// (and the Explorer behind it) isn't repeated per branch.
function StatusShell({
  title,
  showHeader = true,
  explorer,
  children,
}: {
  title: string;
  showHeader?: boolean;
  explorer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      {showHeader ? (
        <EditorHeader
          diagramName={title}
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
      ) : null}
      <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
        {children}
        {explorer}
      </main>
    </div>
  );
}

// The bare embed status surface (spec/33): no header, no Explorer — an
// app header + Explorer inside someone else's iframe would be noise.
function EmbedShell({ children }: { children: ReactNode }) {
  return <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">{children}</main>;
}
