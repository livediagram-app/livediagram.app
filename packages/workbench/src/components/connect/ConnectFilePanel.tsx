'use client';

// Connect liveworkspace File, in a start screen's content area (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Connecting"): a heading over the shared ConnectPicker, which an editor mounts only once the person chooses the
// entry (its one read of Recent starts then). Each press runs connectFile with the host's grant and the editor's own
// tab add; the editor then moves to the new tab. Times read "Opened 2 minutes ago" against one minute's clock, cleared
// when the list goes.
import { useEffect, useState } from 'react';
import type { App, ConnectionMade, IndexClient, Item } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { workbench } from '../../bindings';
import { connectFile } from './connect-file';
import { ConnectPicker, type ConnectChoice, type ConnectInk } from './ConnectPicker';
import { appName } from './connect-words';

// How often "Opened 2 minutes ago" is measured again while the list shows. Safe range: 15 s to 5 minutes.
export const CONNECT_CLOCK_MS = 60_000;

/** A clock that ticks every `everyMs` while mounted: one interval, cleared on unmount. */
export function useTickingNow(everyMs: number = CONNECT_CLOCK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export type ConnectFilePanelProps = {
  hostId: string;
  hostApp: App;
  // The host's kind in words: "diagram", "plan".
  hostKind: string;
  // The person may manage the host's links (its owner, or a member of its team): both ways needs it.
  hostManaged: boolean;
  // The host's connected tabs: target item id to the tab holding it.
  connected: ReadonlyMap<string, string>;
  ink?: ConnectInk;
  // The host's grant at `edit` (X-Index-Grant), null when the index refused or could not be reached.
  grant: () => Promise<string | null>;
  // A fresh tab id, minted by the editor as it mints any.
  newTabId: () => string;
  // The editor's whole-tab save of the new tab (`tabId`, named `made.name`, holding `made.connection`) at the end of
  // the bar. Throws when it fails, and the connection is taken back.
  addTab: (made: ConnectionMade, tabId: string) => Promise<void>;
  // Connected: the editor makes the new tab the open one, and says when the other file could not be reached.
  onConnected: (tabId: string, made: ConnectionMade) => void;
  onGoTo: (tabId: string) => void;
  onOpenExplorer?: () => void;
  client?: Pick<IndexClient, 'listItems' | 'makeConnection' | 'takeBackConnection'>;
};

export function ConnectFilePanel({
  hostId,
  hostApp,
  hostKind,
  hostManaged,
  connected,
  ink,
  grant,
  newTabId,
  addTab,
  onConnected,
  onGoTo,
  onOpenExplorer,
  client = indexClient,
}: ConnectFilePanelProps) {
  const now = useTickingNow();
  const onConnect = async (item: Item, choice: ConnectChoice) => {
    const held = await grant();
    // connectErrorWords' network line: the grant is the index's, so a missing one is the index out of reach.
    if (!held) throw new Error('no grant');
    const tabId = newTabId();
    const made = await connectFile({
      client,
      hostId,
      grant: held,
      tabId,
      targetId: item.id,
      level: choice.level,
      both: choice.both,
      addTab: (answer) => addTab(answer, tabId),
    });
    workbench.track('Tab', 'Added', choice.both ? 'ConnectedBoth' : 'Connected');
    onConnected(tabId, made);
  };
  return (
    <section aria-labelledby="connect-file-title" data-connect-file="">
      <h3 id="connect-file-title" className="text-[16px] font-semibold">
        Connect liveworkspace File
      </h3>
      <p
        className="mb-4 mt-0.5 text-[13px] max-sm:mb-3"
        style={ink ? { color: ink.muted } : undefined}
      >
        Add a tab that opens a file from {appName(hostApp)} or any other liveworkspace app.
      </p>
      <ConnectPicker
        client={client}
        hostId={hostId}
        hostKind={hostKind}
        hostManaged={hostManaged}
        connected={connected}
        {...(ink ? { ink } : {})}
        now={now}
        onConnect={onConnect}
        onGoTo={onGoTo}
        {...(onOpenExplorer ? { onOpenExplorer } : {})}
      />
    </section>
  );
}
