// Whether the open project's last save failed and is waiting on its retry (docs/specs/007-editor/load-recovery.md
// "A failing save stays on screen" and "Leaving with unsaved changes asks first"). The autosave writes it; the
// failing-save banner and the leave prompt read it. A module store, as the page has one open project, so neither
// reader needs it threaded through the canvas's props.
import { useSyncExternalStore } from 'react';

let failing = false;
const listeners = new Set<() => void>();

/** Note whether the last save failed (true) or landed (false). */
export function noteSaveFailing(next: boolean): void {
  if (next === failing) return;
  failing = next;
  for (const l of listeners) l();
}

/** True while the last save failed and has not yet been retried successfully. */
export const isSaveFailing = (): boolean => failing;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** isSaveFailing, re-rendering when it changes. */
export const useSaveFailing = (): boolean =>
  useSyncExternalStore(subscribe, isSaveFailing, () => false);

// A tab over the server's row cap (docs/specs/006-project/per-tab-storage.md "A tab too big to save says so"): not
// retried, so not the banner's "Retrying", but its changes are as unsaved, so leaving asks first all the same.
let tooLarge = false;

/** Note whether the last save was refused as too large (true) or a save has since landed (false). */
export function noteTabTooLarge(next: boolean): void {
  tooLarge = next;
}

/** True while the last save was refused as too large. */
export const isTabTooLarge = (): boolean => tooLarge;
