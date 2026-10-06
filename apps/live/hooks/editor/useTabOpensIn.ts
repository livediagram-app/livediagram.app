// "Opens in" (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the tab menu's choice
// of the editor mode a general tab opens in. A tab edit like any other (one undo step, synced to
// everyone). It also switches the chooser's own mode on that tab (useEditorMode), so the choice
// visibly lands; nobody else's current mode changes. The other way round, an editor's own switch
// moves the tab's Opens in with it (useSwitchSetsOpensIn), so the menu always matches the tab.
import {
  editorModeSwitchable,
  opensInOf,
  setTabOpensIn,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import type { OpensInChoice } from '@/components/chrome/OpensInMenuSection';
import { useCallback } from 'react';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

// The telemetry type an Opens in choice of each mode fires.
const OPENS_IN_EVENT: Record<EditorMode, string> = {
  diagram: 'OpensInDiagram',
  draw: 'OpensInDraw',
  illustrate: 'OpensInIllustrate',
  plan: 'OpensInPlan',
};

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
    track('Tab', 'Changed', OPENS_IN_EVENT[mode]);
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

/**
 * The editor mode with its switch also setting the tab's Opens in (docs/specs/007-editor/editor-modes.md
 * "Where the mode lives"): for an editor on a general, unlocked tab, a switch writes the tab's opening
 * mode too, as a consequence of the switch (a tick: no undo step of its own), synced like any tab
 * change. A visitor's switch, a locked tab and an event-storming board leave it be.
 */
export function useSwitchSetsOpensIn<M extends { setMode: (mode: EditorMode) => void }>(
  editorMode: M,
  deps: { tab: Tab | undefined; canEdit: boolean; tickTabs: (map: (ts: Tab[]) => Tab[]) => void },
): M {
  const { tab, canEdit, tickTabs } = deps;
  const rawSet = editorMode.setMode;
  const setMode = useCallback(
    (mode: EditorMode) => {
      rawSet(mode);
      if (!tab || !canEdit || tab.locked === true || !editorModeSwitchable(tab)) return;
      if (opensInOf(tab) === mode) return;
      const id = tab.id;
      tickTabs((ts) => ts.map((t) => (t.id === id ? setTabOpensIn(t, mode) : t)));
      debugLog('[editor-mode] opens-in follows switch', { tabId: id, mode });
    },
    [rawSet, tab, canEdit, tickTabs],
  );
  return { ...editorMode, setMode };
}
