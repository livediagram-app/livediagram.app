'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@liveworkspace/workbench/lib/selection-store';
import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { tabAsSeen } from '@/lib/export-as-seen';
import { panelEnabled } from '@/lib/user-preferences';
import { indexClient } from '@/lib/index-client';
import { shareUrl } from '@/lib/explorer-host';
import { documentHandOver, shareHelpHref, trackShare } from '@/lib/explorer-share-host';
import { randomName } from '@/lib/identity';
import { useToast } from '@/hooks/ui/useToast';

const ExportTabDialog = dynamic(
  () => import('@/components/dialogs/ExportTabDialog').then((m) => m.ExportTabDialog),
  { ssr: false },
);
const ImportTabDialog = dynamic(
  () => import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
  { ssr: false },
);
// The shared Explorer's Share dialog (@liveworkspace/explorer): links are the index's, managed there.
const ShareDialog = dynamic(() => import('@liveworkspace/explorer').then((m) => m.ShareDialog), {
  ssr: false,
});
const ShareOfflineGate = dynamic(
  () => import('@/components/dialogs/ShareOfflineGate').then((m) => m.ShareOfflineGate),
  { ssr: false },
);

// Tab-scoped export / import dialogs + the document share dialog. Each is
// gated on its own open flag and reads everything from EditorContext, so
// EditorView just renders <EditorTabDialogs />. Grouped because all three
// are "act on this tab / document as a whole" modals launched from the
// header, distinct from the global editor modals in EditorModals.
export function EditorTabDialogs() {
  const {
    userPreferences,
    exportOpen,
    exportScope,
    pagesMode,
    activeTab,
    tabs,
    loadAllTabs,
    documentName,
    imageContext,
    setExportOpen,
    importOpen,
    importIntoActiveTab,
    importTextIntoActiveTab,
    setImportOpen,
    shareDialogOpen,
    selfParticipant,
    documentId,
    setShareDialogOpen,
    syncToCloud,
    setSelectedId,
    setMultiSelectedIds,
    accountUserId,
    documentTeamId,
    setSelfParticipant,
  } = useEditorContext();
  const toast = useToast();
  // The selection the export covers, read from the store while a selection export is open
  // (docs/specs/008-canvas/blueprints/selection-store.md).
  const exportingSelection = exportOpen && exportScope === 'selection';
  const multiSelectedIds = useSelectionOf(
    useCallback(
      (sel: Selection) =>
        exportingSelection ? sel.multiSelectedIds : EMPTY_SELECTION.multiSelectedIds,
      [exportingSelection],
    ),
  );

  // Offline documents (docs/specs/006-document/offline-mode.md) can't be shared until they're synced to the
  // owner's account; the Share dialog says so and offers Sync Document, which converts the open document
  // in place ("Syncing in place"), and then shows the share options. Never as the 'self' placeholder an
  // early open runs under: the gate waits for the reader (`syncReady`).
  const isOffline = useIsOfflineDocument(documentId);
  const readerKnown = selfParticipant.id !== 'self';

  return (
    <>
      {exportOpen ? (
        <ExportTabDialog
          // Export what the author is LOOKING at: a tab on the Default colour
          // scheme paints in the viewer's appearance (docs/specs/007-editor/editor-app.md), so the export
          // takes the resolved backdrop rather than the stored one — and, from
          // it, the ink for every element that carries no colours of its own. It is the tab's
          // canvas backdrop as the viewer sees it (docs/specs/011-theme/light-and-dark.md "What a viewer sees").
          tab={tabAsSeen({
            ...activeTab,
            ...(exportScope === 'selection'
              ? { elements: activeTab.elements.filter((el) => multiSelectedIds.has(el.id)) }
              : {}),
          })}
          scope={exportScope}
          // In Pages mode the whole tab exports as its pages
          // (docs/specs/007-editor/pages-mode.md "Export").
          pages={exportScope === 'tab' ? pagesMode?.pages : undefined}
          documentName={documentName}
          // A tab window draws the tab it shows (docs/specs/009-elements/tab-window.md "Exports").
          documentTabs={tabs}
          loadTabs={loadAllTabs}
          onClearSelection={() => {
            setSelectedId(null);
            setMultiSelectedIds(new Set());
          }}
          imageContext={imageContext}
          offerHiddenLayers={panelEnabled(userPreferences, 'layersPanelEnabled')}
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
      {shareDialogOpen && isOffline ? (
        <ShareOfflineGate
          onSyncToCloud={syncToCloud}
          ready={readerKnown}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : shareDialogOpen && documentId ? (
        <ShareDialog
          client={indexClient}
          item={{
            id: documentId,
            app: 'livedocuments',
            kind: 'document',
            sharedVia: null,
            title: documentName,
            teamId: documentTeamId,
          }}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          shareUrl={shareUrl}
          handOver={documentHandOver}
          helpHref={shareHelpHref}
          onTelemetry={trackShare}
          notify={(text, tone) => toast[tone](text)}
          // A guest's name is theirs to change here; an account's is the account's (auth-and-guest-access.md).
          identity={
            accountUserId
              ? undefined
              : {
                  name: selfParticipant.name,
                  color: selfParticipant.color,
                  randomName,
                  onSave: (name) => setSelfParticipant((p) => ({ ...p, name })),
                }
          }
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
