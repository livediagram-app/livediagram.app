import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@livediagram/document';
import { saveOfflineToCloud, SyncStillSavingError } from '@/lib/offline/offline-convert';
import { rewriteImageIds } from '@/lib/offline/offline-images';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';

// How long Sync Document waits for this browser's last save to land before it reads the record it
// uploads; past it, the sync is refused rather than racing a write into a record about to go.
export const SYNC_SAVE_WAIT_MS = 5_000;
const SYNC_SAVE_POLL_MS = 100;

// Sync Document from inside the editor, with no reload (docs/specs/006-document/offline-mode.md "Syncing in
// place"): wait for the pending save, upload the record, then turn the open document into the cloud
// document it now is. The offline index announces the move, which the badge, the board and the sheets
// follow on their own; this hook re-points the open tabs' images at the gallery copies, opens the room,
// and refreshes the Explorer.
export function useSyncInPlace(deps: {
  documentId: string | null;
  ownerId: string;
  hasUnsavedChanges: () => boolean;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  setDocumentServerStored: (stored: boolean) => void;
  refreshDocumentList: (ownerId: string) => void;
}): () => Promise<void> {
  // The ref is stable and written here, so it is held as given rather than through `latest`.
  const { lastSavedTabsRef } = deps;
  const latest = useLatest(deps);
  return async () => {
    const { documentId, ownerId, hasUnsavedChanges } = latest.current;
    // Never as the placeholder an early open runs under: the gate waits for the reader.
    if (!documentId || ownerId === 'self') return;
    const deadline = Date.now() + SYNC_SAVE_WAIT_MS;
    while (hasUnsavedChanges()) {
      if (Date.now() > deadline) throw new SyncStillSavingError();
      await new Promise((r) => setTimeout(r, SYNC_SAVE_POLL_MS));
    }
    const { imageIds } = await saveOfflineToCloud(documentId, ownerId);
    const now = latest.current;
    if (imageIds.size > 0) {
      now.resetTabs((prev) => rewriteImageIds(prev, imageIds));
      lastSavedTabsRef.current = rewriteImageIds(lastSavedTabsRef.current, imageIds);
    }
    now.setDocumentServerStored(true);
    now.refreshDocumentList(ownerId);
    debugLog(`[offline-sync] synced in place images=${imageIds.size}`);
    track('Document', 'Moved', 'SavedToCloud');
  };
}
