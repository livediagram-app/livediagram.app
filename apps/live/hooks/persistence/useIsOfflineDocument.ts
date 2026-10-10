'use client';

import { useEffect, useState } from 'react';
import { isOfflineId, isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';

// Offline Mode (docs/specs/006-document/offline-mode.md): reactive "is this document saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, send-tab-to-document). Seeds from the sync cache — warm once the
// document has loaded through the offline dispatch — and confirms via the
// async check so a render before the cache loads still settles correctly, and again whenever the
// document joins or leaves the store.
export function useIsOfflineDocument(documentId: string | null): boolean {
  const [offline, setOffline] = useState(() => (documentId ? isOfflineIdSync(documentId) : false));
  // No document is never offline: reset during render, not a frame later.
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
    // A conversion (Sync Document in place, Take Offline) flips it with no reload.
    const stop = subscribeOfflineIds((id) => {
      if (id === documentId) check();
    });
    return () => {
      live = false;
      stop();
    };
  }, [documentId]);
  return offline;
}
