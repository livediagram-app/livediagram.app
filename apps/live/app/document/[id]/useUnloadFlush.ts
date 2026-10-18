'use client';

// The edits still inside the autosave's debounce when the editor goes (docs/specs/006-document/per-tab-storage.md
// "Saving"): flushed on `beforeunload`, on `pagehide` (which fires where beforeunload does not: iOS, a discarded
// tab, the back-forward cache), and when the editor unmounts for another page of the app (the account link in
// the header), where neither event fires. The writes go through flushDocumentSavesBeacon, which keeps them
// alive past the page while they fit the browser's keepalive budget. One flush per distinct content: the
// events can fire in pairs on the way out.
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { Tab } from '@livediagram/document';
import { flushDocumentSavesBeacon, type connectRoom } from '@/lib/api-client';
import { isDocumentDeleted } from '@/lib/document-tombstones';
import { commitOpenEdit } from '@/lib/open-edit';
import { useLatest } from '@/hooks/ui/useLatest';
import { computeTabSaveDiff } from './editor-page-helpers';
import { relayParticipantChanges } from './tab-save-flow';
import { isSaveFailing, isTabTooLarge } from '@/lib/save-health';

/** Whether leaving now asks first: changes the server has not taken, while the last save failed or the browser is
 *  offline. */
export const shouldWarnOnLeave = (
  unsaved: boolean,
  saveFailing: boolean,
  online: boolean,
): boolean => unsaved && (saveFailing || !online);

export function useUnloadFlush(opts: {
  hydrated: boolean;
  documentId: string | null;
  isReadOnly: boolean;
  // A Participant's changes go to the open room, never a beacon (docs/specs/013-workspace/share-roles.md).
  participant: boolean;
  tabs: Tab[];
  documentName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  changesetSeen: ReadonlyMap<string, number>;
  // Set once the server has refused a write to this document: nothing sent can be accepted.
  writesForbiddenRef: MutableRefObject<boolean>;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
}): void {
  const latest = useLatest(opts);
  // The content last flushed, so a second event on the same way out sends nothing again.
  const flushedRef = useRef<{ tabs: Tab[]; name: string } | null>(null);

  useEffect(() => {
    // What the server has not taken yet, or null where nothing may be sent.
    const unsaved = () => {
      const o = latest.current;
      if (!o.hydrated || !o.documentId || o.isReadOnly) return null;
      if (o.writesForbiddenRef.current) return null;
      // The user just deleted this document (navigating to /explorer fires beforeunload): don't send its
      // tabs back and re-create it.
      if (isDocumentDeleted(o.documentId)) return null;
      const diff = computeTabSaveDiff(
        o.lastSavedTabsRef.current,
        o.tabs,
        o.lastSavedNameRef.current,
        o.documentName,
        o.loadedTabIdsRef.current,
      );
      return diff.hasChanges ? diff : null;
    };
    const flush = () => {
      const o = latest.current;
      const flushed = flushedRef.current;
      if (flushed && flushed.tabs === o.tabs && flushed.name === o.documentName) return;
      const diff = unsaved();
      if (!diff || !o.documentId) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged } = diff;
      flushedRef.current = { tabs: o.tabs, name: o.documentName };
      // A Participant's changes go to the open room at once; it has no beacon to send.
      if (o.participant) {
        for (const t of changedTabs) {
          const before = o.lastSavedTabsRef.current.find((s) => s.id === t.id);
          void relayParticipantChanges(before, t, () => o.roomRef.current).catch(() => {});
        }
        return;
      }
      flushDocumentSavesBeacon({
        ownerId: o.selfId,
        documentId: o.documentId,
        shareCode: o.sessionShareCode,
        changedTabs,
        deletedIds,
        loadedTabIds: o.loadedTabIdsRef.current,
        orderChanged,
        nameChanged,
        name: o.documentName,
        tabs: o.tabs,
        changesetSeen: o.changesetSeen,
      });
    };
    // The page going: a label still being typed commits on blur, which this never fires, so commit it first, and
    // synchronously, so the tabs the flush reads hold it (lib/open-edit.ts). Not on unmount below: that runs inside
    // React's commit, where flushSync cannot, and a click away from the editor has already blurred it.
    const leave = () => {
      flushSync(() => commitOpenEdit());
      flush();
    };
    // Closing while saves fail or the browser is offline: the browser's own "Leave site?" first
    // (docs/specs/007-editor/load-recovery.md "Leaving with unsaved changes asks first"). Never in the healthy
    // case, a save in flight on a working connection, or people learn to click through it.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      leave();
      if (
        shouldWarnOnLeave(unsaved() !== null, isSaveFailing() || isTabTooLarge(), navigator.onLine)
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
  }, [latest]);
}
