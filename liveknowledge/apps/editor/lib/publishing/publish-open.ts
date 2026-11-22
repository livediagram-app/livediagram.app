'use client';

// Whether Publish to the Web is open (docs/specs/030-knowledgebase/publishing.md "The dialog"): opened from the
// knowledgebase's menu, drawn once by the editor's dialogs.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export const openPublishing = (): void => setOpen(true);
export const closePublishing = (): void => setOpen(false);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePublishingOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
