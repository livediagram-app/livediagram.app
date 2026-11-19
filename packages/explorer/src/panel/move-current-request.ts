'use client';

import { useSyncExternalStore } from 'react';

// The editor's ask to move the open item (its Share legend's Team stop, owner 2026-11-19): the Explorer panel opens
// (the editor's useRenameCurrentRequest, from its menu button) and its Current card opens Change Folder on the item,
// the same dialog as its menu's, with the person's spaces and teams. One ask at a time for the page, since an editor
// opens one item: above 0 while it waits, 0 once taken or dropped (the panel closed first, or can't open).

let request = 0;
let seq = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Asks the open item's Current card to open Change Folder. */
export function requestMoveCurrent(): void {
  seq += 1;
  request = seq;
  notify();
}

/** The card took the ask, or it lapsed. */
export function endMoveCurrent(): void {
  if (!request) return;
  request = 0;
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const read = () => request;
const readServer = () => 0;

/** The waiting ask: above 0 while one waits. */
export function useMoveCurrentRequest(): number {
  return useSyncExternalStore(subscribe, read, readServer);
}
