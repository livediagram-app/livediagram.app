// The editor modes offered on this device (docs/specs/007-editor/editor-modes.md "Experimental
// modes"): every mode of the catalogue, less the experimental ones the person has not switched on
// in Settings › Experimental. The editor sets it from the preferences; the mode switch, Opens in,
// Shift+D and the mode resolution all read it, so an experimental mode switched off is offered
// nowhere and a tab stored as opening in it opens in Diagram.
import { useSyncExternalStore } from 'react';
import { EDITOR_MODES, type EditorMode } from '@livediagram/document';

// The modes behind a Settings switch each (on by default; switching one off hides that mode).
export const EXPERIMENTAL_EDITOR_MODES = [
  'illustrate',
  'plan',
] as const satisfies readonly EditorMode[];
export type ExperimentalEditorMode = (typeof EXPERIMENTAL_EDITOR_MODES)[number];

// Which experimental modes are switched on; a mode not named is on.
export type ExperimentalModeFlags = Partial<Record<ExperimentalEditorMode, boolean>>;

export function offeredModesFor(flags: ExperimentalModeFlags): readonly EditorMode[] {
  return EDITOR_MODES.filter((m) => flags[m as ExperimentalEditorMode] !== false);
}

let flags: ExperimentalModeFlags = {};
let offered = offeredModesFor(flags);
const listeners = new Set<() => void>();

export function setExperimentalModeEnabled(mode: ExperimentalEditorMode, enabled: boolean): void {
  if ((flags[mode] !== false) === enabled) return;
  flags = { ...flags, [mode]: enabled };
  offered = offeredModesFor(flags);
  for (const l of listeners) l();
}

export function setIllustrateModeEnabled(enabled: boolean): void {
  setExperimentalModeEnabled('illustrate', enabled);
}

// Plan mode (docs/specs/025-plan/plan-mode.md "Offering the mode"): its own switch, apart from Illustrate's.
export function setPlanModeEnabled(enabled: boolean): void {
  setExperimentalModeEnabled('plan', enabled);
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
