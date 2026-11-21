'use client';

// The item's connections as a message step picks them (liveworkspace/docs/specs/018-automations/automations.md
// "Connections"): read from the index (through the app's index client and the share link the page holds) the first
// time a Send to Webhook, Post to Slack or Post to Microsoft Teams panel opens, once per builder. Add a Connection…
// opens the screen's Connections tab; the builder that opens on the way back reads the list afresh. Connections are
// an account's: a guest is told to sign in instead, and nothing is asked. The builder provides it; the panels read
// it.

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { IndexClient, Webhook } from '@liveworkspace/index-client';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { AutomationsScope } from './kit';

export type ItemConnectionsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signed_out';

export type ItemConnections = {
  status: ItemConnectionsStatus;
  connections: readonly Webhook[];
  // Reads the list the first time it is asked for (a panel opening); later calls do nothing.
  load: () => void;
  // Reads the list again (Try Again after a failed read).
  retry: () => void;
  // Opens the screen's Connections tab, the rule kept for the way back. Absent outside the screen.
  openTab: (() => void) | undefined;
};

const NONE: readonly Webhook[] = [];

export const ItemConnectionsContext = createContext<ItemConnections | null>(null);

export function useItemConnections(): ItemConnections | null {
  return use(ItemConnectionsContext);
}

/** The list's state for one builder, and its reads. */
export function useItemConnectionsState({
  client,
  scope,
  signedIn,
  openTab,
}: {
  client: Pick<IndexClient, 'listWebhooks'>;
  scope: Pick<AutomationsScope, 'itemId' | 'shareCode'>;
  signedIn: boolean;
  openTab?: (() => void) | undefined;
}): ItemConnections {
  const [status, setStatus] = useState<ItemConnectionsStatus>(signedIn ? 'idle' : 'signed_out');
  const [connections, setConnections] = useState<readonly Webhook[]>(NONE);
  const asked = useRef(false);
  const { itemId, shareCode } = scope;
  const read = useCallback(() => {
    setStatus('loading');
    client.listWebhooks(itemId, shareCode ? { code: shareCode } : null).then(
      (got) => {
        setConnections(got.webhooks);
        setStatus('ready');
      },
      (error: unknown) => {
        debugLog('[automations] webhooks.failed', { error: String(error) });
        setStatus('error');
      },
    );
  }, [client, itemId, shareCode]);
  const load = useCallback(() => {
    if (!signedIn || asked.current) return;
    asked.current = true;
    read();
  }, [signedIn, read]);
  return useMemo(
    () => ({ status, connections, load, retry: read, openTab }),
    [status, connections, load, read, openTab],
  );
}

export function ItemConnectionsProvider({
  value,
  children,
}: {
  value: ItemConnections;
  children: ReactNode;
}) {
  return (
    <ItemConnectionsContext.Provider value={value}>{children}</ItemConnectionsContext.Provider>
  );
}
