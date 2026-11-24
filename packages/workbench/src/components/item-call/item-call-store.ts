// The open item's calls, for its Call button, its "3 in Call" pill and its Meetings (liveworkspace/docs/specs/004-index/
// item-calls.md): read once when the editor opens the item, then again only when the item's room says its calls
// changed (the `source-changed` frame with `calls`), when the tab comes back into view, or after a start from here.
// Never polled. A module-level store, as the send store is: one editor runs per page, and the button (the corner
// card) and the host (beside the editor) sit far apart in the tree.
import { useSyncExternalStore } from 'react';
import type { App, ItemCallsRead, ShareAccess } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { onSourceChanged } from '../sheet-links/sheet-link-signal';

type Reader = Pick<typeof indexClient, 'itemCalls'>;

/** The item the editor has open, as the call button needs it. */
export type CallSource = {
  app: App;
  id: string;
  title: string;
  share: ShareAccess | null;
  // An account may start a call; anyone who can read the item may join one.
  canStart: boolean;
};

export type ItemCallState = { source: CallSource | null; read: ItemCallsRead | null };

const EMPTY: ItemCallState = { source: null, read: null };

let source: CallSource | null = null;
let reader: Reader = indexClient;
let state: ItemCallState = EMPTY;
let reading: AbortController | null = null;
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

const tell = (read: ItemCallsRead | null) => {
  state = { source, read };
  for (const l of [...listeners]) l();
};

/** Reads the open item's calls again; a read still running is dropped for this one. */
export async function refreshItemCalls(): Promise<void> {
  const from = source;
  if (!from) return;
  reading?.abort();
  const abort = new AbortController();
  reading = abort;
  try {
    const read = await reader.itemCalls(from.id, { share: from.share, signal: abort.signal });
    if (source?.id !== from.id || abort.signal.aborted) return;
    tell(read);
  } catch {
    // Offline, signed out or refused: what the item showed stays until the next read.
  } finally {
    if (reading === abort) reading = null;
  }
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void refreshItemCalls();
};

/** The editor's item, whose calls the button shows; null when it closes (or cannot call: Offline, embed, Community). */
export function setCallSource(next: CallSource | null, read: Reader = indexClient): void {
  const same =
    source !== null &&
    next !== null &&
    source.id === next.id &&
    source.share?.code === next.share?.code &&
    source.canStart === next.canStart &&
    source.title === next.title &&
    source.app === next.app;
  if (same) return;
  const sameItem = source?.id === next?.id && source?.share?.code === next?.share?.code;
  source = next;
  reader = read;
  if (sameItem) {
    tell(state.read);
    return;
  }
  reading?.abort();
  stopListening?.();
  stopListening = null;
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
  tell(null);
  if (!next) return;
  stopListening = onSourceChanged((signal) => {
    if (signal.calls) void refreshItemCalls();
  });
  document.addEventListener('visibilitychange', onVisible);
  void refreshItemCalls();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The open item and its calls; `read` is null until the first read lands. */
export function useItemCalls(): ItemCallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}
