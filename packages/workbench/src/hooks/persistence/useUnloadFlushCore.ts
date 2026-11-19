'use client';

// The edits still inside the autosave's debounce when the editor goes (each product's docs/specs/006-*/per-tab-storage.md
// "Saving"): flushed on `beforeunload`, on `pagehide` (which fires where beforeunload does not: iOS, a discarded tab,
// the back-forward cache), and when the editor unmounts for another page of the app (the account link in the header),
// where neither event fires. The writes go through the editor's beacon, which keeps them alive past the page while
// they fit the browser's keepalive budget. One flush per distinct content: the events can fire in pairs on the way
// out. Every editor's app/<item>/[id]/useUnloadFlush.ts binds this to its own calls (UnloadFlushDeps) and keeps its
// old path and names.
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { commitOpenEdit } from '../../lib/open-edit';
import { isSaveFailing, isTabTooLarge } from '../../lib/save-health';
import { useLatest } from '../ui/useLatest';
import type { AutosaveUnloadArgs } from './useAutosaveCore';

/** Whether leaving now asks first: changes the server has not taken, while the last save failed or was refused, or the
 *  browser is offline. */
export const shouldWarnOnLeave = (
  unsaved: boolean,
  saveFailing: boolean,
  online: boolean,
): boolean => unsaved && (saveFailing || !online);

/** What an editor's tabs differ from its last save by (its tested computeTabSaveDiff). */
export type UnloadSaveDiff<Tab> = {
  changedTabs: Tab[];
  deletedIds: string[];
  orderChanged: boolean;
  nameChanged: boolean;
  hasChanges: boolean;
};

/** An editor's side of the unload flush, each call read at call time (tests mock the modules they come from). */
export type UnloadFlushDeps<Tab, R, C = never> = {
  // The person just deleted this item (navigating to the Explorer fires beforeunload): its tabs are not sent back.
  isItemDeleted: (itemId: string) => boolean;
  computeTabSaveDiff: (
    lastSaved: Tab[],
    tabs: Tab[],
    lastSavedName: string,
    name: string,
    loadedTabIds: Set<string>,
  ) => UnloadSaveDiff<Tab>;
  // A Participant's change to one tab, sent to the open room (it has no beacon): `before` is the tab as last saved.
  relayParticipantTab: (
    args: AutosaveUnloadArgs<Tab, R>,
    itemId: string,
    before: Tab | undefined,
    tab: Tab,
  ) => void;
  // Everyone else's changes, as one keepalive beacon, with what each tab's save changed when the editor names it.
  sendBeacon: (
    args: AutosaveUnloadArgs<Tab, R>,
    itemId: string,
    diff: UnloadSaveDiff<Tab>,
    saveChanges: Map<string, C> | undefined,
  ) => void;
  // What a tab's save changed, as the debounced save sends it (livedocuments' and livedesign's tab-save-flow.ts
  // PreparedTabSave), or null when it names nothing. Left out, the beacon carries none.
  saveChanges?: (before: Tab | undefined, tab: Tab) => C | null;
};

export function useUnloadFlushCore<Tab extends { id: string }, R, C = never>(
  deps: UnloadFlushDeps<Tab, R, C>,
  opts: AutosaveUnloadArgs<Tab, R>,
): void {
  const latest = useLatest(opts);
  // The content last flushed, so a second event on the same way out sends nothing again.
  const flushedRef = useRef<{ tabs: Tab[]; name: string } | null>(null);

  useEffect(() => {
    // What the server has not taken yet, or null where there is nothing of this person's to keep.
    const pending = () => {
      const o = latest.current;
      if (!o.hydrated || !o.itemId || o.isReadOnly) return null;
      if (deps.isItemDeleted(o.itemId)) return null;
      const diff = deps.computeTabSaveDiff(
        o.lastSavedTabsRef.current,
        o.tabs,
        o.lastSavedNameRef.current,
        o.itemName,
        o.loadedTabIdsRef.current,
      );
      return diff.hasChanges ? { diff, itemId: o.itemId } : null;
    };
    // What may still be sent: nothing once the server has refused a write to this item.
    const unsaved = () => (latest.current.writesForbiddenRef.current ? null : pending());
    const flush = () => {
      const o = latest.current;
      const flushed = flushedRef.current;
      if (flushed && flushed.tabs === o.tabs && flushed.name === o.itemName) return;
      const found = unsaved();
      if (!found) return;
      const { diff, itemId } = found;
      flushedRef.current = { tabs: o.tabs, name: o.itemName };
      // The tab as last saved.
      const lastSavedOf = (t: Tab) => o.lastSavedTabsRef.current.find((s) => s.id === t.id);
      // A Participant's changes go to the open room at once; it has no beacon to send.
      if (o.participant) {
        for (const t of diff.changedTabs) deps.relayParticipantTab(o, itemId, lastSavedOf(t), t);
        return;
      }
      const changesOf = deps.saveChanges;
      deps.sendBeacon(
        o,
        itemId,
        diff,
        changesOf &&
          new Map(
            diff.changedTabs.flatMap((t) => {
              const changes = changesOf(lastSavedOf(t), t);
              return changes ? [[t.id, changes] as const] : [];
            }),
          ),
      );
    };
    // The page going: a label still being typed commits on blur, which this never fires, so commit it first, and
    // synchronously, so the tabs the flush reads hold it (lib/open-edit.ts). Not on unmount below: that runs inside
    // React's commit, where flushSync cannot, and a click away from the editor has already blurred it.
    const leave = () => {
      flushSync(() => commitOpenEdit());
      flush();
    };
    // Closing while saves fail or the browser is offline: the browser's own "Leave site?" first
    // (007-editor/load-recovery.md "Leaving with unsaved changes asks first"). Never in the healthy
    // case, a save in flight on a working connection, or people learn to click through it.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      leave();
      if (
        shouldWarnOnLeave(
          pending() !== null,
          // A refused save keeps its changes on screen, never sent: leaving would lose them, so it asks too.
          latest.current.writesForbiddenRef.current || isSaveFailing() || isTabTooLarge(),
          navigator.onLine,
        )
      ) {
        e.preventDefault();
        // Older browsers ask only when returnValue is set.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', leave);
      // Unmounted (another page of the app): what the debounce still held goes now.
      flush();
    };
    // `deps` is each editor's module constant: it never changes, so the listeners are added once.
  }, [latest, deps]);
}
