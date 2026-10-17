// Whether the open document's last save failed and is waiting on its retry (docs/specs/007-editor/load-recovery.md
// "A failing save stays on screen" and "Leaving with unsaved changes asks first"). The autosave writes it; the
// failing-save banner and the leave prompt read it. A module store, as the page has one open document, so neither
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
