'use client';

// The page tree's connected files, from the editor (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files
// in the sidebar"): where each leads (the knowledgebase's row store, asked with the host's grant), whether Connect
// File is offered, the Connect File dialog, and the row's verbs: Open in a new browser tab, Copy Link, Connect Again
// and Remove from Sidebar. The name the index answers is the row's name: a writer's editor renames the row to match.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { App } from '@liveworkspace/index-client';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { reverseUnreachedWords } from '@liveworkspace/workbench/components/connect/connect-again';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { connectedRowStoreFor, type ConnectedRowState } from '@/lib/knowledge/connected-row-store';
import { track } from '@/lib/telemetry';
import { cantOpenWords, type PageTreeConnected } from './connected-rows';

const ConnectFileDialog = dynamic(
  () => import('@/components/connect/ConnectFileDialog').then((m) => m.ConnectFileDialog),
  { ssr: false },
);

// `noopener`: the other app's page gets no handle back to this one.
const openNew = (href: string) => void window.open(href, '_blank', 'noopener');

export function useConnectedRows(): {
  connected: PageTreeConnected | undefined;
  dialog: ReactNode;
} {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const offline = useIsOfflineDocument(documentId);
  // Connecting needs an account, a knowledgebase on the server and a session that may change the whole tree (never a
  // link confined to one page, an embed or a workbench). Editors and Participants (`editPages`).
  const canConnect = useEditorChrome(
    (s) =>
      !!s.accountUserId &&
      !!s.documentId &&
      s.can.editPages &&
      !s.isStructureReadOnly &&
      !s.embedMode &&
      !s.workbench,
  );
  const canEdit = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  // Signed in as the knowledgebase's own session (no share code): the picker may place it in the account's files.
  const hostManaged = useEditorChrome((s) => s.sessionShareCode === null);
  const connectedIds = useEditorChrome((s) => s.connectedTabs.connected);
  const store = useMemo(
    () => (documentId ? connectedRowStoreFor(documentId, indexClient) : null),
    [documentId],
  );
  // The asks use the newest grant the editor holds (a share code's, a renewed one).
  useEffect(() => {
    store?.setGrant(() => chrome.get().connectedTabs.grant());
  }, [store, chrome]);

  // A writer's rows follow their files' names, as the index answers them.
  useEffect(() => {
    if (!store || !canEdit) return;
    const follow = () => {
      for (const tab of chrome.get().tabs) {
        const connection = connectionOf(tab);
        if (!connection) continue;
        const state = store.stateOf(connection.id);
        if (state.kind === 'ready' && state.name && state.name !== tab.name)
          chrome.get().renameTab(tab.id, state.name);
      }
    };
    follow();
    return store.subscribe(follow);
  }, [store, canEdit, chrome]);

  const [dialog, setDialog] = useState<{ parent: string | undefined } | null>(null);

  const answerOf = useCallback(
    async (id: string): Promise<{ state: ConnectedRowState; app: App } | null> => {
      const tab = chrome.get().tabs.find((t) => t.id === id);
      const connection = connectionOf(tab);
      if (!store || !connection) return null;
      const held = store.stateOf(connection.id);
      const state =
        held.kind === 'ready' || held.kind === 'broken' ? held : await store.resolve(connection.id);
      return { state, app: connection.app };
    },
    [chrome, store],
  );

  const sayWhy = useCallback(
    (state: ConnectedRowState, app: App) => {
      if (state.kind === 'broken') toast.error(cantOpenWords(state.reason, app, canEdit));
      else
        toast.error('The file could not be reached just now. Check your connection and try again.');
    },
    [toast, canEdit],
  );

  const connected = useMemo<PageTreeConnected | undefined>(() => {
    if (!store) return undefined;
    return {
      store,
      canConnect: canConnect && !offline,
      onConnect: (parent) => setDialog({ parent }),
      onOpen: (id) => {
        // window.open runs in the press's own turn when the address is known, so no browser blocks the new tab.
        const tab = chrome.get().tabs.find((t) => t.id === id);
        const connection = connectionOf(tab);
        if (!connection) return;
        const held = store.stateOf(connection.id);
        track('UI', 'Used', 'OpenConnectedFile');
        if (held.kind === 'ready') return openNew(held.href);
        void answerOf(id).then((answer) => {
          if (!answer) return;
          if (answer.state.kind === 'ready') openNew(answer.state.href);
          else sayWhy(answer.state, connection.app);
        });
      },
      onCopyLink: (id) => {
        void answerOf(id).then((answer) => {
          if (!answer) return;
          if (answer.state.kind !== 'ready') return sayWhy(answer.state, answer.app);
          navigator.clipboard.writeText(answer.state.href).then(
            () => toast.success('Link copied'),
            () => toast.error('Could not copy the link.'),
          );
        });
      },
      onRemove: (id) => void chrome.get().deleteTab(id),
      onConnectAgain: (id) => {
        const tab = chrome.get().tabs.find((t) => t.id === id);
        const was = connectionOf(tab);
        void chrome
          .get()
          .connectedTabs.connectAgainTab(id)
          .then(() => {
            const now = connectionOf(chrome.get().tabs.find((t) => t.id === id));
            if (now && now.id !== was?.id) store.request(now.id);
          });
      },
    };
  }, [store, canConnect, offline, chrome, answerOf, sayWhy, toast]);

  const parentName = dialog?.parent
    ? tabs.find((t) => t.id === dialog.parent)?.name || 'Untitled Page'
    : null;
  const node =
    dialog && documentId ? (
      <ConnectFileDialog
        hostId={documentId}
        hostManaged={hostManaged}
        connected={connectedIds}
        parentName={parentName}
        grant={() => chrome.get().connectedTabs.grant()}
        addRow={(made, tabId) => chrome.get().addConnectedRow(made, tabId, dialog.parent)}
        onConnected={(_tabId, made) => {
          setDialog(null);
          store?.request(made.connection.id);
          if (made.reverse?.state === 'unreached')
            return toast.info(reverseUnreachedWords(made.name || 'The other file'));
          toast.success(
            `${made.name || 'The file'} is in the sidebar. Click it to open it in a new tab.`,
          );
        }}
        onGoTo={() => setDialog(null)}
        onOpenExplorer={() =>
          window.open(`${window.location.origin}/explorer`, '_blank', 'noopener')
        }
        onClose={() => setDialog(null)}
      />
    ) : null;
  return { connected, dialog: node };
}
