// Tab-folder membership actions (spec/30): move a tab into a folder,
// remove it, and rename a folder. Kept out of the already-busy
// useTabActions so the folder concern has its own focused home.
//
// Membership is menu-only — dragging never changes it (that lives in
// useTabActions.reorderTabs). Every mutation re-normalizes the order
// so each folder stays one contiguous run, and bundles into a single
// commitTabs call so undo restores membership + order together.
//
// Folder is a name string carried per-tab and persisted on the
// diagram_tabs link, NOT in the tab body (see stripUiTabFields). The
// name is user content and is never sent as a telemetry `type`.

import {
  folderNamesInDiagram,
  normalizeFolderOrder,
  tabFolderName,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { tabFolderTransitionSummary, trackTabFolderTransition } from './tab-folder-reporting';

type TabFoldersDeps = {
  tabs: Tab[];
  // The tab the ellipsis menu acts on (folder ops target the active
  // tab; the menu auto-switches to a tab before opening on it).
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  emitTabMeta: (tabId: string, summary: string) => void;
};

export function useTabFolders(deps: TabFoldersDeps) {
  const { tabs, activeId, commitTabs, emitTabMeta } = deps;

  // Move a tab into a folder by name. Handles both menu paths — picking
  // an existing folder and typing a brand-new name (same name = same
  // folder). Empty / whitespace names are a no-op. Telemetry
  // distinguishes a freshly-created folder from a move into an existing
  // one, without ever shipping the name.
  const moveTabToFolder = (tabId: string, rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    const target = tabs.find((t) => t.id === tabId);
    if (!target || tabFolderName(target) === name) return;
    const isNewFolder = !folderNamesInDiagram(tabs).includes(name);
    commitTabs((ts) =>
      normalizeFolderOrder(ts.map((t) => (t.id === tabId ? { ...t, folder: name } : t))),
    );
    emitTabMeta(tabId, tabFolderTransitionSummary(tabFolderName(target), name));
    // Two facts when the name is new, so two events (the deliberate double-emit
    // pattern spec/22 uses for Tab·Started·Vote + PrivateVote): the folder came
    // into existence, AND this tab is now filed in it. The old either/or made
    // "tabs filed into folders" undercount by exactly the number of folders
    // anyone had ever created.
    if (isNewFolder) track('Folder', 'Created', 'Tab');
    trackTabFolderTransition(tabFolderName(target), name);
  };

  // Make a tab loose again. No-op if it isn't in a folder.
  const removeTabFromFolder = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target || tabFolderName(target) === null) return;
    const previous = tabFolderName(target);
    commitTabs((ts) =>
      normalizeFolderOrder(ts.map((t) => (t.id === tabId ? { ...t, folder: undefined } : t))),
    );
    emitTabMeta(tabId, tabFolderTransitionSummary(previous, null));
    trackTabFolderTransition(previous, null);
  };

  // Rename a folder by rewriting the name on every member of its run.
  // No-op for an empty new name or when nothing actually changes.
  const renameFolder = (oldName: string, rawNewName: string) => {
    const newName = rawNewName.trim();
    if (!newName || newName === oldName) return;
    const members = tabs.filter((t) => tabFolderName(t) === oldName);
    if (members.length === 0) return;
    commitTabs((ts) =>
      normalizeFolderOrder(
        ts.map((t) => (tabFolderName(t) === oldName ? { ...t, folder: newName } : t)),
      ),
    );
    // Attribute the rename to the active tab when it's in this folder,
    // otherwise to the first member, so the activity log has a subject.
    const subjectId = members.some((t) => t.id === activeId) ? activeId : members[0]!.id;
    emitTabMeta(subjectId, `Renamed folder '${oldName}' to '${newName}'`);
    // The folder is the subject here, not a tab: this used to emit
    // `Tab·Renamed`, which the dashboard counts as tabs renamed.
    track('Folder', 'Renamed', 'Tab');
  };

  return { moveTabToFolder, removeTabFromFolder, renameFolder };
}
