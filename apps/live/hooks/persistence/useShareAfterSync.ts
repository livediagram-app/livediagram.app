'use client';

import { useEffect } from 'react';
import { takeShareAfterSync } from '@/lib/offline/share-after-sync';

// Opens Share on arrival when this document was just synced from the Share dialog
// (docs/specs/006-document/offline-mode.md "Sharing a guest's Local only document"). Waits for the loaded
// document id, and for it to read as a cloud document: the sync removed the local copy, so an id that
// still reads offline is not the one that synced.
export function useShareAfterSync(
  documentId: string | null,
  offline: boolean,
  openShare: (open: boolean) => void,
): void {
  useEffect(() => {
    if (!documentId || offline) return;
    if (takeShareAfterSync(documentId)) openShare(true);
  }, [documentId, offline, openShare]);
}
