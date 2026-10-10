'use client';

import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import { track } from '@/lib/telemetry';
import {
  ConversionInProgressError,
  conversionInProgress,
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
} from '@/lib/offline/offline-convert';

// Shared Offline Mode conversion handlers (docs/specs/006-document/offline-mode.md) for the Explorer's row and
// card menus, which otherwise duplicated this logic. `syncToCloud` uploads an
// offline document to the account; `takeOffline` pulls a cloud document down and
// deletes the server copy (gated by a confirm). Both reload afterwards so the
// list reflects the move. A second conversion of the same document while one
// runs does nothing: the guard is the conversion's own (offline-convert), not
// this hook's state, which went with the menu the moment it closed.
// `close` runs first to dismiss the caller's menu.
export function useOfflineConversion(
  liveDoc: { id: string; name: string; shareCode?: string | null },
  ownerId: string | null,
  close: () => void,
) {
  const confirm = useConfirm();
  const toast = useToast();
  const syncToCloud = async () => {
    if (!ownerId || conversionInProgress(liveDoc.id)) return;
    close();
    try {
      await saveOfflineToCloud(liveDoc.id, ownerId);
      // Before the reload on purpose: the telemetry engine's pagehide
      // beacon carries the buffered event through the navigation.
      track('Document', 'Moved', 'SavedToCloud');
      window.location.reload();
    } catch (e) {
      // Stays offline. A conversion already running reports for itself.
      if (!(e instanceof ConversionInProgressError)) toast.error(syncFailureMessage(e));
    }
  };

  const takeOffline = async () => {
    if (!ownerId || conversionInProgress(liveDoc.id)) return;
    close();
    // A shared tab stays in its other documents and forks here (docs/specs/006-document/offline-mode.md).
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
    });
    if (!ok) return;
    try {
      await takeCloudOffline(liveDoc.id, ownerId, liveDoc.shareCode ?? null);
      track('Document', 'Moved', 'TakenOffline');
      window.location.reload();
    } catch (e) {
      // Stays on the server (aborts roll the local copy back). A conversion already running
      // reports for itself.
      if (e instanceof ConversionInProgressError) return;
      toast.error('Could not take this document offline. It stays safely on the server.');
    }
  };

  return { syncToCloud, takeOffline };
}
