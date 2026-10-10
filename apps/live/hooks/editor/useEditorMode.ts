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
import {
  editorModeLabel,
  withEditorModeSwitched,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import { resolveEditorMode, type EditorModeTab } from '@/lib/editor-mode-store';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => void;
  canSwitch: boolean;
  canEdit: boolean;
};

// The telemetry type a switch into each mode fires.
const MODE_EVENT: Record<EditorMode, string> = {
  diagram: 'ModeDiagram',
  draw: 'ModeDraw',
  illustrate: 'ModeIllustrate',
  plan: 'ModePlan',
  facilitate: 'ModeFacilitate',
};

/** Reports a switch into `next`, before it applies (docs/specs/007-editor/editor-modes.md
 *  "Telemetry"): the switch, Shift+D and the tab menu's Mode all send it. */
export function trackModeSwitch(next: EditorMode): void {
  track('Editor', 'Changed', MODE_EVENT[next]);
}

/** The tab switched as one edit: `alsoChange` first, then the mode and what it brings. Whether
 *  entering Illustrate put the board onto a page comes back with it. */
export function switchedTab(
  tab: Tab,
  next: EditorMode,
  alsoChange?: (tab: Tab) => Tab,
): { tab: Tab; pagedContent: boolean } {
  return withEditorModeSwitched(alsoChange ? alsoChange(tab) : tab, next);
}

export function useEditorMode(
  tab: (EditorModeTab & Pick<Tab, 'elements'>) | undefined,
  deps: {
    canEdit: boolean;
    commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
    toastInfo: (message: string) => void;
  },
): EditorModeState {
  const { canEdit, commitTabs, toastInfo } = deps;
  const tabId = tab?.id;
  const { mode, canSwitch } = resolveEditorMode({ tab, canEdit });
  const setMode = useCallback(
    (next: EditorMode, alsoChange?: (tab: Tab) => Tab) => {
      if (!canSwitch || !tabId || next === mode) return;
      trackModeSwitch(next);
      let paged = false;
      commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId) return t;
          const out = switchedTab(t, next, alsoChange);
          paged = out.pagedContent;
          return out.tab;
        }),
      );
      if (paged) {
        toastInfo(`Put onto a page that fits it. Undo switches back to ${editorModeLabel(mode)}.`);
        track('Tab', 'Changed', 'PageFitToContent');
      }
      debugLog('[editor-mode] switched', { tabId, from: mode, to: next, paged });
    },
    [canSwitch, tabId, mode, commitTabs, toastInfo],
  );
  return { mode, setMode, canSwitch, canEdit };
}
