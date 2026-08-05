'use client';

import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { useIsOfflineDiagram } from '@/hooks/persistence/useIsOfflineDiagram';
import { saveOfflineToCloud } from '@/lib/offline/offline-convert';

const ExportTabDialog = dynamic(() =>
  import('@/components/dialogs/ExportTabDialog').then((m) => m.ExportTabDialog),
);
const ImportTabDialog = dynamic(() =>
  import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
);
const ShareDialog = dynamic(() =>
  import('@/components/dialogs/ShareDialog').then((m) => m.ShareDialog),
);

// Tab-scoped export / import dialogs + the diagram share dialog. Each is
// gated on its own open flag and reads everything from EditorContext, so
// EditorView just renders <EditorTabDialogs />. Grouped because all three
// are "act on this tab / diagram as a whole" modals launched from the
// header, distinct from the global editor modals in EditorModals.
export function EditorTabDialogs() {
  const {
    exportOpen,
    exportScope,
    activeTab,
    tabs,
    multiSelectedIds,
    diagramName,
    imageContext,
    setExportOpen,
    importOpen,
    importIntoActiveTab,
    importTextIntoActiveTab,
    setImportOpen,
    shareDialogOpen,
    selfParticipant,
    shareLinks,
    sharePassword,
    shareUrlFor,
    nameConfirmed,
    clerkUserId,
    clerkDisplayName,
    diagramId,
    updateParticipantName,
    createShareLink,
    revokeShareLink,
    extendShareLink,
    setDiagramSharePassword,
    setShareDialogOpen,
  } = useEditorContext();

  // Offline diagrams (spec/76) can't be shared until they're synced to the
  // owner's account; the Share dialog shows a gate that runs this conversion,
  // then reloads so the editor re-hydrates as a normal cloud diagram.
  const isOffline = useIsOfflineDiagram(diagramId);
  const syncToCloud = async () => {
    if (!diagramId) return;
    await saveOfflineToCloud(diagramId, selfParticipant.id);
    window.location.reload();
  };

  return (
    <>
      {exportOpen ? (
        <ExportTabDialog
          tab={
            exportScope === 'selection'
              ? {
                  ...activeTab,
                  elements: activeTab.elements.filter((el) => multiSelectedIds.has(el.id)),
                }
              : activeTab
          }
          scope={exportScope}
          diagramName={diagramName}
          imageContext={imageContext}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {importOpen ? (
        <ImportTabDialog
          tabName={activeTab.name}
          onImportFile={importIntoActiveTab}
          onImportText={importTextIntoActiveTab}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
      {shareDialogOpen ? (
        <ShareDialog
          participant={selfParticipant}
          links={shareLinks}
          sharePassword={sharePassword}
          shareUrlFor={shareUrlFor}
          tabs={tabs}
          nameConfirmed={nameConfirmed}
          // Signed-in via Clerk → name is locked to the account
          // display name (same rule as the welcome modal, spec/04).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={clerkUserId ? clerkDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onExtendLink={extendShareLink}
          onSetPassword={setDiagramSharePassword}
          offline={isOffline}
          onSyncToCloud={syncToCloud}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
