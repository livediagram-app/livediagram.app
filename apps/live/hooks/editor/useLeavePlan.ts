// Plan holds its tabs, both ways (docs/specs/026-plan/plan-mode.md "Plan keeps its own tabs"): a Plan
// tab with anything on it stays in Plan, and a tab in another mode with anything on it does not
// become a Plan tab. The switch does not happen; a question opens instead, whose answer is a new tab
// in the mode asked for, and the tab stays as it is.
// An empty tab, and a visitor (whose mode is the tab's anyway), switch straight away.
import { useCallback, useState } from 'react';
import type { EditorMode, Tab } from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type LeavePlan = {
  // The mode asked for while the question is open.
  blocked: EditorMode | null;
  newTab: () => void;
  cancel: () => void;
};

// Whether a switch from `mode` to `next` crosses Plan's line on a tab holding anything.
export function planHoldsTab(mode: EditorMode, next: EditorMode, tab: Tab | undefined): boolean {
  const crosses = mode !== next && (mode === 'plan' || next === 'plan');
  return crosses && !!tab && tab.elements.length > 0;
}

export function useLeavePlan<M extends { mode: EditorMode; setMode: (m: EditorMode) => void }>(
  editorMode: M,
  deps: {
    tab: Tab | undefined;
    canEdit: boolean;
    // Adds a tab that opens in a mode, and makes it the active tab.
    addTabIn: (mode: EditorMode) => void;
  },
): { editorMode: M; leavePlan: LeavePlan } {
  const { tab, canEdit, addTabIn } = deps;
  const [blocked, setBlocked] = useState<EditorMode | null>(null);
  const { mode, setMode: rawSet } = editorMode;
  const setMode = useCallback(
    (next: EditorMode) => {
      if (canEdit && planHoldsTab(mode, next, tab)) {
        debugLog('[editor-mode] plan holds the tab', { tabId: tab?.id, asked: next });
        setBlocked(next);
      } else rawSet(next);
    },
    [mode, rawSet, canEdit, tab],
  );
  const newTab = () => {
    if (blocked) {
      track('Tab', 'Created');
      addTabIn(blocked);
    }
    setBlocked(null);
  };
  const cancel = () => setBlocked(null);
  return { editorMode: { ...editorMode, setMode }, leavePlan: { blocked, newTab, cancel } };
}
