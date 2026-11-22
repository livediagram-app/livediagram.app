// Where each connected row in the page tree leads (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files
// in the sidebar"): the index is asked once a row is drawn, once a connection for the session, at most
// CONNECTED_ROW_ASKS at once, so the row is a real link and a row that opens nothing says so before it is pressed.
// Rows read their own answer with useSyncExternalStore (each answer is a stable object), so an answer arriving
// renders the one row it is for.
//
// What it costs: one `GET /connections/<id>` a connected row, a knowledgebase holding at most CONNECTIONS_PER_ITEM
// (50) of them; none for a knowledgebase with no connected row. Answers are kept per knowledgebase for the session,
// for the last CONNECTED_ROW_STORES knowledgebases opened.
import type { ConnectionOpen, IndexClient } from '@liveworkspace/index-client';
import { connectedTabViewOf } from '@liveworkspace/workbench/components/connect/connected-tab-view';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** How many asks of the index run at once. */
export const CONNECTED_ROW_ASKS = 4;
/** How many knowledgebases' answers are kept. */
export const CONNECTED_ROW_STORES = 8;

/** Why a connected row opens nothing. */
export type ConnectedRowBroken = 'gone' | 'link_removed' | 'copy';

export type ConnectedRowState =
  // Not asked yet, or the ask is on its way.
  | { kind: 'asking' }
  | { kind: 'ready'; href: string; name: string }
  | { kind: 'broken'; reason: ConnectedRowBroken }
  // The ask failed for a passing reason (offline, the network, the rate limit): the row stays plain, and pressing it
  // asks again.
  | { kind: 'failed' };

const ASKING: ConnectedRowState = { kind: 'asking' };
const FAILED: ConnectedRowState = { kind: 'failed' };

export type ConnectedRowStore = {
  subscribe: (listener: () => void) => () => void;
  /** The answer for a connection, `asking` until one comes. */
  stateOf: (connectionId: string) => ConnectedRowState;
  /** Ask for a connection unless it has an answer or an ask on its way. */
  request: (connectionId: string) => void;
  /** Ask again (a press on a row whose ask failed, Connect Again) and wait for the answer. */
  resolve: (connectionId: string) => Promise<ConnectedRowState>;
  /** The host's grant for the asks: the newest one the editor holds. */
  setGrant: (grant: () => Promise<string | null>) => void;
};

type OpenClient = Pick<IndexClient, 'openConnection'>;

/** The answer an open makes into a row's state. */
export function rowStateOf(open: ConnectionOpen): ConnectedRowState {
  return { kind: 'ready', href: open.href, name: open.name };
}

export function rowStateOfError(error: unknown): ConnectedRowState {
  const view = connectedTabViewOf(error);
  return view.state === 'gone' || view.state === 'link_removed' || view.state === 'copy'
    ? { kind: 'broken', reason: view.state }
    : FAILED;
}

export function createConnectedRowStore(
  client: OpenClient,
  asks: number = CONNECTED_ROW_ASKS,
): ConnectedRowStore {
  const states = new Map<string, ConnectedRowState>();
  const waiting: string[] = [];
  const pending = new Map<string, Promise<ConnectedRowState>>();
  const done = new Map<string, (state: ConnectedRowState) => void>();
  const listeners = createListeners();
  let running = 0;
  let grantOf: () => Promise<string | null> = async () => null;

  const settle = (id: string, state: ConnectedRowState) => {
    states.set(id, state);
    pending.delete(id);
    done.get(id)?.(state);
    done.delete(id);
    listeners.notify();
  };

  const ask = async (id: string) => {
    try {
      const grant = await grantOf();
      if (!grant) return settle(id, FAILED);
      settle(id, rowStateOf(await client.openConnection(id, grant)));
    } catch (error) {
      settle(id, rowStateOfError(error));
    }
  };

  const pump = () => {
    while (running < asks && waiting.length > 0) {
      const id = waiting.shift()!;
      running += 1;
      void ask(id).finally(() => {
        running -= 1;
        pump();
      });
    }
  };

  const enqueue = (id: string): Promise<ConnectedRowState> => {
    const held = pending.get(id);
    if (held) return held;
    const answer = new Promise<ConnectedRowState>((resolve) => done.set(id, resolve));
    pending.set(id, answer);
    if (states.get(id) !== ASKING) {
      states.set(id, ASKING);
      listeners.notify();
    }
    waiting.push(id);
    pump();
    return answer;
  };

  return {
    subscribe: listeners.subscribe,
    stateOf: (id) => states.get(id) ?? ASKING,
    request: (id) => {
      if (states.has(id) || pending.has(id)) return;
      void enqueue(id);
    },
    resolve: (id) => enqueue(id),
    setGrant: (grant) => {
      grantOf = grant;
    },
  };
}

// The stores of the knowledgebases opened lately, the newest last.
const stores = new Map<string, ConnectedRowStore>();

/** The store for one knowledgebase, made on first use and kept for the session (the last CONNECTED_ROW_STORES). */
export function connectedRowStoreFor(documentId: string, client: OpenClient): ConnectedRowStore {
  const held = stores.get(documentId);
  if (held) {
    stores.delete(documentId);
    stores.set(documentId, held);
    return held;
  }
  const made = createConnectedRowStore(client);
  stores.set(documentId, made);
  while (stores.size > CONNECTED_ROW_STORES) stores.delete(stores.keys().next().value!);
  return made;
}
