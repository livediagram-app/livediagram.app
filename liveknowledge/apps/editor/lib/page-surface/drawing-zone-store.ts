// Whether a drawing zone of the open page is being edited (docs/specs/030-knowledgebase/page-surface.md "The
// formatting bar"): the drawing tools show only then, in the formatting bar's place. Set by the writing (the zone a
// zone bar is for), read by the chrome; a plain store, so neither renders the other.
import { useSyncExternalStore } from 'react';

let editing = false;
const listeners = new Set<() => void>();

export function setDrawingZoneEditing(next: boolean): void {
  if (next === editing) return;
  editing = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDrawingZoneEditing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => editing,
    () => false,
  );
}
