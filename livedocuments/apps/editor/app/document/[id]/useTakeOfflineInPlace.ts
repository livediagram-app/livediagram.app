// Take Offline from inside the editor, with no reload (@liveworkspace/workbench/hooks/persistence/useTakeOfflineInPlace),
// bound to this editor's offline store and telemetry.
import { createTakeOfflineInPlace } from '@liveworkspace/workbench/hooks/persistence/useTakeOfflineInPlace';
import { SyncStillSavingError, takeCloudOffline } from '@/lib/offline/offline-convert';
import { offlineListDocuments } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import { SYNC_SAVE_WAIT_MS } from './useSyncInPlace';

export const useTakeOfflineInPlace = createTakeOfflineInPlace({
  SyncStillSavingError,
  takeCloudOffline,
  offlineListDocuments,
  track,
  SYNC_SAVE_WAIT_MS,
});
