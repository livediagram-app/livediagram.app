'use client';

import { useEffect, useState } from 'react';
import { isOfflineId, isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';

// Offline Mode (docs/specs/006-project/offline-mode.md): reactive "is this project saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, send-tab-to-project). Seeds from the sync cache — warm once the
// project has loaded through the offline dispatch — and confirms via the
// async check so a render before the cache loads still settles correctly, and again whenever the
// project joins or leaves the store.
export function useIsOfflineProject(projectId: string | null): boolean {
  const [offline, setOffline] = useState(() => (projectId ? isOfflineIdSync(projectId) : false));
  // No project is never offline: reset during render, not a frame later.
  const [checkedId, setCheckedId] = useState(projectId);
  if (projectId !== checkedId) {
    setCheckedId(projectId);
    if (!projectId) setOffline(false);
  }
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    const check = () => void isOfflineId(projectId).then((v) => live && setOffline(v));
    check();
    // A conversion (Sync Project in place, Take Offline) flips it with no reload.
    const stop = subscribeOfflineIds((id) => {
      if (id === projectId) check();
    });
    return () => {
      live = false;
      stop();
    };
  }, [projectId]);
  return offline;
}
