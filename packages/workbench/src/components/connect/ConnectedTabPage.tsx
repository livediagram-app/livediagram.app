'use client';

// A connected tab's page, mounted by an editor in the canvas's place (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Opening", "How it looks"). It opens the file only when a person asks: a press on the tab (connected-tab-store's
// pick) or Open on the card. Shown any other way (a load, a connect, undo) it waits, ready, so a host whose open tab
// is connected to its own app never sends a reader away on reload. Each open asks the index with the host's grant;
// its answer picks the card, marks the tab broken or mended, and renames the tab to the target's title for an Editor.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { App, IndexClient, TabConnection } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { workbench } from '../../bindings';
import { ConnectedTabCard } from './ConnectedTabCard';
import { isBrokenState, type ConnectedTabView } from './connected-tab-view';
import { pickIsFresh, setConnectedTabBroken, useConnectedTabPick } from './connected-tab-store';
import { openConnectedTab, type Navigator } from './open-connected-tab';
import { useConnectedPreview } from './useConnectedPreview';

export type ConnectedTabPageProps = {
  tabId: string;
  // The tab's name: the target's title as last seen.
  name: string;
  connection: TabConnection;
  hostApp: App;
  // The host cannot reach the index (a This Browser item): connected files open when online.
  offline: boolean;
  // The session may change the host's tabs (`can('edit')`, not tab-scoped): Remove Tab, Connect Again, the rename.
  canEdit: boolean;
  // The host's grant (X-Index-Grant), null when the index refused or could not be reached.
  grant: () => Promise<string | null>;
  onRename: (name: string) => void;
  onRemove: () => void;
  onConnectAgain: () => void;
  className?: string;
  client?: Pick<IndexClient, 'openConnection'>;
  navigate?: Navigator;
};

export function ConnectedTabPage(props: ConnectedTabPageProps) {
  // A new tab or a new connection (Connect Again) starts its page afresh, ready.
  return <Page key={`${props.tabId}:${props.connection.id}`} {...props} />;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function Page({
  tabId,
  name,
  connection,
  hostApp,
  offline,
  canEdit,
  grant,
  onRename,
  onRemove,
  onConnectAgain,
  className = 'min-h-0 flex-1',
  client = indexClient,
  navigate,
}: ConnectedTabPageProps) {
  const pick = useConnectedTabPick(tabId);
  // The target's picture on the card (IDX38): asked once per connection, going nowhere.
  const preview = useConnectedPreview({ connection, grant, offline, client });
  // A press made just before this page mounted (its code loads on the first connected tab) is still the person's.
  const [first] = useState(() => ({ fresh: pickIsFresh(pick), nonce: pick?.nonce ?? null }));
  const handled = useRef<number | null>(first.fresh ? null : first.nonce);
  const [view, setView] = useState<ConnectedTabView>(() =>
    offline ? { state: 'offline' } : first.fresh ? { state: 'opening' } : { state: 'ready' },
  );
  // The latest name and handlers, read when an answer lands rather than when the open began.
  const latest = useRef({ name, canEdit, onRename });
  useEffect(() => {
    latest.current = { name, canEdit, onRename };
  });
  const inFlight = useRef<AbortController | null>(null);
  // Going cuts off an open still on its way. The press it served is forgotten too, so a page mounted again in place (React's
  // development double mount) takes it afresh rather than turning on "Opening" with nothing behind it.
  useEffect(
    () => () => {
      if (!inFlight.current) return;
      inFlight.current.abort();
      inFlight.current = null;
      handled.current = null;
    },
    [],
  );

  const open = useCallback(async () => {
    inFlight.current?.abort();
    if (offline || isOffline()) {
      setView({ state: 'offline' });
      return;
    }
    const abort = new AbortController();
    inFlight.current = abort;
    setView({ state: 'opening' });
    workbench.track('Tab', 'Opened', 'Connected');
    const held = await grant();
    if (abort.signal.aborted) return;
    if (!held) {
      inFlight.current = null;
      setView({ state: 'failed' });
      return;
    }
    const result = await openConnectedTab({
      client,
      connection,
      grant: held,
      hostApp,
      signal: abort.signal,
      ...(navigate ? { navigate } : {}),
    });
    if (abort.signal.aborted) return;
    inFlight.current = null;
    setConnectedTabBroken(connection.id, isBrokenState(result.view.state));
    setView(result.view);
    const answered = result.open?.name;
    const now = latest.current;
    if (answered && now.canEdit && answered !== now.name) now.onRename(answered);
  }, [client, connection, grant, hostApp, navigate, offline]);

  // A press on the tab the page has not acted on yet: open.
  useEffect(() => {
    if (!pick || pick.nonce === handled.current) return;
    handled.current = pick.nonce;
    void open();
  }, [pick, open]);

  return (
    <div
      data-connected-tab-page={view.state}
      className={`relative bg-slate-50 dark:bg-slate-950 ${className}`}
    >
      <ConnectedTabCard
        view={view}
        name={name}
        app={connection.app}
        canEdit={canEdit}
        away={connection.app !== hostApp}
        preview={preview}
        onOpen={() => void open()}
        onRetry={() => void open()}
        onRemove={onRemove}
        onConnectAgain={onConnectAgain}
      />
    </div>
  );
}
