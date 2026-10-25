import { handTemplatePick, readTemplatePick } from '@liveworkspace/explorer';
import { SyncStillSavingError, takeCloudOffline } from '@/lib/offline/offline-convert';
import { dismissLocalMove } from '@/lib/offline/local-move-dismissal';
import { offlineListDesigns } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { SYNC_SAVE_WAIT_MS } from './useSyncInPlace';

const SAVE_POLL_MS = 100;

// Take Offline from inside the editor, with no reload (docs/specs/006-design/offline-mode.md "Taking offline in
// place"), for the start screen's Sync Design to Server switch, which shows only on a fresh design nobody else
// has, so it asks nothing. Waits for the pending save, closes the room so the server delete never reaches this
// editor as a deletion, then takes the design offline. The offline index announces the move, which the badge and
// every later save follow on their own; a failure reopens the room and the design stays on the server.
export function useTakeOfflineInPlace(deps: {
  designId: string | null;
  ownerId: string;
  hasUnsavedChanges: () => boolean;
  setDesignServerStored: (stored: boolean) => void;
  refreshDesignList: (ownerId: string) => void;
}): () => Promise<void> {
  const latest = useLatest(deps);
  return async () => {
    const { designId, ownerId, hasUnsavedChanges } = latest.current;
    if (!designId || ownerId === 'self') return;
    const deadline = Date.now() + SYNC_SAVE_WAIT_MS;
    while (hasUnsavedChanges()) {
      if (Date.now() > deadline) throw new SyncStillSavingError();
      await new Promise((r) => setTimeout(r, SAVE_POLL_MS));
    }
    latest.current.setDesignServerStored(false);
    try {
      await takeCloudOffline(designId, ownerId, null);
    } catch (e) {
      latest.current.setDesignServerStored(true);
      throw e;
    }
    // A template picked now has no server folder to go to.
    if (readTemplatePick()?.itemId === designId) handTemplatePick(null);
    // Kept here on purpose: the move prompt after signing in never offers it back (local-move-dismissal.ts).
    await offlineListDesigns().then(
      (kept) => dismissLocalMove(ownerId, kept.length),
      () => {},
    );
    latest.current.refreshDesignList(ownerId);
    debugLog('[offline] taken offline in place');
    track('Document', 'Moved', 'TakenOffline');
  };
}
