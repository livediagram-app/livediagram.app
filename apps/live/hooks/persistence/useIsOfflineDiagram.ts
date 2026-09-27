'use client';

import { useEffect, useState } from 'react';
import { isOfflineId, isOfflineIdSync } from '@/lib/offline/offline-store';

// Offline Mode (docs/specs/006-diagram/offline-mode.md): reactive "is this diagram saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, send-tab-to-diagram). Seeds from the sync cache — warm once the
// diagram has loaded through the offline dispatch — and confirms via the
// async check so a render before the cache loads still settles correctly.
export function useIsOfflineDiagram(diagramId: string | null): boolean {
  const [offline, setOffline] = useState(() => (diagramId ? isOfflineIdSync(diagramId) : false));
  // No diagram is never offline: reset during render, not a frame later.
  const [checkedId, setCheckedId] = useState(diagramId);
  if (diagramId !== checkedId) {
    setCheckedId(diagramId);
    if (!diagramId) setOffline(false);
  }
  useEffect(() => {
    if (!diagramId) return;
    let live = true;
    void isOfflineId(diagramId).then((v) => live && setOffline(v));
    return () => {
      live = false;
    };
  }, [diagramId]);
  return offline;
}
