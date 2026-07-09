'use client';

import { useEffect, useState } from 'react';
import { isOfflineId, isOfflineIdSync } from '@/lib/offline/offline-store';

// Offline Mode (spec/76): reactive "is this diagram saved only in this
// browser?". Drives the Offline header badge and hides server-only actions
// (Share, send-tab-to-diagram). Seeds from the sync cache — warm once the
// diagram has loaded through the offline dispatch — and confirms via the
// async check so a render before the cache loads still settles correctly.
export function useIsOfflineDiagram(diagramId: string | null): boolean {
  const [offline, setOffline] = useState(() => (diagramId ? isOfflineIdSync(diagramId) : false));
  useEffect(() => {
    let live = true;
    if (diagramId) void isOfflineId(diagramId).then((v) => live && setOffline(v));
    else setOffline(false);
    return () => {
      live = false;
    };
  }, [diagramId]);
  return offline;
}
