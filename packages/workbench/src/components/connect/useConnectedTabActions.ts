'use client';

// The editor's side of connecting (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting", "Opening"), once
// for every app: the host's grant, the new connected tab's add (the app's whole-tab save, awaited, so a failure takes
// the connection back), the move to it, and Connect Again on a tab already connected. Each app hands in its own tab
// type's pieces: how it makes a blank tab, saves one whole, and commits its tab list.
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ConnectionMade } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { connectAgain, reverseUnreachedWords } from './connect-again';
import { connectErrorWords } from './connect-words';
import { connectedTargets, connectionOf, withConnection } from './tab-connection';
import { toastName } from '../../lib/toast-name';

type TabLike = { id: string; name: string };

export type ConnectedTabActionsDeps<T extends TabLike> = {
  tabs: readonly T[];
  // The host's kind in words: "diagram", "plan".
  hostKind: string;
  documentId: string | null;
  // The host's grant (X-Index-Grant) for this session, null when refused or out of reach.
  grantFor: (documentId: string) => Promise<string | null>;
  // A blank tab named `name` (the app's createTab).
  createTab: (name: string) => T;
  // The app's whole-tab save (`PUT /api/<items>/:id/tabs/:tabId`), throwing when it fails.
  saveTab: (tab: T) => Promise<unknown>;
  commitTabs: (map: (tabs: T[]) => T[]) => void;
  // A tab made here has no server content to fetch.
  markTabLoaded: (id: string) => void;
  // Make a tab the open one, as the tab bar's press does (the selection cleared).
  openTab: (id: string) => void;
  toast: {
    info: (message: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
  };
  client?: Parameters<typeof connectAgain>[0]['client'];
};

export function useConnectedTabActions<T extends TabLike>(deps: ConnectedTabActionsDeps<T>) {
  const {
    tabs,
    hostKind,
    documentId,
    grantFor,
    createTab,
    saveTab,
    commitTabs,
    markTabLoaded,
    openTab,
    toast,
    client = indexClient,
  } = deps;

  // Stable across renders (an app hands in a fresh arrow each time), so an open in flight is not restarted.
  const grantForRef = useRef(grantFor);
  useLayoutEffect(() => {
    grantForRef.current = grantFor;
  });
  const grant = useCallback(
    () => (documentId ? grantForRef.current(documentId) : Promise.resolve(null)),
    [documentId],
  );

  // The Connect list's add: a new tab `tabId` at the end of the bar holding the connection, saved before it shows.
  // `replacing`: the empty tab the start screen was on, which the connected tab takes the place of (one commit, so
  // undo brings it back), so a tab added only to connect a file leaves no blank tab behind.
  const addConnectedTab = async (made: ConnectionMade, tabId: string, replacing?: string) => {
    const tab = withConnection({ ...createTab(made.name), id: tabId }, made.connection);
    await saveTab(tab);
    commitTabs((ts) => [
      ...(replacing && ts.length > 1 ? ts.filter((t) => t.id !== replacing) : ts),
      tab,
    ]);
    markTabLoaded(tabId);
  };

  // Connected: the new tab opens (ready, nothing navigates), and a both-ways connect whose other file was out of reach
  // says so; the host's tab stands.
  const showConnected = (tabId: string, made: ConnectionMade) => {
    openTab(tabId);
    if (made.reverse?.state === 'unreached') {
      toast.info(reverseUnreachedWords(toastName(made.name) ?? 'The other file'));
    }
  };

  const connectAgainTab = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    const connection = connectionOf(tab);
    if (!tab || !connection || !documentId) return;
    try {
      const made = await connectAgain({
        client,
        hostId: documentId,
        grant,
        tabId,
        connection,
        addTab: async (answer) => {
          await saveTab(withConnection({ ...tab, name: answer.name }, answer.connection));
          commitTabs((ts) =>
            ts.map((t) =>
              t.id === tabId ? withConnection({ ...t, name: answer.name }, answer.connection) : t,
            ),
          );
        },
      });
      toast.success(`${toastName(made.name) ?? 'The file'} is connected again.`);
    } catch (error) {
      toast.error(connectErrorWords(error, hostKind));
    }
  };

  const connected = useMemo(() => connectedTargets(tabs), [tabs]);

  return { grant, connected, addConnectedTab, showConnected, connectAgainTab, goTo: openTab };
}
