'use client';

import { useEffect, useState } from 'react';

// Offline Mode (docs/specs/006-document/offline-mode.md): reactive "is this item saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, sending a tab elsewhere). Seeds from the sync cache , warm once the
// item has loaded through the offline dispatch, and confirms via the
// async check so a render before the cache loads still settles correctly, and again whenever the
// item joins or leaves the store.
// Each editor binds it once, at module scope in its `hooks/persistence/useIsOfflineDocument.ts`, to its offline store.
export function createIsOfflineDocument({
  isOfflineId,
  isOfflineIdSync,
  subscribeOfflineIds,
}: {
  isOfflineId: (id: string) => Promise<boolean>;
  isOfflineIdSync: (id: string) => boolean;
  subscribeOfflineIds: (listener: (id: string) => void) => () => void;
}) {
  return function useIsOfflineDocument(documentId: string | null): boolean {
    const [offline, setOffline] = useState(() =>
      documentId ? isOfflineIdSync(documentId) : false,
    );
    // No item is never offline: reset during render, not a frame later.
    const [checkedId, setCheckedId] = useState(documentId);
    if (documentId !== checkedId) {
      setCheckedId(documentId);
      if (!documentId) setOffline(false);
    }
    useEffect(() => {
      if (!documentId) return;
      let live = true;
      const check = () => void isOfflineId(documentId).then((v) => live && setOffline(v));
      check();
      // A conversion (Sync in place, Take Offline) flips it with no reload.
      const stop = subscribeOfflineIds((id) => {
        if (id === documentId) check();
      });
      return () => {
        live = false;
        stop();
      };
    }, [documentId]);
    return offline;
  };
}
