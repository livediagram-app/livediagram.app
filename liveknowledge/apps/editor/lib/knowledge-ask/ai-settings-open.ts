'use client';

// Whether the AI Settings dialog is open (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): opened from the Ask
// view and from AI Knowledge, drawn once by the views' host.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export const openAiSettings = (): void => setOpen(true);
export const closeAiSettings = (): void => setOpen(false);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useAiSettingsOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
