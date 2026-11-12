'use client';

import { useState } from 'react';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { ExplorerMenuActions } from '@/components/panels/Explorer.types';
import { track } from '@/lib/telemetry';

// The Explorer menu's document actions for EditorCanvasHost, with the Webhooks dialog's open state that one of
// them opens.
export function useCanvasHostExplorer(): {
  explorerMenuActions: ExplorerMenuActions;
  webhooksOpen: boolean;
  setWebhooksOpen: (open: boolean) => void;
} {
  const {
    accountUserId,
    canShareDocument,
    hydrated,
    isReadOnly,
    loadAllTabs,
    participating,
    sessionTabScope,
    setExportOpen,
    setExportScope,
    setSearchOpen,
    setSettingsOpen,
    setShareDialogOpen,
  } = useEditorContext();
  // The document's own Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): offered to a signed-in account that
  // edits the whole document (not a Viewer, a Participant or a one-tab link); the index checks again on every call.
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const canManageWebhooks =
    hydrated && Boolean(accountUserId) && !isReadOnly && !participating && sessionTabScope === null;
  return {
    webhooksOpen,
    setWebhooksOpen,
    explorerMenuActions: {
      // The header's Share gate: the owner, or a joined member of the document's team
      // (docs/specs/013-workspace/folders.md, docs/specs/013-workspace/team-shared-documents.md).
      onShare:
        canShareDocument && hydrated
          ? () => {
              setShareDialogOpen(true);
              track('UI', 'Opened', 'Share');
            }
          : undefined,
      onExport: () => {
        setExportScope('tab');
        setExportOpen(true);
      },
      onWebhooks: canManageWebhooks ? () => setWebhooksOpen(true) : undefined,
      onSearch: () => openSearchWithPrefetch(setSearchOpen, loadAllTabs),
      onOpenSettings: () => {
        setSettingsOpen(true);
        track('UI', 'Opened', 'Settings');
      },
    },
  };
}
