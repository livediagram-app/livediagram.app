// Clear Styles, offered from the element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md) as well
// as the Quick Style panel: the panel's host (QuickStyleHost) publishes what Clear Styles would clear and how, and the
// menu reads it, so the two run one action rather than two copies of it. A module store: the menu is rendered far
// from the panel's host, and neither should re-render the editor root to reach the other.
import { useSyncExternalStore } from 'react';

export type ClearStyles = {
  // The elements Clear Styles would act on (the Quick Style view's targets).
  targetIds: ReadonlySet<string>;
  clear: () => void;
};

let current: ClearStyles | null = null;
const listeners = new Set<() => void>();

export function publishClearStyles(next: ClearStyles | null): void {
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => current;

/** What Clear Styles would clear and how, or null when nothing selected takes a quick style. */
export function useClearStyles(): ClearStyles | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
