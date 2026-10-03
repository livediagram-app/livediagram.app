// "Opens in" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice
// of the editor mode a general tab opens in. A tab edit like any other (one undo step, synced to
// everyone). It also switches the chooser's own mode on that tab (useEditorMode), so the choice
// visibly lands; nobody else's current mode changes.
import {
  editorModeSwitchable,
  opensInOf,
  setTabOpensIn,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import type { OpensInChoice } from '@/components/chrome/OpensInMenuSection';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export function useTabOpensIn(deps: {
  tabs: Tab[];
  // An editor (not a view-role visitor): only they are offered the choice.
  canEdit: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // The chooser's own mode switch for the active tab (useEditorMode.setMode).
  activeId: string;
  switchMode: (mode: EditorMode) => void;
}) {
  const { tabs, canEdit, commitTabs, activeId, switchMode } = deps;

  const setOpensIn = (tabId: string, mode: EditorMode) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !canEdit || tab.locked) {
      debugLog('[editor-mode] opens-in unchanged', { tabId, mode, locked: tab?.locked === true });
      return;
    }
    // The menu only opens on the active tab; the guard keeps a stale menu from switching another.
    if (tabId === activeId) switchMode(mode);
    if (setTabOpensIn(tab, mode) === tab) {
      debugLog('[editor-mode] opens-in unchanged', { tabId, mode, locked: false });
      return;
    }
    if (mode === 'draw') track('Tab', 'Changed', 'OpensInDraw');
    else track('Tab', 'Changed', 'OpensInDiagram');
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? setTabOpensIn(t, mode) : t)));
    debugLog('[editor-mode] opens-in set', { tabId, mode });
  };

  // The menu's choice for a tab, or nothing where it is not offered.
  const choiceFor = (tab: Tab): OpensInChoice | undefined =>
    canEdit && editorModeSwitchable(tab)
      ? {
          mode: opensInOf(tab),
          onChange: (mode) => setOpensIn(tab.id, mode),
          disabled: tab.locked === true,
        }
      : undefined;

  return { setOpensIn, choiceFor };
}
