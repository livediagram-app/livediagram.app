'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@/lib/selection-store';
import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { tabAsSeen } from '@/lib/export-as-seen';
import { panelEnabled } from '@/lib/user-preferences';

const ExportTabDialog = dynamic(
  () => import('@/components/dialogs/ExportTabDialog').then((m) => m.ExportTabDialog),
  { ssr: false },
);
const ImportTabDialog = dynamic(
  () => import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
  { ssr: false },
);
const ShareDialog = dynamic(
  () => import('@/components/dialogs/ShareDialog').then((m) => m.ShareDialog),
  { ssr: false },
);

// Tab-scoped export / import dialogs + the design share dialog. Each is
// gated on its own open flag and reads everything from EditorContext, so
// EditorView just renders <EditorTabDialogs />. Grouped because all three
// are "act on this tab / design as a whole" modals launched from the
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
    designName,
    imageContext,
    setExportOpen,
    importOpen,
    importIntoActiveTab,
    importTextIntoActiveTab,
    setImportOpen,
    shareDialogOpen,
    selfParticipant,
    shareLinks,
    sharePasswordSet,
    shareUrlFor,
    accountUserId,
    accountDisplayName,
    designId,
    designTeamId,
    updateParticipantName,
    createShareLink,
    revokeShareLink,
    extendShareLink,
    rescopeShareLink,
    setDesignSharePassword,
    setShareDialogOpen,
    syncToCloud,
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

  // Offline designs (docs/specs/006-design/offline-mode.md) can't be shared until they're synced to the
  // owner's account; the Share dialog says so and offers Sync Design, which converts the open design
  // in place ("Syncing in place"), and then shows the share options. Never as the 'self' placeholder an
  // early open runs under: the gate waits for the reader (`syncReady`).
  const isOffline = useIsOfflineDesign(designId);
  const readerKnown = selfParticipant.id !== 'self';

  return (
    <>
      {exportOpen ? (
        <ExportTabDialog
          // Export what the author is LOOKING at: a tab on the Default colour
          // scheme paints in the viewer's appearance (docs/specs/007-editor/live-app.md), so the export
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
          designName={designName}
          // A tab window draws the tab it shows (docs/specs/009-elements/tab-window.md "Exports").
          designTabs={tabs}
          loadTabs={loadAllTabs}
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
      {shareDialogOpen ? (
        <ShareDialog
          participant={selfParticipant}
          links={shareLinks}
          sharePasswordSet={sharePasswordSet}
          shareUrlFor={shareUrlFor}
          tabs={tabs}
          // Signed-in to an account → name is locked to the account
          // display name (same rule as the welcome modal, docs/specs/014-identity/auth-and-guest-access.md).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={accountUserId ? accountDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onRescopeLink={rescopeShareLink}
          onExtendLink={extendShareLink}
          onSetPassword={setDesignSharePassword}
          offline={isOffline}
          onSyncToCloud={syncToCloud}
          syncReady={readerKnown}
          teamDesign={!!designTeamId}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
