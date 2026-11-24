'use client';

// Whether the AI Editing dialog is open (docs/specs/030-knowledgebase/ai-editing.md "The dialog"): opened from the
// knowledgebase's menu, drawn once by the editor's dialogs.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export const openAiEditing = (): void => setOpen(true);
export const closeAiEditing = (): void => setOpen(false);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useAiEditingOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
