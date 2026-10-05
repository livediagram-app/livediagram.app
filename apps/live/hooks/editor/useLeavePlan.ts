// Leaving Plan on a tab with content (docs/specs/025-plan/plan-mode.md "Leaving Plan"): a tab with a
// board or anything else on it stays in Plan mode, so a switch away does not happen. It opens a
// question instead, whose answer is a new tab in the mode asked for; the board stays where it is.
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

// Whether a switch from `mode` to `next` stays in Plan: a Plan tab holding anything.
export function planHoldsTab(mode: EditorMode, next: EditorMode, tab: Tab | undefined): boolean {
  return mode === 'plan' && next !== 'plan' && !!tab && tab.elements.length > 0;
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
