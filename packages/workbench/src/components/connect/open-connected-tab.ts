// Opening a connected tab (liveworkspace/docs/specs/004-index/connected-tabs.md "Opening"): ask the index where it
// leads with the host's grant, then go there, in place for the same app and in a new browser tab for another. The
// address always comes from the index, built from the sites registry; nothing on the tab names one.
import type { App, ConnectionOpen, IndexClient, TabConnection } from '@liveworkspace/index-client';
import { connectedTabViewOf, type ConnectedTabView } from './connected-tab-view';

export type OpenConnectedTabResult = {
  view: ConnectedTabView;
  // What the index answered, when it answered: its `name` lets an Editor's editor rename the tab to match (IDX26).
  open: ConnectionOpen | null;
};

// How the browser is told to go; a test hands in its own.
export type Navigator = {
  assign: (href: string) => void;
  openNew: (href: string) => void;
};

const browserNavigator: Navigator = {
  assign: (href) => window.location.assign(href),
  // `noopener`: the other app's page gets no handle back to this one. It also makes `window.open` answer null, so a
  // blocked new tab cannot be told apart: the page offers Open Again either way.
  openNew: (href) => void window.open(href, '_blank', 'noopener'),
};

export async function openConnectedTab({
  client,
  connection,
  grant,
  hostApp,
  signal,
  navigate = browserNavigator,
}: {
  client: Pick<IndexClient, 'openConnection'>;
  connection: TabConnection;
  grant: string;
  hostApp: App;
  signal?: AbortSignal;
  navigate?: Navigator;
}): Promise<OpenConnectedTabResult> {
  let open: ConnectionOpen;
  try {
    open = await client.openConnection(connection.id, grant, signal ? { signal } : {});
  } catch (error) {
    return { view: connectedTabViewOf(error), open: null };
  }
  // A newer open (or the page going) overtook this one: it goes nowhere.
  if (signal?.aborted) return { view: { state: 'failed' }, open: null };
  if (open.app === hostApp) {
    navigate.assign(open.href);
    return { view: { state: 'opening' }, open };
  }
  navigate.openNew(open.href);
  return { view: { state: 'opened', href: open.href }, open };
}
