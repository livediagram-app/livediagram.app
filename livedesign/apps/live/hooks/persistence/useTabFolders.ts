// Tab-folder membership actions (docs/specs/006-design/tab-folders.md): move a tab into a folder,
// remove it, rename a folder, and set a folder's colour. Kept out of the already-busy
// useTabActions so the folder concern has its own focused home.
//
// Membership is menu-only — dragging never changes it (that lives in
// useTabActions.reorderTabs). Every mutation re-normalizes the order
// so each folder stays one contiguous run, and bundles into a single
// commitTabs call so undo restores membership + order together.
//
// Folder is a name string carried per-tab and persisted on the
// design_tabs link, NOT in the tab body (see stripUiTabFields). The
// name is user content and is never sent as a telemetry `type`.

import {
  folderNamesInDesign,
  normalizeFolderOrder,
  tabFolderName,
  tabInFolder,
  withFolderColour,
  withFolderRenamed,
  withTabInFolder,
  type Tab,
} from '@livedesign/design';
import { track } from '@/lib/telemetry';
import { trackTabFolderTransition } from '@liveworkspace/workbench/hooks/persistence/tab-folder-reporting';

type TabFoldersDeps = {
  tabs: Tab[];
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
};

export function useTabFolders(deps: TabFoldersDeps) {
  const { tabs, commitTabs } = deps;

  // Move a tab into a folder by name. Handles both menu paths — picking
  // an existing folder and typing a brand-new name (same name = same
  // folder). Empty / whitespace names are a no-op. Telemetry
  // distinguishes a freshly-created folder from a move into an existing
  // one, without ever shipping the name.
  // A brand-new folder takes `colour` (null or left out: Automatic); an existing one keeps its own.
  const moveTabToFolder = (tabId: string, rawName: string, colour?: string | null) => {
    const name = rawName.trim();
    if (!name) return;
    const target = tabs.find((t) => t.id === tabId);
    if (!target || tabFolderName(target) === name) return;
    const isNewFolder = !folderNamesInDesign(tabs).includes(name);
    commitTabs((ts) => withTabInFolder(ts, tabId, name, colour));
    // Two facts when the name is new, so two events (the deliberate double-emit
    // pattern docs/specs/017-telemetry/telemetry.md uses for Tab·Started·Vote + PrivateVote): the folder came
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
      normalizeFolderOrder(ts.map((t) => (t.id === tabId ? tabInFolder(t, null, ts) : t))),
    );
    trackTabFolderTransition(previous, null);
  };

  // Rename a folder by rewriting the name on every member of its run.
  // No-op for an empty new name or when nothing actually changes.
  const renameFolder = (oldName: string, rawNewName: string) => {
    const newName = rawNewName.trim();
    if (!newName || newName === oldName) return;
    const members = tabs.filter((t) => tabFolderName(t) === oldName);
    if (members.length === 0) return;
    // The colour stays (a merge into another folder takes that folder's, withFolderRenamed).
    commitTabs((ts) => withFolderRenamed(ts, oldName, newName));
    // The folder is the subject here, not a tab: this used to emit
    // `Tab·Renamed`, which the dashboard counts as tabs renamed.
    track('Folder', 'Renamed', 'Tab');
  };

  // Set a folder's colour on every member in one commit (one undo step), the tabs staying where they are; null is
  // Automatic. Sends no event (tab-folders.md "Telemetry").
  const setFolderColour = (name: string, colour: string | null) => {
    if (!tabs.some((t) => tabFolderName(t) === name)) return;
    commitTabs((ts) => withFolderColour(ts, name, colour));
  };

  return { moveTabToFolder, removeTabFromFolder, renameFolder, setFolderColour };
}
