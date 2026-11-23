'use client';

// Where connecting can work (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"), and the Connect list's
// props that hold wherever it is drawn: the start screen's Connect File (useConnectStart) and the tab bar's Connect a
// File (useConnectFileDialog). Signed in, the document on the server, and a session that may change its tabs: never a
// Participant's or a Viewer's, a tab-scoped link's, an embed's or a workbench's. Undefined everywhere else.
import type { BesideOffer } from '@liveworkspace/index-client';
import type { ConnectFilePanelProps } from '@liveworkspace/workbench/components/connect/ConnectFilePanel';
import { besideOfferFor } from '@/components/connect/beside-offer';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';

export type ConnectHost = Omit<ConnectFilePanelProps, 'addTab' | 'ink' | 'offer'> & {
  // The connected tab's add at the end of the bar; `replacing` is the empty start tab it takes the place of.
  addConnectedTab: (
    made: Parameters<ConnectFilePanelProps['addTab']>[0],
    tabId: string,
    replacing?: string,
  ) => Promise<void>;
  // The open tab and how many there are, for the start's replace.
  activeTabId: string;
  tabCount: number;
} & {
  // A template's offer (connected-tabs.md "A file made beside it"), wherever the list is drawn.
  offer?: BesideOffer;
};

export function useConnectHost(): ConnectHost | undefined {
  const ctx = useOptionalEditorContext();
  const offline = useIsOfflineDocument(ctx?.documentId ?? null);
  if (!ctx) return undefined;
  const {
    accountUserId,
    documentId,
    isStructureReadOnly,
    embedMode,
    workbench,
    sessionShareCode,
    connectedTabs,
    activeTab,
    tabs,
  } = ctx;
  if (!accountUserId || !documentId || offline || isStructureReadOnly || embedMode || workbench)
    return undefined;
  const offer = besideOfferFor(tabs);
  return {
    hostId: documentId,
    hostKind: 'document',
    // Its owner or a member of its team opens it without a link: they manage its links, which both ways needs.
    hostManaged: sessionShareCode === null,
    connected: connectedTabs.connected,
    grant: connectedTabs.grant,
    newTabId: () => crypto.randomUUID(),
    addConnectedTab: connectedTabs.addConnectedTab,
    onConnected: connectedTabs.showConnected,
    onGoTo: connectedTabs.goTo,
    // Nothing recent: the Explorer, where every file is.
    onOpenExplorer: () => window.location.assign(`${window.location.origin}/explorer`),
    activeTabId: activeTab.id,
    tabCount: tabs.length,
    ...(offer ? { offer } : {}),
  };
}
