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
import { dismissLocalMove } from '@/lib/offline/local-move-dismissal';
import { offlineListDesigns } from '@/lib/offline/offline-store';

// Offline Mode conversions (docs/specs/006-design/offline-mode.md) for the menus that offer them: the editor's
// Explorer panel's item menu (Take Offline, useOfflineItemMenu) and This Browser's rows (Sync Design).
// `syncToCloud` uploads an offline design to the account; `takeOffline` pulls a cloud design down and deletes
// the server copy (gated by a confirm). Both reload afterwards so every list reflects the move. A second conversion
// of the same design while one runs does nothing: the guard is the conversion's own (offline-convert), not this
// hook's state, which goes with the menu the moment it closes. `close` runs first to dismiss the caller's menu.
type ConvertedDesign = { id: string; name: string; shareCode?: string | null };

export function useOfflineConversions(ownerId: string | null) {
  const confirm = useConfirm();
  const toast = useToast();
  const syncToCloud = async (liveDoc: ConvertedDesign, close: () => void = () => {}) => {
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

  const takeOffline = async (liveDoc: ConvertedDesign, close: () => void = () => {}) => {
    if (!ownerId || conversionInProgress(liveDoc.id)) return;
    close();
    // A shared tab stays in its other designs and forks here (docs/specs/006-design/offline-mode.md).
    const notice = await fetchSharedTabsNotice(ownerId, liveDoc.id, 'offline');
    const ok = await confirm({
      title: `Take “${liveDoc.name}” Offline?`,
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
      // Kept here on purpose: the move prompt after signing in never offers it back (local-move-dismissal.ts).
      await offlineListDesigns().then(
        (kept) => dismissLocalMove(ownerId, kept.length),
        () => {},
      );
      track('Document', 'Moved', 'TakenOffline');
      window.location.reload();
    } catch (e) {
      // Stays on the server (aborts roll the local copy back). A conversion already running
      // reports for itself.
      if (e instanceof ConversionInProgressError) return;
      toast.error('Couldn’t take this offline. It stays safe on the server.');
    }
  };

  return { syncToCloud, takeOffline };
}

// The same, for one design's row.
export function useOfflineConversion(
  liveDoc: ConvertedDesign,
  ownerId: string | null,
  close: () => void,
) {
  const { syncToCloud, takeOffline } = useOfflineConversions(ownerId);
  return {
    syncToCloud: () => syncToCloud(liveDoc, close),
    takeOffline: () => takeOffline(liveDoc, close),
  };
}
