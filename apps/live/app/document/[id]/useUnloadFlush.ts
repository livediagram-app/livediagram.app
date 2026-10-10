'use client';

// The edits still inside the autosave's debounce when the editor goes (docs/specs/006-document/per-tab-storage.md
// "Saving"): flushed on `beforeunload`, on `pagehide` (which fires where beforeunload does not: iOS, a discarded
// tab, the back-forward cache), and when the editor unmounts for another page of the app (the account link in
// the header), where neither event fires. The writes go through flushDocumentSavesBeacon, which keeps them
// alive past the page while they fit the browser's keepalive budget. One flush per distinct content: the
// events can fire in pairs on the way out.
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Tab } from '@livediagram/document';
import { flushDocumentSavesBeacon } from '@/lib/api-client';
import { isDocumentDeleted } from '@/lib/document-tombstones';
import { useLatest } from '@/hooks/ui/useLatest';
import { computeTabSaveDiff } from './editor-page-helpers';

export function useUnloadFlush(opts: {
  hydrated: boolean;
  documentId: string | null;
  isReadOnly: boolean;
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
}): void {
  const latest = useLatest(opts);
  // The content last flushed, so a second event on the same way out sends nothing again.
  const flushedRef = useRef<{ tabs: Tab[]; name: string } | null>(null);

  useEffect(() => {
    const flush = () => {
      const o = latest.current;
      if (!o.hydrated || !o.documentId || o.isReadOnly) return;
      if (o.writesForbiddenRef.current) return;
      // The user just deleted this document (navigating to /explorer fires beforeunload): don't send its
      // tabs back and re-create it.
      if (isDocumentDeleted(o.documentId)) return;
      const flushed = flushedRef.current;
      if (flushed && flushed.tabs === o.tabs && flushed.name === o.documentName) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        o.lastSavedTabsRef.current,
        o.tabs,
        o.lastSavedNameRef.current,
        o.documentName,
        o.loadedTabIdsRef.current,
      );
      if (!hasChanges) return;
      flushedRef.current = { tabs: o.tabs, name: o.documentName };
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
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      // Unmounted (another page of the app): what the debounce still held goes now.
      flush();
    };
  }, [latest]);
}
