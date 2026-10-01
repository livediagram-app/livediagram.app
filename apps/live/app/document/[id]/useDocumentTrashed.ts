'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// document is in the Trash"). Set when the load answers document_trashed, when
// the room says the document was trashed, or when a save is refused because
// of it. Whether the reader may restore it is read from their own Trash: the
// row is there exactly when they may (owner, or a joined team member), and
// never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedDocument } from '@livediagram/api-schema';
import { apiListTrash, apiRestoreDocument } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

export type DocumentTrashedState = {
  trashed: boolean;
  setDocumentTrashed: (trashed: boolean) => void;
  // The reader's Trash row for this document, or null when they may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedDocument | null;
  restore: () => Promise<void>;
};

export function useDocumentTrashed(opts: {
  ownerId: string | null;
  documentId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): DocumentTrashedState {
  const { ownerId, documentId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedDocument | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team' | 'Local'>('Personal');

  const setDocumentTrashed = useCallback((next: boolean) => {
    if (next) console.info('[trash] open document is in the Trash');
    setTrashed(next);
  }, []);

  useEffect(() => {
    if (!trashed || viaShareLink || !ownerId || !documentId) return;
    let live = true;
    void apiListTrash(ownerId).then((listing) => {
      if (!live) return;
      const local = listing.local.find((r) => r.id === documentId);
      const cloud = listing.cloud?.find((r) => r.id === documentId);
      setRestorable(local ?? cloud ?? null);
      setFrom(local ? 'Local' : cloud?.teamId ? 'Team' : 'Personal');
    });
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, ownerId, documentId]);

  const restore = useCallback(async () => {
    if (!ownerId || !documentId || !restorable) return;
    await apiRestoreDocument(ownerId, documentId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live document has.
    window.location.reload();
  }, [ownerId, documentId, restorable, from]);

  return { trashed, setDocumentTrashed, restorable, restore };
}
