// The tab menu's "Mode" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab's
// editor mode, the same for everyone, chosen from its menu. Choosing one switches the tab exactly as
// the mode switch does (one tab edit, one undo step): the active tab through the editor's own
// switch, so leaving Illustrate asks first as it does there; another tab directly.
import { editorModeSwitchable, opensInOf, type EditorMode, type Tab } from '@livediagram/document';
import type { TabModeChoice } from '@/components/chrome/TabModeMenuRows';
import { debugLog } from '@/lib/debug-log';
import { switchedTab, trackModeSwitch } from './useEditorMode';

export function useTabModeMenu(deps: {
  // An editor (not a view-role visitor): only they are offered the choice.
  canEdit: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  activeId: string;
  // The editor's own switch for the active tab (useEditorMode, with useLeaveIllustrate's questions).
  switchActive: (mode: EditorMode) => void;
}) {
  const { canEdit, commitTabs, activeId, switchActive } = deps;

  const switchTab = (tab: Tab, mode: EditorMode) => {
    if (opensInOf(tab) === mode) return;
    if (tab.id === activeId) {
      switchActive(mode);
      return;
    }
    trackModeSwitch(mode);
    commitTabs((ts) => ts.map((t) => (t.id === tab.id ? switchedTab(t, mode).tab : t)));
    debugLog('[editor-mode] switched from the tab menu', { tabId: tab.id, mode });
  };

  // The menu's choice for a tab, or nothing where it is not offered.
  const choiceFor = (tab: Tab): TabModeChoice | undefined =>
    canEdit && editorModeSwitchable(tab) && tab.locked !== true
      ? { mode: opensInOf(tab), onChange: (mode) => switchTab(tab, mode) }
      : undefined;

  return { choiceFor };
}
