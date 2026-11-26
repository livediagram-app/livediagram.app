'use client';

// What the Export dialog hands its Markdown Folder card, from the open editor (docs/specs/020-import-export/
// knowledgebase-export.md "Where it is offered"): every session that reads the whole knowledgebase gets it, whatever
// its role; a link confined to one page gets nothing, and the dialog shows no card. The run reads the editor's newest
// pages and writing when it starts.
import { useMemo } from 'react';
import { isConnectedRow } from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { buildMarkdownFolder } from '@/lib/knowledgebase-export/markdown-folder';
import {
  markdownFolderSource,
  offersMarkdownFolder,
} from '@/lib/knowledgebase-export/markdown-folder-source';
import type { MarkdownFolderExport } from '../ExportTabDialog';

export function useMarkdownFolderProp(): MarkdownFolderExport | undefined {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const ownerId = useEditorChrome((s) => s.selfParticipant.id);
  const shareCode = useEditorChrome((s) => s.imageContext?.shareCode ?? null);
  const tabScope = useEditorChrome((s) => s.sessionTabScope);
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const offline = useIsOfflineDocument(documentId);

  return useMemo(() => {
    if (!documentId || !offersMarkdownFolder({ documentId, ownerId, tabScope })) return undefined;
    const connected = tabs.filter((t) => isConnectedRow(t)).length;
    return {
      counts: { pages: tabs.length - connected, connected },
      run: async ({ onProgress, signal }) => {
        const now = chrome.get();
        const source = await markdownFolderSource(
          {
            documentId,
            ownerId,
            shareCode,
            offline,
            tabs: now.tabs,
            loaded: now.loadedTabIds,
          },
          signal,
        );
        return buildMarkdownFolder(source, { onProgress, signal });
      },
    };
  }, [documentId, ownerId, shareCode, tabScope, tabs, offline, chrome]);
}
