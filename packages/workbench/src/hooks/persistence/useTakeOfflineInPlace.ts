import { handTemplatePick, readTemplatePick } from '@liveworkspace/explorer';
import { dismissLocalMove } from '../../lib/offline/local-move-dismissal';
import { debugLog } from '../../lib/debug-log';
import { useLatest } from '../ui/useLatest';

// What each editor hands in, once, at module scope in its `useTakeOfflineInPlace.ts`: its offline store's
// conversion and list (lib/offline), its telemetry, and how long Sync in place waits for a save (useSyncInPlace).
export type TakeOfflineInPlaceDeps = {
  SyncStillSavingError: new () => Error;
  takeCloudOffline: (id: string, ownerId: string, shareCode: string | null) => Promise<unknown>;
  offlineListDocuments: () => Promise<readonly unknown[]>;
  // Counts the move (Document·Moved·TakenOffline), named by the editor so its telemetry manifest sees it.
  trackTakenOffline: () => void;
  SYNC_SAVE_WAIT_MS: number;
};

const SAVE_POLL_MS = 100;

// Take Offline from inside the editor, with no reload (docs/specs/006-document/offline-mode.md "Taking offline in
// place"), for the start screen's Sync to Server switch, which shows only on a fresh item nobody else
// has, so it asks nothing. Waits for the pending save, closes the room so the server delete never reaches this
// editor as a deletion, then takes the item offline. The offline index announces the move, which the badge and
// every later save follow on their own; a failure reopens the room and the item stays on the server.
export function createTakeOfflineInPlace({
  SyncStillSavingError,
  takeCloudOffline,
  offlineListDocuments,
  trackTakenOffline,
  SYNC_SAVE_WAIT_MS,
}: TakeOfflineInPlaceDeps) {
  return function useTakeOfflineInPlace(deps: {
  documentId: string | null;
  ownerId: string;
  hasUnsavedChanges: () => boolean;
  setDocumentServerStored: (stored: boolean) => void;
  refreshDocumentList: (ownerId: string) => void;
}): () => Promise<void> {
  const latest = useLatest(deps);
  return async () => {
    const { documentId, ownerId, hasUnsavedChanges } = latest.current;
    if (!documentId || ownerId === 'self') return;
    const deadline = Date.now() + SYNC_SAVE_WAIT_MS;
    while (hasUnsavedChanges()) {
      if (Date.now() > deadline) throw new SyncStillSavingError();
      await new Promise((r) => setTimeout(r, SAVE_POLL_MS));
    }
    latest.current.setDocumentServerStored(false);
    try {
      await takeCloudOffline(documentId, ownerId, null);
    } catch (e) {
      latest.current.setDocumentServerStored(true);
      throw e;
    }
    // A template picked now has no server folder to go to.
    if (readTemplatePick()?.itemId === documentId) handTemplatePick(null);
    // Kept here on purpose: the move prompt after signing in never offers it back (local-move-dismissal.ts).
    await offlineListDocuments().then(
      (kept) => dismissLocalMove(ownerId, kept.length),
      () => {},
    );
    latest.current.refreshDocumentList(ownerId);
    debugLog('[offline] taken offline in place');
    trackTakenOffline();
  };
}
}
