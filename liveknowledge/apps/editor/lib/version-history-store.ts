// Whether Version History is open, and on which tab (docs/specs/006-document/version-history.md "In the editor"):
// the header's History opens it, the panel closes it. Held outside React so the header button and the host that
// draws the panel share it without the page's view-model, and a typing commit renders neither.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type VersionHistoryState = { tabId: string } | null;

let state: VersionHistoryState = null;
const listeners = createListeners();

export function openVersionHistory(tabId: string): void {
  state = { tabId };
  listeners.notify();
}

/** Points the open panel at another tab (its tab picker). Nothing when it is closed. */
export function showVersionsOf(tabId: string): void {
  if (!state || state.tabId === tabId) return;
  state = { tabId };
  listeners.notify();
}

export function closeVersionHistory(): void {
  if (!state) return;
  state = null;
  listeners.notify();
}

export function versionHistoryState(): VersionHistoryState {
  return state;
}

export function useVersionHistoryState(): VersionHistoryState {
  return useSyncExternalStore(listeners.subscribe, versionHistoryState, () => null);
}
