'use client';

import { useEffect, useState } from 'react';
import { isOfflineId, isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';

// Offline Mode (docs/specs/006-design/offline-mode.md): reactive "is this design saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, send-tab-to-design). Seeds from the sync cache — warm once the
// design has loaded through the offline dispatch — and confirms via the
// async check so a render before the cache loads still settles correctly, and again whenever the
// design joins or leaves the store.
export function useIsOfflineDesign(designId: string | null): boolean {
  const [offline, setOffline] = useState(() => (designId ? isOfflineIdSync(designId) : false));
  // No design is never offline: reset during render, not a frame later.
  const [checkedId, setCheckedId] = useState(designId);
  if (designId !== checkedId) {
    setCheckedId(designId);
    if (!designId) setOffline(false);
  }
  useEffect(() => {
    if (!designId) return;
    let live = true;
    const check = () => void isOfflineId(designId).then((v) => live && setOffline(v));
    check();
    // A conversion (Sync Design in place, Take Offline) flips it with no reload.
    const stop = subscribeOfflineIds((id) => {
      if (id === designId) check();
    });
    return () => {
      live = false;
      stop();
    };
  }, [designId]);
  return offline;
}
