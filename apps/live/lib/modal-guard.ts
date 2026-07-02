// Shared "a modal dialog is open" flag for the editor's WINDOW-level
// listeners (keyboard shortcuts, paste). The shortcut hooks bail for
// text inputs, but a dialog's buttons / toggles / focus-trapped panel
// are none of those — so with a modal up, pressing `R` dropped a
// rectangle on the canvas behind it, Backspace deleted the selected
// element, and Cmd+V pasted. Stopping propagation at the dialog panel
// isn't reliable across the portal boundary, so the dialogs count
// themselves in here and the global listeners consult the count.
//
// A counter (not a boolean) because dialogs can stack (a confirm on
// top of Settings). Module-level for the same reason as the telemetry
// buffer: one editor document per page, and threading a context through
// every window-listener hook adds plumbing without adding safety.

let openModals = 0;

export function modalOpened(): void {
  openModals++;
}

export function modalClosed(): void {
  openModals = Math.max(0, openModals - 1);
}

export function anyModalOpen(): boolean {
  return openModals > 0;
}
