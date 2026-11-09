'use client';

// Connect File on a start screen (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the
// shared list, loaded and mounted only once the person chooses the entry, so the start screen's first paint and its
// one read of Recent wait for that choice. Offered only where connecting can work: signed in, the document on the
// server, and a session that may change its tabs (not a tab-scoped link's, an embed's, a workbench's or a viewer's).
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import type { StartPalette } from '@/components/start/start-palette';

const ConnectFilePanel = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectFilePanel').then(
      (m) => m.ConnectFilePanel,
    ),
  { ssr: false },
);

export function useConnectStart(): ((palette: StartPalette) => ReactNode) | undefined {
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
  return (palette) => (
    <ConnectFilePanel
      hostId={documentId}
      hostKind="document"
      // Its owner or a member of its team opens it without a link: they manage its links, which both ways needs.
      hostManaged={sessionShareCode === null}
      connected={connectedTabs.connected}
      // The accent is the start panel's chosen ink: its focus colour, as the rail's chosen row has it.
      ink={{ ...palette, accent: palette.focus }}
      grant={connectedTabs.grant}
      newTabId={() => crypto.randomUUID()}
      // The empty tab this start is on gives way to the connected tab, unless it is the document's only tab.
      addTab={(made, tabId) =>
        connectedTabs.addConnectedTab(made, tabId, tabs.length > 1 ? activeTab.id : undefined)
      }
      onConnected={connectedTabs.showConnected}
      onGoTo={connectedTabs.goTo}
      // Nothing recent: the Explorer, where every file is.
      onOpenExplorer={() => window.location.assign(`${window.location.origin}/explorer`)}
    />
  );
}
