// "Opens in" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice
// of the editor mode a general tab opens in. A tab edit like any other (one undo step, synced to
// everyone); it never switches anyone's current mode, the chooser's included,
// since that mode is the person's own (useEditorMode).
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
}) {
  const { tabs, canEdit, commitTabs } = deps;

  const setOpensIn = (tabId: string, mode: EditorMode) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !canEdit || tab.locked || setTabOpensIn(tab, mode) === tab) {
      debugLog('[editor-mode] opens-in unchanged', { tabId, mode, locked: tab?.locked === true });
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
