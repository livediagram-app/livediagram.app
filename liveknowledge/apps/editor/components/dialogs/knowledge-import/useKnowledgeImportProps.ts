'use client';

// What the Import dialog hands a Knowledgebase import, from the open editor
// (docs/specs/020-import-export/knowledgebase-import.md "Share roles"): an Editor on the whole knowledgebase gets the
// three sources; a Participant, a Viewer or a page-scoped link gets nothing, and the dialog then shows none of them.
// The handlers read the editor's newest state when they run, so the host keeps its identity while an import runs.
import { useMemo } from 'react';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { pageLinkOf } from '@/components/page-tree/usePageTreeModel';
import { selectPage } from '@/components/page-tree/select-page';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import type { KnowledgeImportHost } from '@/lib/knowledge-import/run-import';
import type { KnowledgeImportProps } from './KnowledgeImportPanel';

export function useKnowledgeImportProps(): KnowledgeImportProps | undefined {
  const chrome = useEditorChromeStore();
  const canEdit = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  const documentId = useEditorChrome((s) => s.documentId);
  const ownerId = useEditorChrome((s) => s.selfParticipant.id);
  const teamId = useEditorChrome((s) => s.documentTeamId ?? null);
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const activePageId = useEditorChrome((s) => s.activeId);
  const offline = useIsOfflineDocument(documentId);

  const host = useMemo<KnowledgeImportHost | null>(
    () =>
      // 'self' is the placeholder an early open runs under: nothing is written as it.
      canEdit && documentId && ownerId !== 'self'
        ? {
            ownerId,
            documentId,
            offline,
            teamId,
            getTabs: () => chrome.get().tabs,
            getActiveTab: () => chrome.get().activeTab,
            commitTabs: (mapTabs) => chrome.get().commitTabs(mapTabs),
            markTabLoaded: (id) => chrome.get().markTabLoaded(id),
          }
        : null,
    [canEdit, documentId, ownerId, offline, teamId, chrome],
  );
  const pages = useMemo(
    () => tabs.map((t) => ({ id: t.id, name: t.name, ...(t.parent ? { parent: t.parent } : {}) })),
    [tabs],
  );

  return useMemo(
    () =>
      host
        ? {
            host,
            pages,
            activePageId,
            onOpenPage: (openId: string, pageId: string) => {
              if (openId === host.documentId) selectPage(chrome.get(), pageId);
              // The knowledgebase the import made: opened at its first page.
              else window.location.assign(pageLinkOf(window.location.origin, openId, pageId, null));
            },
          }
        : undefined,
    [host, pages, activePageId, chrome],
  );
}
