// The editor mode a person works in on a tab (docs/specs/007-editor/editor-modes.md).
//
// Contract:
// - `useEditorMode(tab, { canEdit })` returns `{ mode, setMode, canSwitch, canEdit }` for that tab.
//   `canEdit` comes from the editor's one answer (useViewPreview) and is handed back, so the switch
//   reads the very value the editor resolved with.
// - `mode` is the person's remembered choice for the tab, else the mode the tab opened in on
//   this page (usePinTabOpening), else the tab's opening mode (`tab.opensIn`), else 'diagram'. Event-storming boards are always 'diagram'. A visitor who
//   cannot edit (`canEdit: false`, the view role) always gets the opening mode.
// - `canSwitch` is true only for an editor on a general tab; the mode switch shows only then.
// - `setMode(next)` fires `Editor · Changed · ModeDiagram | ModeDraw` and then applies: it
//   remembers the choice in this browser for this tab (never on the tab itself, so nobody else
//   is affected). A no-op when the switch is not offered or `next` is already the mode.
// - Every caller on the page shares one store: the switch and the editor always agree.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isEditorMode, opensInOf, type EditorMode } from '@livediagram/document';
import {
  openedMode,
  pinOpening,
  readRememberedMode,
  rememberMode,
  resolveEditorMode,
  subscribeEditorModes,
  type EditorModeTab,
} from '@/lib/editor-mode-store';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type EditorModeState = {
  mode: EditorMode;
  setMode: (next: EditorMode) => void;
  canSwitch: boolean;
  canEdit: boolean;
};

const nothingStored = () => '|';
const modeOrNull = (v: string | undefined): EditorMode | null => (isEditorMode(v) ? v : null);

export function useEditorMode(
  tab: EditorModeTab | undefined,
  { canEdit }: { canEdit: boolean },
): EditorModeState {
  const tabId = tab?.id;
  // One primitive snapshot of both stored values, so the store re-renders only on a change.
  const stored = useSyncExternalStore(
    subscribeEditorModes,
    () => (tabId ? `${readRememberedMode(tabId) ?? ''}|${openedMode(tabId) ?? ''}` : '|'),
    nothingStored,
  );
  const [remembered, opened] = stored.split('|').map(modeOrNull) as [
    EditorMode | null,
    EditorMode | null,
  ];
  const { mode, canSwitch } = resolveEditorMode({ tab, remembered, opened, canEdit });
  const setMode = useCallback(
    (next: EditorMode) => {
      if (!canSwitch || !tabId || next === mode) return;
      if (next === 'draw') track('Editor', 'Changed', 'ModeDraw');
      else track('Editor', 'Changed', 'ModeDiagram');
      debugLog('[editor-mode] switched', { from: mode, to: next });
      rememberMode(tabId, next);
    },
    [canSwitch, tabId, mode],
  );
  return { mode, setMode, canSwitch, canEdit };
}

// Pins the mode a tab opened in, once its content has loaded (before then a placeholder carries no
// opening mode): from then on an Opens in change, by anyone, switches nobody on this page. Called
// once, by the editor, for the active tab.
export function usePinTabOpening(tab: EditorModeTab | undefined, loaded: boolean): void {
  const tabId = tab?.id;
  const opening = opensInOf(tab);
  // Read so a release (a template deciding afresh) re-pins on the next render.
  const pinned = useSyncExternalStore(
    subscribeEditorModes,
    () => (tabId ? openedMode(tabId) : null),
    () => null,
  );
  useEffect(() => {
    if (tabId && loaded && pinned === null) pinOpening(tabId, opening);
  }, [tabId, loaded, opening, pinned]);
}
