'use client';

import { useCallback } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { EMPTY_SELECTION, type Selection } from '@liveworkspace/workbench/lib/selection-store';
import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { tabAsSeen } from '@/lib/export-as-seen';
import { panelEnabled } from '@/lib/user-preferences';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { shareUrl } from '@/lib/explorer-host';
import { planHandOver, shareHelpHref, trackShare } from '@/lib/explorer-share-host';
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

// Tab-scoped export / import dialogs + the project share dialog. Each is
// gated on its own open flag and reads everything from EditorContext, so
// EditorView just renders <EditorTabDialogs />. Grouped because all three
// are "act on this tab / project as a whole" modals launched from the
// header, distinct from the global editor modals in EditorModals.
export function EditorTabDialogs() {
  const {
    userPreferences,
    exportOpen,
    exportScope,
    activeTab,
    tabs,
    projectName,
    setExportOpen,
    importOpen,
    importIntoActiveTab,
    importTextIntoActiveTab,
    setImportOpen,
    shareDialogOpen,
    selfParticipant,
    projectId,
    setShareDialogOpen,
    syncToCloud,
    accountUserId,
    projectTeamId,
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

  // Offline projects (docs/specs/006-project/offline-mode.md) can't be shared until they're synced to the
  // owner's account; the Share dialog says so and offers Sync Project, which converts the open project
  // in place ("Syncing in place"), and then shows the share options. Never as the 'self' placeholder an
  // early open runs under: the gate waits for the reader (`syncReady`).
  const isOffline = useIsOfflineProject(projectId);
  const readerKnown = selfParticipant.id !== 'self';

  return (
    <>
      {exportOpen ? (
        <ExportTabDialog
          // Export what the author is LOOKING at: a tab on the Default colour
          // scheme paints in the viewer's appearance (docs/specs/007-editor/editor-app.md), so the export
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
          projectName={projectName}
          // A Dashboard's slots that show another tab draw it (docs/specs/026-plan/plan-tabs.md "Export").
          projectTabs={tabs}
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
      ) : shareDialogOpen && projectId ? (
        <ShareDialog
          client={indexClient}
          item={{
            id: projectId,
            app: 'liveplanner',
            kind: 'plan',
            sharedVia: null,
            title: projectName,
            teamId: projectTeamId,
          }}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          shareUrl={shareUrl}
          handOver={planHandOver}
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
