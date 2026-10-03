// The editor modes offered on this device (docs/specs/007-editor/editor-modes.md "Experimental
// modes"): every mode of the catalogue, less the experimental ones the person has not switched on
// in Settings › Experimental. The editor sets it from the preferences; the mode switch, Opens in,
// Shift+D and the mode resolution all read it, so an experimental mode switched off is offered
// nowhere and a tab stored as opening in it opens in Diagram.
import { useSyncExternalStore } from 'react';
import { EDITOR_MODES, type EditorMode } from '@livediagram/document';

// The modes behind a Settings switch (on by default; switching it off hides the mode).
export const EXPERIMENTAL_EDITOR_MODES: readonly EditorMode[] = ['infographic'];

export function offeredModesFor(infographicEnabled: boolean): readonly EditorMode[] {
  return infographicEnabled
    ? EDITOR_MODES
    : EDITOR_MODES.filter((m) => !EXPERIMENTAL_EDITOR_MODES.includes(m));
}

let offered = offeredModesFor(true);
const listeners = new Set<() => void>();

export function setInfographicModeEnabled(enabled: boolean): void {
  const next = offeredModesFor(enabled);
  if (next.length === offered.length) return;
  offered = next;
  for (const l of listeners) l();
}

/** The offered modes right now, for a handler that runs outside render (Shift+D). */
export function offeredEditorModes(): readonly EditorMode[] {
  return offered;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useOfferedEditorModes(): readonly EditorMode[] {
  return useSyncExternalStore(subscribe, offeredEditorModes, offeredEditorModes);
}
