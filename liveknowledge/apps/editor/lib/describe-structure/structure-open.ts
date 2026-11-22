'use client';

// Whether Describe Structure's dialog is open, and for which page (docs/specs/030-knowledgebase/describe-to-set-up.md
// "Describe Structure on a page"). Opened from the floating page buttons, drawn once by its host, whose dialog code
// is fetched only then.
import { useSyncExternalStore } from 'react';

let open: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null): void {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
}

/** Opens the dialog for the page `tabId`. */
export const openDescribeStructure = (tabId: string): void => set(tabId);
export const closeDescribeStructure = (): void => set(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The page the dialog is open for, or null while it is closed. */
export function useDescribeStructureOpen(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );
}
