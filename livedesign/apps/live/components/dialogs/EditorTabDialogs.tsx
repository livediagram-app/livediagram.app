'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@liveworkspace/workbench/lib/selection-store';
import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { tabAsSeen } from '@/lib/export-as-seen';
import { panelEnabled } from '@/lib/user-preferences';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { shareUrl } from '@/lib/explorer-host';
import { designHandOver, shareHelpHref, trackShare } from '@/lib/explorer-share-host';
import { randomName } from '@/lib/identity';
import { firstPageLooksEmpty } from '@/lib/community-first-page';
import { useToast } from '@/hooks/ui/useToast';

const ExportTabDialog = dynamic(
  () => import('@/components/dialogs/ExportTabDialog').then((m) => m.ExportTabDialog),
  { ssr: false },
);
const ImportTabDialog = dynamic(
  () => import('@/components/dialogs/ImportTabDialog').then((m) => m.ImportTabDialog),
  { ssr: false },
);
// The shared Explorer's Share dialog (@liveworkspace/explorer), with livedesign's Community tab
// (docs/specs/025-community/community.md "Publishing"): links are the index's, managed there.
const ShareDialog = dynamic(
  () =>
    import('@/components/dialogs/community/ShareDialogWithCommunity').then(
      (m) => m.ShareDialogWithCommunity,
    ),
  { ssr: false },
);
const ShareOfflineGate = dynamic(
  () => import('@/components/dialogs/ShareOfflineGate').then((m) => m.ShareOfflineGate),
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
    designId,
    setShareDialogOpen,
    syncToCloud,
    accountUserId,
    accountDisplayName,
    designTeamId,
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
      {shareDialogOpen && isOffline ? (
        <ShareOfflineGate
          onSyncToCloud={syncToCloud}
          ready={readerKnown}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : shareDialogOpen && designId ? (
        <ShareDialog
          client={indexClient}
          item={{
            id: designId,
            app: 'livedesign',
            kind: 'design',
            sharedVia: null,
            title: designName,
            teamId: designTeamId,
          }}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          shareUrl={shareUrl}
          handOver={designHandOver}
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
          ownerId={selfParticipant.id}
          designName={designName}
          signedIn={!!accountUserId}
          author={{
            name: (accountUserId ? accountDisplayName : null) || selfParticipant.name,
            color: selfParticipant.color,
          }}
          // Known only for the open tab (the editor holds its elements); another first tab is left to the server
          // (docs/specs/025-community/community.md "Something to show").
          firstTabEmpty={
            !!activeTab && tabs[0]?.id === activeTab.id && firstPageLooksEmpty(activeTab)
          }
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
