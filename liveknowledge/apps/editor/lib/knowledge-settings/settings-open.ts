'use client';

// Whether Knowledgebase Settings is open (docs/specs/030-knowledgebase/verification.md "The Review Period"), and
// whether this session is offered it. Opened from anywhere (Page Health's link, the command palette, the
// knowledgebase menu's row), drawn once by its host, whose dialog code is fetched only then.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export const openKnowledgeSettings = (): void => set(true);
export const closeKnowledgeSettings = (): void => set(false);
/** Whether it is open now, for a caller outside React. */
export const isKnowledgeSettingsOpen = (): boolean => open;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useKnowledgeSettingsOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

// Whether this session may change the settings (components/knowledge-settings/useSettingsOffered.ts), published by
// the host so the command palette can list the command without reading the editor's store itself.
let offered = false;
const offeredListeners = new Set<() => void>();

export function publishKnowledgeSettingsOffered(next: boolean): void {
  if (offered === next) return;
  offered = next;
  offeredListeners.forEach((listener) => listener());
}

const subscribeOffered = (listener: () => void) => {
  offeredListeners.add(listener);
  return () => offeredListeners.delete(listener);
};

/** The published offer: false until the host is on the page. */
export function usePublishedKnowledgeSettingsOffered(): boolean {
  return useSyncExternalStore(
    subscribeOffered,
    () => offered,
    () => false,
  );
}
