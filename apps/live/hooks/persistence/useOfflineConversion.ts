'use client';

import { useState } from 'react';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import { track } from '@/lib/telemetry';
import {
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
} from '@/lib/offline/offline-convert';

// Shared Offline Mode conversion handlers (docs/specs/006-document/offline-mode.md) for the Explorer's row and
// card menus, which otherwise duplicated this logic. `syncToCloud` uploads an
// offline diagram to the account; `takeOffline` pulls a cloud diagram down and
// deletes the server copy (gated by a confirm). Both reload afterwards so the
// list reflects the move, and `converting` guards against a double-trigger.
// `close` runs first to dismiss the caller's menu.
export function useOfflineConversion(
  liveDoc: { id: string; name: string; shareCode?: string | null },
  ownerId: string | null,
  close: () => void,
) {
  const confirm = useConfirm();
  const toast = useToast();
  const [converting, setConverting] = useState(false);

  const syncToCloud = async () => {
    if (!ownerId || converting) return;
    close();
    setConverting(true);
    try {
      await saveOfflineToCloud(liveDoc.id, ownerId);
      // Before the reload on purpose: the telemetry engine's pagehide
      // beacon carries the buffered event through the navigation.
      track('Document', 'Moved', 'SavedToCloud');
      window.location.reload();
    } catch (e) {
      setConverting(false); // stays offline
      toast.error(syncFailureMessage(e));
    }
  };

  const takeOffline = async () => {
    if (!ownerId || converting) return;
    close();
    // A shared tab stays in its other diagrams and forks here (docs/specs/006-document/offline-mode.md).
    const notice = await fetchSharedTabsNotice(ownerId, liveDoc.id, 'offline');
    const ok = await confirm({
      title: `Take “${liveDoc.name}” offline?`,
      message: [
        'This removes it from your account and every other device. It will exist only in this browser, with no backup.',
        notice,
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Take Offline',
      variant: 'danger',
    });
    if (!ok) return;
    setConverting(true);
    try {
      await takeCloudOffline(liveDoc.id, ownerId, liveDoc.shareCode ?? null);
      track('Document', 'Moved', 'TakenOffline');
      window.location.reload();
    } catch {
      setConverting(false); // stays on server (aborts roll the local copy back)
      toast.error('Could not take this diagram offline. It stays safely on the server.');
    }
  };

  return { syncToCloud, takeOffline, converting };
}
