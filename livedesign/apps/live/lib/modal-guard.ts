import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

// Shared "a modal dialog is open" flag for the editor's WINDOW-level
// listeners (keyboard shortcuts, paste). The shortcut hooks bail for
// text inputs, but a dialog's buttons / toggles / focus-trapped panel
// are none of those — so with a modal up, pressing `R` dropped a
// rectangle on the canvas behind it, Backspace deleted the selected
// element, and Cmd+V pasted. Stopping propagation at the dialog panel
// isn't reliable across the portal boundary, so the dialogs count
// themselves in here and the global listeners consult the count.
//
// The guided tours read it too, through the hook below (docs/specs/007-editor/pages-tour.md "Dialogs come
// first"): an offer waits while any dialog is open, and a running tour steps aside while one opens over it.
//
// A counter (not a boolean) because dialogs can stack (a confirm on
// top of Settings). Module-level for the same reason as the telemetry
// buffer: one editor design per page, and threading a context through
// every window-listener hook adds plumbing without adding safety.

let openModals = 0;
const listeners = createListeners();

export function modalOpened(): void {
  openModals++;
  listeners.notify();
}

export function modalClosed(): void {
  if (openModals === 0) return;
  openModals--;
  listeners.notify();
}

export function anyModalOpen(): boolean {
  return openModals > 0;
}

// How many modal dialogs are open now (stacked ones each count).
export function openModalCount(): number {
  return openModals;
}

// The count, re-rendering as dialogs open and close.
export function useOpenModalCount(): number {
  return useSyncExternalStore(listeners.subscribe, openModalCount, () => 0);
}

// Whether any modal dialog is open, re-rendering as that changes.
export function useAnyModalOpen(): boolean {
  return useSyncExternalStore(listeners.subscribe, anyModalOpen, () => false);
}
