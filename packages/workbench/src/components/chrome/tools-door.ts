'use client';

// Rows a host adds to the footer's Tools popover from outside the footer's tree (liveworkspace/docs/specs/004-index/
// footer-tools-menu.md): the editor's Explorer host offers Webhooks and History for the open item, which the tab bar
// knows nothing about. A module store keyed by who published, so each host replaces its own rows and clears them as
// it unmounts; ChromeToolsMenu reads them beside the rows it is handed.
import { useEffect, useSyncExternalStore } from 'react';
import type { ChromeToolsItem } from './ChromeToolsMenu';

const published = new Map<string, readonly ChromeToolsItem[]>();
let snapshot: readonly ChromeToolsItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...published.values()].flat();
  for (const l of listeners) l();
}

/** Puts `items` in Tools under `key` while the caller is mounted (an empty list clears them). */
export function usePublishToolsItems(key: string, items: readonly ChromeToolsItem[]): void {
  useEffect(() => {
    if (items.length) published.set(key, items);
    else published.delete(key);
    emit();
    return () => {
      published.delete(key);
      emit();
    };
  }, [key, items]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const NONE: readonly ChromeToolsItem[] = [];

/** Every row published from outside the footer. */
export function useToolsDoorItems(): readonly ChromeToolsItem[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => NONE,
  );
}

// Asking Tools to open at a tool from outside the footer (footer-tools-menu.md "From elsewhere"; blueprint FM7): coming
// back from signing in with a tool asked open. One ask at a time, kept a while so a row that arrives a moment after
// the page (its door waits on the plan) still finds it; Tools takes it once it lists that row.
export const TOOLS_REQUEST_TTL_MS = 20_000;
export type ToolsViewRequest = { id: string; at: number };
let request: ToolsViewRequest | null = null;
const requestListeners = new Set<() => void>();

function emitRequest(next: ToolsViewRequest | null) {
  request = next;
  for (const l of requestListeners) l();
}

export function requestToolsView(id: string, now = Date.now()): void {
  emitRequest({ id, at: now });
}

/** Tools took the ask (or it went stale). */
export function takeToolsView(asked: ToolsViewRequest): void {
  if (request === asked) emitRequest(null);
}

const subscribeRequests = (l: () => void) => {
  requestListeners.add(l);
  return () => {
    requestListeners.delete(l);
  };
};

/** The ask waiting for Tools, or null. */
export function useToolsViewRequest(): ToolsViewRequest | null {
  return useSyncExternalStore(
    subscribeRequests,
    () => request,
    () => null,
  );
}
