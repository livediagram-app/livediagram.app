'use client';

// The open connected tab's page, in the canvas's place (liveworkspace/docs/specs/004-index/connected-tabs.md "How it
// looks"): the shared ConnectedTabPage, loaded the first time a connected tab is opened, never with the editor.
import dynamic from 'next/dynamic';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';

const ConnectedTabPage = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectedTabPage').then(
      (m) => m.ConnectedTabPage,
    ),
  { ssr: false, loading: () => <div className="min-h-0 flex-1 bg-slate-50 dark:bg-slate-950" /> },
);

export function ConnectedTabHost() {
  const { activeTab, connectedTabs, isStructureReadOnly, renameTab, deleteTab, documentId } =
    useEditorContext();
  const offline = useIsOfflineDocument(documentId);
  const connection = connectionOf(activeTab);
  if (!connection) return null;
  return (
    <ConnectedTabPage
      tabId={activeTab.id}
      name={activeTab.name}
      connection={connection}
      hostApp="livedocuments"
      offline={offline}
      // Remove, Connect Again and the rename are an Editor's who may change the tabs (not a tab-scoped link's).
      canEdit={!isStructureReadOnly}
      grant={connectedTabs.grant}
      onRename={(name) => renameTab(activeTab.id, name)}
      onRemove={() => deleteTab(activeTab.id)}
      onConnectAgain={() => void connectedTabs.connectAgainTab(activeTab.id)}
    />
  );
}
