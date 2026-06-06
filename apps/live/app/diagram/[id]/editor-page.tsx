import dynamic from 'next/dynamic';
import { setSessionSharePassword } from '@/lib/api-client';
import { EditorHeader } from '@/components/EditorHeader';
import { Explorer } from '@/components/Explorer';
import { DiagramLoading } from '@/components/DiagramLoading';
import { EditorContext } from './EditorContext';
import { EditorView } from './EditorView';
import { useEditorState } from './useEditorState';

const NotFound = dynamic(() => import('@/components/NotFound').then((m) => m.NotFound));
const SharePasswordGate = dynamic(() =>
  import('@/components/SharePasswordGate').then((m) => m.SharePasswordGate),
);

export default function LivePage() {
  const state = useEditorState();
  const {
    diagramNotFound,
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
