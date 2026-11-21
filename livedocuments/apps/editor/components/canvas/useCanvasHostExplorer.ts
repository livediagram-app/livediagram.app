'use client';

import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { ExplorerMenuActions } from '@/components/panels/Explorer.types';
import { track } from '@/lib/telemetry';

// The Explorer menu's document actions for EditorCanvasHost.
export function useCanvasHostExplorer(): { explorerMenuActions: ExplorerMenuActions } {
  const {
    canShareDocument,
    hydrated,
    loadAllTabs,
    setExportOpen,
    setExportScope,
    setSearchOpen,
    setSettingsOpen,
    setShareDialogOpen,
  } = useEditorContext();
  return {
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
      onSearch: () => openSearchWithPrefetch(setSearchOpen, loadAllTabs),
      onOpenSettings: () => {
        setSettingsOpen(true);
        track('UI', 'Opened', 'Settings');
      },
    },
  };
}
