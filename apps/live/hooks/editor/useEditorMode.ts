// The editor mode a person works in on a tab (docs/specs/007-editor/editor-modes.md).
//
// Contract:
// - `useEditorMode(tab, { canEdit })` returns `{ mode, setMode, canSwitch }` for that tab.
// - `mode` is the person's remembered choice for the tab, else the tab's opening mode
//   (`tab.opensIn`), else 'diagram'. Event-storming boards are always 'diagram'. A visitor who
//   cannot edit (`canEdit: false`, the view role) always gets the opening mode.
// - `canSwitch` is true only for an editor on a general tab; the mode switch shows only then.
// - `setMode(next)` fires `Editor · Changed · ModeDiagram | ModeDraw` and then applies: it
//   remembers the choice in this browser for this tab (never on the tab itself, so nobody else
//   is affected). A no-op when the switch is not offered or `next` is already the mode.
// - Every caller on the page shares one store: the switch and the editor always agree.
import { useCallback, useSyncExternalStore } from 'react';
import type { EditorMode } from '@livediagram/document';
import {
  readRememberedMode,
  rememberMode,
  resolveEditorMode,
  subscribeEditorModes,
  type EditorModeTab,
} from '@/lib/editor-mode-store';
import { track } from '@/lib/telemetry';

export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode) => void;
  canSwitch: boolean;
};

const noRemembered = () => null;

export function useEditorMode(
  tab: EditorModeTab | undefined,
  { canEdit }: { canEdit: boolean },
): EditorModeState {
  const tabId = tab?.id;
  const remembered = useSyncExternalStore(
    subscribeEditorModes,
    () => (tabId ? readRememberedMode(tabId) : null),
    noRemembered,
  );
  const { mode, canSwitch } = resolveEditorMode({ tab, remembered, canEdit });
  const setMode = useCallback(
    (next: EditorMode) => {
      if (!canSwitch || !tabId || next === mode) return;
      if (next === 'draw') track('Editor', 'Changed', 'ModeDraw');
      else track('Editor', 'Changed', 'ModeDiagram');
      console.info('[editor-mode] switched', { from: mode, to: next });
      rememberMode(tabId, next);
    },
    [canSwitch, tabId, mode],
  );
  return { mode, setMode, canSwitch };
}
