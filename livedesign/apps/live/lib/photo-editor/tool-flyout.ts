// Whether the tool in hand's options flyout is open (docs/specs/031-photo/photo-pages.md "The options flyout"):
// pressing the button of the tool already in hand opens or closes it; taking another tool (its button, its group's
// menu) closes it, and so do a press on the photo (the tool's own press), Escape and putting the tool down. A tool
// taken by its key leaves it as it is.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (next === open) return;
  open = next;
  for (const fn of listeners) fn();
}

export const toolFlyout = {
  isOpen: (): boolean => open,
  open: (): void => set(true),
  close: (): void => set(false),
  toggle: (): void => set(!open),
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useToolFlyoutOpen(): boolean {
  return useSyncExternalStore(toolFlyout.subscribe, toolFlyout.isOpen, () => false);
}
