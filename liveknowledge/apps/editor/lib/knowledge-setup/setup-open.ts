'use client';

// Whether Describe to Set Up is open, and which way (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// control"): `set-up` from the sidebar of an empty knowledgebase, `add` from Describe to Add Pages. Opened from
// anywhere, drawn once by the setup host, whose dialog code is fetched only then.
import { useSyncExternalStore } from 'react';

export type SetupMode = 'set-up' | 'add';

let mode: SetupMode | null = null;
const listeners = new Set<() => void>();

function set(next: SetupMode | null): void {
  if (mode === next) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

export const openSetup = (next: SetupMode): void => set(next);
export const closeSetup = (): void => set(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The way the dialog is open, or null while it is closed. */
export function useSetupOpen(): SetupMode | null {
  return useSyncExternalStore(
    subscribe,
    () => mode,
    () => null,
  );
}

// What this session is offered (components/setup/useSetupOffered.ts), published by the setup host so the command
// palette can list Describe to Add Pages without reading the editor's store itself.
let offered: SetupMode | null = null;
const offeredListeners = new Set<() => void>();

export function publishSetupOffered(next: SetupMode | null): void {
  if (offered === next) return;
  offered = next;
  offeredListeners.forEach((listener) => listener());
}

const subscribeOffered = (listener: () => void) => {
  offeredListeners.add(listener);
  return () => offeredListeners.delete(listener);
};

/** The published offer: null until the setup host is on the page. */
export function usePublishedSetupOffered(): SetupMode | null {
  return useSyncExternalStore(
    subscribeOffered,
    () => offered,
    () => null,
  );
}
