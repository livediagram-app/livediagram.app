'use client';

import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';
import { setSessionSharePassword } from '@/lib/api-client';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { track } from '@/lib/telemetry';
import { requestDriveFlush } from '@/lib/drive/tab-election';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { Explorer } from '@/components/panels/Explorer';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
// Static, unlike the other status cards: it must render offline (docs/specs/007-editor/load-recovery.md
// "Offline"); its recovery tools are the lazy part.
import { LoadErrorCard } from '@/components/chrome/LoadErrorCard';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { ShapeLibraryProvider } from '@/components/primitives/ShapeLibraryProvider';
import { EditorContext } from './EditorContext';
import { EditorView } from './EditorView';
import { useEditorState } from './useEditorState';
import { surfaceFlags, type EditorSurface } from './editor-surface';
import { MentionContext } from '@/components/canvas/collab/comment/MentionContext';

const NotFound = dynamic(() => import('@/components/chrome/NotFound').then((m) => m.NotFound), {
  ssr: false,
});

const DocumentTrashedCard = dynamic(
  () => import('@/components/chrome/DocumentTrashedCard').then((m) => m.DocumentTrashedCard),
  { ssr: false },
);
const SharePasswordGate = dynamic(
  () => import('@/components/dialogs/SharePasswordGate').then((m) => m.SharePasswordGate),
  { ssr: false },
);

// `surface` says where the editor runs (editor-surface.ts): the app (/document), the read-only embed
// view (/embed, docs/specs/013-workspace/embeds.md), or a workbench's frame (/embed/workbench,
// docs/specs/013-workspace/workbench-embeds.md). Same state, same EditorView, with the chrome /
// identity / edit gates flipped by it.
export default function LivePage({ surface = 'app' }: { surface?: EditorSurface } = {}) {
  const state = useEditorState({ surface });
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): one emit per rendered embed iframe
  // document, and one per workbench frame that mounts the editor. Fires once on mount.
  useEffect(() => {
    if (surface === 'embed') track('Session', 'Opened', 'Embed');
    if (surface === 'workbench') track('Session', 'Opened', 'Workbench');
  }, [surface]);
  // Prefetch the async icon-catalogue chunk (~60 kB of glyph data kept out of
  // the first-load JS, see lib/icon-registry.ts) as soon as the editor
  // mounts, so it downloads in parallel with the document fetch / hydration.
  // By the time a document's icons render — or the user opens the Icons /
  // Technology palette tab — the data is almost always already in, keeping
  // the placeholder window to a first-paint blink at worst. Fire-and-forget:
  // ensureIconCatalogs never rejects (a failure logs and retries on the next
  // consumer mount), and every icon surface still self-loads via
  // useIconCatalogs, so this is purely a head start.
  useEffect(() => {
    void ensureIconCatalogs();
  }, []);
  // Leaving a document (another document, the Explorer) flushes its pending
  // Google Drive write (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence").
  useEffect(() => {
    if (!state.documentId) return;
    return () => requestDriveFlush();
  }, [state.documentId]);
  // Tab title reflects the document: "<name> | livediagram" (falls back to
  // Untitled when the document has no name yet). Updates as the user renames.
  useEffect(() => {
    const name = state.documentName?.trim();
    document.title = `${name || 'Untitled document'} | livediagram`;
  }, [state.documentName]);
  const {
    documentNotFound,
    loadError,
    sharePasswordGate,
    loadingDocument,
    explorerPosition,
    documentList,
    folders,
    documentListLoading,
    sharedDocuments,
    dismissSharedDocument,
    openDocument,
    newDocument,
    deleteDocument,
    duplicateDocument,
    createFolder,
    renameFolder,
    deleteFolder,
    moveDocumentToFolder,
    setExplorerPosition,
    documentOwnerName,
    setSharePasswordGate,
    setLoadingDocument,
    setPasswordRetry,
  } = state;
  // The full Explorer panel that sits behind the error / not-found status
  // screens (identical in both), built once from state. Just a React
  // element until a branch returns it, so building it on every render is
  // free when no status screen shows.
  const fullExplorer = (
    <Explorer
      recentExcludedIds={state.userPreferences?.recentExcludedIds ?? []}
      onToggleRecentExclusion={state.toggleRecentExclusion}
      favouriteIds={state.favouriteIds ?? new Set()}
      onToggleFavourite={state.toggleFavourite}
      position={explorerPosition}
      documents={documentList}
      ownerId={state.selfParticipant?.id ?? null}
      folders={folders}
      loading={documentListLoading}
      shared={sharedDocuments}
      onDismissShared={dismissSharedDocument}
      currentDocumentId={null}
      onMoveTo={(x, y) => setExplorerPosition({ x, y })}
      onReset={() => setExplorerPosition(null)}
      onOpenDocument={openDocument}
      onNewDocument={newDocument}
      onDeleteDocument={deleteDocument}
      onDuplicateDocument={(id) => void duplicateDocument(id)}
      onCreateFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveDocumentToFolder={moveDocumentToFolder}
    />
  );

  // The document is in the Trash (docs/specs/013-workspace/trash.md): from the
  // load, the room, or a refused save. Ahead of every other status because it
  // can arrive mid-session, over an editor that loaded fine.
  if (state.documentTrashed.trashed) {
    // A workbench cannot restore: Restore is an ownership power outside its session.
    const card = (
      <DocumentTrashedCard
        restorable={workbenchMode ? null : state.documentTrashed.restorable}
        onRestore={state.documentTrashed.restore}
      />
    );
    return !appChrome ? (
      <EmbedShell>{card}</EmbedShell>
    ) : (
      <StatusShell title="Document deleted" explorer={fullExplorer}>
        {card}
      </StatusShell>
    );
  }

  // The load FAILED (network / 5xx) rather than 404'd. Retryable, so
  // show the error card (with the Explorer behind it for navigation)
  // instead of NotFound. Retry re-runs hydration via a full reload.
  if (loadError) {
    const card = (
      <LoadErrorCard
        embed={!appChrome}
        ownerId={state.selfParticipant?.id === 'self' ? null : (state.selfParticipant?.id ?? null)}
      />
    );
    // Embed and workbench frames get the bare retry card: an app header + Explorer
    // panel inside someone else's page is noise (docs/specs/013-workspace/embeds.md).
    return !appChrome ? (
      <EmbedShell>{card}</EmbedShell>
    ) : (
      <StatusShell title="Couldn’t load document" explorer={fullExplorer}>
        {card}
      </StatusShell>
    );
  }

  if (documentNotFound) {
    // The create-new escape opens the full app in a new tab from a frame
    // (rather than navigating the host page's iframe), in place otherwise.
    return !appChrome ? (
      <EmbedShell>
        <NotFound
          onCreateNew={() => window.open(`${window.location.origin}/new`, '_blank', 'noopener')}
        />
      </EmbedShell>
    ) : (
      <StatusShell title="Document not found" explorer={fullExplorer}>
        <NotFound onCreateNew={() => window.location.assign(`${window.location.origin}/new`)} />
      </StatusShell>
    );
  }

  // Password gate (docs/specs/013-workspace/share-password.md): a visitor opened a protected document's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request. In an
  // embed the gate renders headerless inside the iframe (docs/specs/013-workspace/embeds.md).
  if (sharePasswordGate) {
    return (
      <StatusShell title="Password required" showHeader={!embedMode}>
        <SharePasswordGate
          invalid={sharePasswordGate.invalid}
          ownerName={documentOwnerName}
          onSubmit={(pw) => {
            setSharePasswordGate(null);
            setSessionSharePassword(pw);
            setLoadingDocument(true);
            setPasswordRetry((n) => n + 1);
          }}
        />
      </StatusShell>
    );
  }

  if (loadingDocument) {
    // Arriving from the hero's launch window, the load holds the quiet blank canvas /new showed.
    return <OpeningScreen />;
  }

  return (
    <EditorContext.Provider value={state}>
      {/* Owner-scoped custom themes (docs/specs/011-theme/custom-themes.md): keyed by the current
          user's id (Clerk or guest self id) so the theme picker /
          builder share one source of truth and getTheme resolves saved
          themes referenced by this document's tabs. */}
      <CustomThemeProvider
        ownerId={state.selfParticipant?.id ?? null}
        readOnly={workbenchMode}
        onThemeDeleted={state.resetTabsUsingTheme}
      >
        {/* Who the comment composers can @-mention (docs/specs/012-collaboration/comment-mentions.md). */}
        <MentionContext.Provider value={state.commentMentions}>
          {/* The owner's shape libraries, for the palette's My shapes
              (docs/specs/013-workspace/shape-libraries.md). */}
          <ShapeLibraryProvider ownerId={state.selfParticipant?.id ?? null}>
            <EditorView />
          </ShapeLibraryProvider>
        </MentionContext.Provider>
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
          documentName={title}
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

// The bare embed status surface (docs/specs/013-workspace/embeds.md): no header, no Explorer — an
// app header + Explorer inside someone else's iframe would be noise.
function EmbedShell({ children }: { children: ReactNode }) {
  return <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">{children}</main>;
}
