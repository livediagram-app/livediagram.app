'use client';

// Where Embed File may add the embed's tab (liveworkspace/docs/specs/004-index/live-embeds.md "Making one", Work Tracker
// 1375): where the page tree's Connect File could connect (useConnectedRows), its row going in at the tree's top
// level. Undefined everywhere else, so the role is not asked and the file is embedded with no tab.
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import type { ConnectionMade } from '@liveworkspace/index-client';

export type EmbedConnectHost = {
  hostKind: string;
  connected: ReadonlyMap<string, string>;
  grant: () => Promise<string | null>;
  newTabId: () => string;
  addConnectedTab: (made: ConnectionMade, tabId: string) => Promise<void>;
};

export function useEmbedConnectHost(): EmbedConnectHost | undefined {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  // As the page tree's Connect File: an account, a knowledgebase on the server and a session that may change the whole
  // tree (never a link confined to one page, an embed or a workbench).
  const canConnect = useEditorChrome(
    (s) =>
      !!s.accountUserId &&
      !!s.documentId &&
      s.can.editPages &&
      !s.isStructureReadOnly &&
      !s.embedMode &&
      !s.workbench,
  );
  const connected = useEditorChrome((s) => s.connectedTabs.connected);
  if (!canConnect || offline) return undefined;
  return {
    hostKind: 'knowledgebase',
    connected,
    grant: () => chrome.get().connectedTabs.grant(),
    newTabId: () => crypto.randomUUID(),
    addConnectedTab: (made, tabId) => chrome.get().addConnectedRow(made, tabId, undefined),
  };
}
