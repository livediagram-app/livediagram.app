import { readItemTypeCatalogue } from '@liveplanner/items';
import { saveOfflineToCloud, SyncStillSavingError } from '@/lib/offline/offline-convert';
import { apiLoadProject } from '@/lib/api/projects';
import type { SavedItemTypes } from '@/lib/api/item-types';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// How long Sync Project waits for this browser's last save to land before it reads the record it
// uploads; past it, the sync is refused rather than racing a write into a record about to go.
export const SYNC_SAVE_WAIT_MS = 5_000;
const SYNC_SAVE_POLL_MS = 100;

// Sync Project from inside the editor, with no reload (docs/specs/006-project/offline-mode.md "Syncing in
// place"): wait for the pending save, upload the record, then turn the open project into the cloud
// project it now is. The offline index announces the move, which the badge, the board and the sheets
// follow on their own; this hook opens the room and refreshes the Explorer.
export function useSyncInPlace(deps: {
  projectId: string | null;
  ownerId: string;
  hasUnsavedChanges: () => boolean;
  setProjectServerStored: (stored: boolean) => void;
  refreshProjectList: (ownerId: string) => void;
  // The card types as the server now stores them, taken in place of this browser's count (item-types.md "Storage and
  // sync"), so the first card types save after the sync names the server's revision.
  adoptItemTypes: (saved: SavedItemTypes) => void;
}): () => Promise<void> {
  const latest = useLatest(deps);
  return async () => {
    const { projectId, ownerId, hasUnsavedChanges } = latest.current;
    // Never as the placeholder an early open runs under: the gate waits for the reader.
    if (!projectId || ownerId === 'self') return;
    const deadline = Date.now() + SYNC_SAVE_WAIT_MS;
    while (hasUnsavedChanges()) {
      if (Date.now() > deadline) throw new SyncStillSavingError();
      await new Promise((r) => setTimeout(r, SYNC_SAVE_POLL_MS));
    }
    await saveOfflineToCloud(projectId, ownerId);
    const now = latest.current;
    now.setProjectServerStored(true);
    now.refreshProjectList(ownerId);
    // Best effort: without it the first save is refused stale once and made again to the server's catalogue.
    const cloud = await apiLoadProject(ownerId, projectId).catch(() => null);
    if (cloud)
      now.adoptItemTypes({
        itemTypes: readItemTypeCatalogue(cloud.itemTypes ?? null),
        itemTypesRev: cloud.itemTypesRev ?? 0,
        adopt: true,
      });
    debugLog('[offline-sync] synced in place');
    track('Project', 'Moved', 'SavedToCloud');
  };
}
