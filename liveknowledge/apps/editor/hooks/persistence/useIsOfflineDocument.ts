'use client';

// Offline Mode (docs/specs/006-document/offline-mode.md): reactive "is this saved only in this browser?"
// (@liveworkspace/workbench/hooks/persistence/useIsOfflineDocument), over this editor's offline store.
import { createIsOfflineDocument } from '@liveworkspace/workbench/hooks/persistence/useIsOfflineDocument';
import { isOfflineId, isOfflineIdSync, subscribeOfflineIds } from '@/lib/offline/offline-store';

export const useIsOfflineDocument = createIsOfflineDocument({
  isOfflineId,
  isOfflineIdSync,
  subscribeOfflineIds,
});
