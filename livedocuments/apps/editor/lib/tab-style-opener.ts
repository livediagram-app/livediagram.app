// Tab Style's door on each page (docs/specs/011-theme/canvas-and-theme-dialog.md "Opening it"): the editor
// registers how the dialog opens (only for someone who may style the tab), and every page's title bar reads it to
// show its Style button. The button that opened the dialog is kept, so the dialog drops from it rather than from the
// bottom-right cluster.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

type Open = () => void;

let open: Open | null = null;
let opener: { el: HTMLElement; at: number } | null = null;
// How long an opening press stays the dialog's opener: long enough for the dialog to mount and read it (twice, in
// React's strict mode), short enough that a later opening another way (the command palette) never reuses it.
const OPENER_FRESH_MS = 1000;
const listeners = createListeners();

/** The editor's side: how Tab Style opens, or null where nobody here may style the tab (a Participant, a
 *  Viewer, an embed). Returns its own clean-up. */
export function registerTabStyleOpen(next: Open | null): () => void {
  open = next;
  listeners.notify();
  return () => {
    if (open !== next) return;
    open = null;
    listeners.notify();
  };
}

/** The title bar's side: how to open Tab Style, or null when it is not offered. */
export function useTabStyleOpen(): Open | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => open,
    () => null,
  );
}

/** Opens Tab Style from `button`, which the dialog then drops from. */
export function openTabStyleFrom(button: HTMLElement | null): void {
  if (!open) return;
  opener = button ? { el: button, at: Date.now() } : null;
  open();
}

/** The button the dialog was just opened from (the dialog reads it as it opens). Null when it was opened another
 *  way (the command palette), not just now, or that button has left the page. */
export function tabStyleOpener(now = Date.now()): HTMLElement | null {
  if (!opener || now - opener.at > OPENER_FRESH_MS) return null;
  return opener.el.isConnected ? opener.el : null;
}
