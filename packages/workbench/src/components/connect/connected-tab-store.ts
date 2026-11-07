'use client';

// What the tab bar and a connected tab's page tell each other (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Opening", "How it looks"), across the editor without threading props through it:
//
// - a person's press on a connected tab, so its page opens the file only then, never because the tab became the open
//   one by a load, a connect, undo or a peer (`pickConnectedTab`, `useConnectedTabPick`);
// - which connections the last open found broken, for the tab's amber dot and its menu's Connect Again
//   (`setConnectedTabBroken`, `useConnectedTabBroken`, `connectedTabBroken`).
//
// One page-wide store: a few entries a document (at most CONNECTIONS_PER_ITEM broken ids, one pick per tab pressed),
// read with useSyncExternalStore so only the tab and page named re-render.
import { useCallback, useSyncExternalStore } from 'react';

// How long a press waits for its page to mount and take it (the page's code loads on the first connected tab): a press
// older than this is not taken by a page that mounts later, so a stale press never opens a file unasked.
export const CONNECTED_PICK_FRESH_MS = 10_000;

type Pick = { nonce: number; at: number };

const picks = new Map<string, Pick>();
const broken = new Set<string>();
const listeners = new Set<() => void>();
let nonce = 0;

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A person pressed this connected tab (the open one included): its page opens the file. */
export function pickConnectedTab(tabId: string, now: number = Date.now()): void {
  nonce += 1;
  picks.set(tabId, { nonce, at: now });
  notify();
}

/** The latest press on this tab, or null: a page opens when it sees one it has not acted on. */
export function useConnectedTabPick(tabId: string): Pick | null {
  const read = useCallback(() => picks.get(tabId) ?? null, [tabId]);
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Whether a press is recent enough for a page that has just mounted to act on it. */
export const pickIsFresh = (pick: Pick | null, now: number = Date.now()): boolean =>
  pick !== null && now - pick.at <= CONNECTED_PICK_FRESH_MS;

/** The last open said this connection opens nothing (gone, its link removed, a copy's), or that it opens again. */
export function setConnectedTabBroken(connectionId: string, isBroken: boolean): void {
  if (broken.has(connectionId) === isBroken) return;
  if (isBroken) broken.add(connectionId);
  else broken.delete(connectionId);
  notify();
}

/** Whether the last open found this connection broken, read once (a menu building its rows). */
export const connectedTabBroken = (connectionId: string): boolean => broken.has(connectionId);

/** Whether the last open found this connection broken, kept current (the tab's amber dot). */
export function useConnectedTabBroken(connectionId: string): boolean {
  const read = useCallback(() => broken.has(connectionId), [connectionId]);
  return useSyncExternalStore(subscribe, read, () => false);
}

export function resetConnectedTabStoreForTests(): void {
  picks.clear();
  broken.clear();
  nonce = 0;
  notify();
}
