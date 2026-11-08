import { useSyncExternalStore } from 'react';
import type { Element, Tab } from '@livediagram/document';
import type { UserPreferences } from '@/lib/user-preferences';
import type { ReplayDock } from './topic';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';

// Watch It Built's own state (docs/specs/007-editor/watch-it-built.md "Nothing is kept"): the demo elements, the
// element menu it holds open and its own selection. None of it is ever in the document's tabs; ReplayScope draws it in
// for the canvas and the element menu only, and useEditorState refuses writes while it is active.

export type ReplayState = {
  readonly active: boolean;
  readonly elements: readonly Element[];
  readonly menu: EditorContextMenuState | null;
  // How the tab looks, and the person's preferences, as the canvas sees them while it runs (a look shown, a board
  // background): drawn over the real ones in ReplayScope only.
  readonly tab: Partial<Tab> | null;
  readonly prefs: Partial<UserPreferences> | null;
  // Draw's dock as it shows (lib/replay/replay-dock.ts), likewise.
  readonly dock: ReplayDock | null;
};

const IDLE: ReplayState = Object.freeze({
  active: false,
  elements: [],
  menu: null,
  tab: null,
  prefs: null,
  dock: null,
});

// A demo element's id starts with this, so the fade (globals.css) can tell it from the person's own.
export const DEMO_ID_PREFIX = 'wib-';

let state: ReplayState = IDLE;
const listeners = createListeners();
const selection = createSelectionStore();

export const replayStore = {
  get: (): ReplayState => state,
  subscribe: listeners.subscribe,
  selection,
  set(next: Partial<ReplayState>) {
    const merged = { ...state, ...next };
    if (
      merged.active === state.active &&
      merged.elements === state.elements &&
      merged.menu === state.menu &&
      merged.tab === state.tab &&
      merged.prefs === state.prefs &&
      merged.dock === state.dock
    )
      return;
    state = merged;
    listeners.notify();
  },
  // Ends a run: the demo, its menu and its selection all go.
  reset() {
    selection.setSelection({ selectedId: null, multiSelectedIds: new Set() });
    if (state === IDLE) return;
    state = IDLE;
    listeners.notify();
  },
};

/** True while a replay runs: the document's writes are refused (useEditorState). */
export function isReplayActive(): boolean {
  return state.active;
}

export function useReplayState(): ReplayState {
  return useSyncExternalStore(replayStore.subscribe, replayStore.get, () => IDLE);
}
