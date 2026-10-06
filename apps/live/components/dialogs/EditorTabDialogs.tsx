'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@/lib/selection-store';
import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { saveOfflineToCloud } from '@/lib/offline/offline-convert';
import { tabAsSeen } from '@/lib/export-as-seen';
import { panelEnabled } from '@/lib/user-preferences';
import { LeaveIllustrateDialog } from '@/components/dialogs/LeaveIllustrateDialog';
import { LeaveIllustrateConfirm } from '@/components/dialogs/LeaveIllustrateConfirm';

const ExportTabDialog = dynamic(
  () => import('@/components/dialogs/ExportTabDialog').then((m) => m.ExportTabDialog),
  { ssr: false },
);
const ImportTabDialog = dynamic(
  () => import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
  { ssr: false },
);
// The Share dialog with its Community band (docs/specs/025-community/community.md "Publishing").
const ShareDialog = dynamic(
  () =>
    import('@/components/dialogs/community/ShareDialogWithCommunity').then(
      (m) => m.ShareDialogWithCommunity,
    ),
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
    illustratePages,
    activeTab,
    tabs,
    documentName,
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
    clerkUserId,
    clerkDisplayName,
    documentId,
    documentTeamId,
    updateParticipantName,
    createShareLink,
    revokeShareLink,
    extendShareLink,
    rescopeShareLink,
    setDocumentSharePassword,
    setShareDialogOpen,
    leaveIllustrate,
  } = useEditorContext();
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
  // owner's account; the Share dialog shows a gate that runs this conversion,
  // then reloads so the editor re-hydrates as a normal cloud document.
  const isOffline = useIsOfflineDocument(documentId);
  const syncToCloud = async () => {
    if (!documentId) return;
    await saveOfflineToCloud(documentId, selfParticipant.id);
    window.location.reload();
  };

  return (
    <>
      <LeaveIllustrateDialog leave={leaveIllustrate} />
      <LeaveIllustrateConfirm leave={leaveIllustrate} />
      {exportOpen ? (
        <ExportTabDialog
          // Export what the author is LOOKING at: a tab on the Default colour
          // scheme paints in the viewer's appearance (docs/specs/007-editor/live-app.md), so the export
          // takes the resolved backdrop rather than the stored one — and, from
          // it, the ink for every element that carries no colours of its own. It is the tab's
          // Diagram backdrop in either mode (docs/specs/007-editor/editor-modes.md "One look").
          tab={tabAsSeen({
            ...activeTab,
            ...(exportScope === 'selection'
              ? { elements: activeTab.elements.filter((el) => multiSelectedIds.has(el.id)) }
              : {}),
          })}
          scope={exportScope}
          // In Illustrate mode the whole tab exports as its pages
          // (docs/specs/007-editor/illustrate-pages.md "Export").
          pages={exportScope === 'tab' ? illustratePages?.pages : undefined}
          documentName={documentName}
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
          // Illustrate mode imports a livediagram tab only: the other formats are diagrams
          // (docs/specs/007-editor/illustrate-pages.md "Import").
          formats={illustratePages ? ['json'] : undefined}
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
          // Signed-in via Clerk → name is locked to the account
          // display name (same rule as the welcome modal, docs/specs/014-identity/auth-and-guest-access.md).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={clerkUserId ? clerkDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onRescopeLink={rescopeShareLink}
          onExtendLink={extendShareLink}
          onSetPassword={setDocumentSharePassword}
          offline={isOffline}
          onSyncToCloud={syncToCloud}
          documentId={documentId}
          documentName={documentName}
          signedIn={!!clerkUserId}
          teamDocument={!!documentTeamId}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
