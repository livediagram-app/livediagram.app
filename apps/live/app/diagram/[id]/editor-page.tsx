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

export default function LivePage() {
  const state = useEditorState();
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
            message="We couldn’t load this diagram — the server didn’t respond. Check your connection and try again."
          />
          <Explorer
            position={explorerPosition}
            diagrams={diagramList}
            folders={folders}
            loading={diagramListLoading}
            shared={sharedDiagrams}
            onDismissShared={dismissSharedDiagram}
            onOpenFullExplorer={() =>
              window.location.assign(`${window.location.origin}/live/explorer`)
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
              window.location.assign(`${window.location.origin}/live/explorer`)
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
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="Password required"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
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
