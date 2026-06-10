'use client';

import dynamic from 'next/dynamic';
import { setSessionSharePassword } from '@/lib/api-client';
import { EditorHeader } from '@/components/EditorHeader';
import { Explorer } from '@/components/Explorer';
import { DiagramLoading } from '@/components/DiagramLoading';
import { EditorContext } from './EditorContext';
import { EditorView } from './EditorView';
import { useEditorState } from './useEditorState';

const NotFound = dynamic(() => import('@/components/NotFound').then((m) => m.NotFound));
const ApiErrorPage = dynamic(() => import('@/components/ApiErrorPage').then((m) => m.ApiErrorPage));
const SharePasswordGate = dynamic(() =>
  import('@/components/SharePasswordGate').then((m) => m.SharePasswordGate),
);

// `embed` mounts the read-only embed view (spec/33): same state, same
// EditorView, with the chrome / identity / edit gates flipped by the
// flag. The /live/embed route passes it; the /diagram route doesn't.
export default function LivePage({ embed = false }: { embed?: boolean } = {}) {
  const state = useEditorState({ embed });
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

  // The load FAILED (network / 5xx) rather than 404'd. Retryable, so
  // show the error card (with the Explorer behind it for navigation)
  // instead of NotFound. Retry re-runs hydration via a full reload.
  if (loadError) {
    // Embed frames get the bare retry card: an app header + Explorer
    // panel inside someone else's page is noise (spec/33).
    if (embed) {
      return (
        <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">
          <ApiErrorPage
            onRetry={() => window.location.reload()}
            message="We couldn’t load this diagram: the server didn’t respond. Check your connection and try again."
          />
        </main>
      );
    }
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="Couldn’t load diagram"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <ApiErrorPage
            onRetry={() => window.location.reload()}
            message="We couldn’t load this diagram: the server didn’t respond. Check your connection and try again."
          />
          <Explorer
            position={explorerPosition}
            diagrams={diagramList}
            folders={folders}
            loading={diagramListLoading}
            shared={sharedDiagrams}
            onDismissShared={dismissSharedDiagram}
            onOpenFullExplorer={() =>
              window.location.assign(`${window.location.origin}/live/explorer/recent`)
            }
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
        </main>
      </div>
    );
  }

  if (diagramNotFound) {
    // Same bare-card rule as the embed loadError branch above; the
    // create-new escape opens the full app in a new tab rather than
    // navigating the host page's iframe.
    if (embed) {
      return (
        <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">
          <NotFound
            onCreateNew={() => {
              window.open(`${window.location.origin}/live/new`, '_blank', 'noopener');
            }}
          />
        </main>
      );
    }
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="Diagram not found"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <NotFound
            onCreateNew={() => {
              window.location.assign(`${window.location.origin}/live/new`);
            }}
          />
          <Explorer
            position={explorerPosition}
            diagrams={diagramList}
            folders={folders}
            loading={diagramListLoading}
            shared={sharedDiagrams}
            onDismissShared={dismissSharedDiagram}
            onOpenFullExplorer={() =>
              window.location.assign(`${window.location.origin}/live/explorer/recent`)
            }
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
        </main>
      </div>
    );
  }

  // Password gate (spec/24): a visitor opened a protected diagram's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request.
  if (sharePasswordGate) {
    // In an embed the gate renders inside the iframe, headerless
    // (spec/33): the host page provides the surrounding context.
    return (
      <div className="flex h-dvh flex-col">
        {embed ? null : (
          <EditorHeader
            diagramName="Password required"
            hideTitle
            showShare={false}
            shareable={false}
            onOpenShare={() => {}}
            onRename={() => {}}
          />
        )}
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
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
        </main>
      </div>
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
      <EditorView />
    </EditorContext.Provider>
  );
}
