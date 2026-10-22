// The tab's editor mode in the editor (docs/specs/007-editor/editor-modes.md "Where the mode
// lives").
//
// Contract:
// - `useEditorMode(tab, { canEdit, commitTabs, toastInfo })` returns `{ mode, setMode, canSwitch,
//   canEdit }` for the active tab. `canEdit` comes from the editor's one answer (useViewPreview)
//   and is handed back, so the switch reads the very value the editor resolved with.
// - `mode` is the tab's own mode (resolveEditorMode), the same for everyone on it.
// - `canSwitch` is true only for an editor on a general, unlocked tab; the mode switch shows only
//   then.
// - `setMode(next, alsoChange?)` fires `Editor · Changed · Mode<Next>` and then commits ONE tab edit:
//   `alsoChange` (what leaving a mode brings, such as articles turned into pages), then the mode
//   with what entering it brings (withEditorModeSwitched). One undo puts the tab back in the mode
//   it was in, for everyone. A no-op when the switch is not offered or `next` is already the mode.
import { useCallback } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  crossesPlan,
  editorModeLabel,
  withEditorModeSwitched,
  type EditorMode,
  type Tab,
} from '@livepages/document';
import { resolveEditorMode } from '@/lib/editor-mode-store';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
  // The tab keeps its mode, for this reason (resolveEditorMode): picking another offers a new tab in it instead.
  lockedReason?: string;
  newTabIn?: (mode: EditorMode) => void;
  // The tab is empty, so it may cross into or out of Plan: with nothing on it there is nothing either side's tools
  // could not hold (docs/specs/007-editor/editor-modes.md "Plan stands apart").
  crossPlan?: boolean;
};

// The telemetry type a switch into each mode fires.
const MODE_EVENT: Record<EditorMode, string> = {
  diagram: 'ModeDiagram',
  draw: 'ModeDraw',
  pages: 'ModePages',
  plan: 'ModePlan',
  workshop: 'ModeWorkshop',
};

/** Reports a switch into `next`, before it applies (docs/specs/007-editor/editor-modes.md
 *  "Telemetry"): the switch, Shift+D and the tab menu's Mode all send it. */
export function trackModeSwitch(next: EditorMode): void {
  track('Editor', 'Changed', MODE_EVENT[next]);
}

/** The tab switched as one edit: `alsoChange` first, then the mode and what it brings. Whether
 *  entering Pages put the board onto a page comes back with it. */
export function switchedTab(
  tab: Tab,
  next: EditorMode,
  alsoChange?: (tab: Tab) => Tab,
): { tab: Tab; pagedContent: boolean } {
  return withEditorModeSwitched(alsoChange ? alsoChange(tab) : tab, next);
}

export function useEditorMode(
  tab: Tab | undefined,
  deps: {
    canEdit: boolean;
    commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
    toastInfo: (message: string) => void;
    // A new tab in a mode: what a mode picked on a tab that cannot switch offers instead (plan-tabs.md).
    newTabIn?: (mode: EditorMode) => void;
  },
): EditorModeState {
  const { canEdit, commitTabs, toastInfo } = deps;
  const tabId = tab?.id;
  const { mode, canSwitch, lockedReason } = resolveEditorMode({ tab, canEdit });
  const crossPlan = canSwitch && (tab?.elements.length ?? 0) === 0;
  // The tab as it is now, read when a switch is asked for: a stable setter rather than a new one per edit of the tab.
  const tabRef = useLatest(tab);
  const setMode = useCallback(
    (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => {
      // Never into or out of Plan (crossesPlan) unless the tab is empty: the mode menu offers a new tab in it instead.
      if (!canSwitch || !tabId || next === mode || (crossesPlan(mode, next) && !crossPlan)) return;
      trackModeSwitch(next);
      // Whether the board goes onto a page is read from the tab as it is, not from inside the commit's updater,
      // which React may run after this returns (the toast and its event would be lost). The switch worked out
      // here is the one committed, unless the tab moved on meanwhile: a board's transform, layout and fit once.
      const seen = tabRef.current;
      const out = seen ? switchedTab(seen, next, alsoChange) : null;
      const paged = !!out?.pagedContent;
      commitTabs((ts) =>
        ts.map((t) =>
          t.id !== tabId ? t : t === seen && out ? out.tab : switchedTab(t, next, alsoChange).tab,
        ),
      );
      if (paged) {
        toastInfo(`Put onto a page that fits it. Undo switches back to ${editorModeLabel(mode)}.`);
        track('Tab', 'Changed', 'PageFitToContent');
      }
      debugLog('[editor-mode] switched', { tabId, from: mode, to: next, paged });
    },
    [canSwitch, crossPlan, tabRef, tabId, mode, commitTabs, toastInfo],
  );
  return {
    mode,
    setMode,
    canSwitch,
    canEdit,
    ...(lockedReason ? { lockedReason } : {}),
    ...(crossPlan ? { crossPlan } : {}),
    ...(deps.newTabIn ? { newTabIn: deps.newTabIn } : {}),
  };
}
