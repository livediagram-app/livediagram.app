'use client';

// The editor's deleted state (docs/specs/013-workspace/trash.md, "While a
// document is in the Trash"). Set when the load answers document_trashed, when
// the room says the document was trashed, or when a save is refused because
// of it. Whether the reader may restore it is the index's answer
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): the item, which outlives the trashing, at edit for them (its owner,
// or a member of the team that owns it), and never for a share-link visitor.
import { useCallback, useEffect, useState } from 'react';
import type { TrashedDocument } from '@/components/chrome/DocumentTrashedCard';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isDocumentDeleted } from '@/lib/document-tombstones';

type DocumentTrashedState = {
  trashed: boolean;
  setDocumentTrashed: (trashed: boolean) => void;
  // When and why it went to the Trash, or null when the reader may not
  // restore it (or it hasn't been looked up yet).
  restorable: TrashedDocument | null;
  restore: () => Promise<void>;
};

export function useDocumentTrashed(opts: {
  documentId: string | null;
  // A share-link session never looks: a visitor holds no Trash for it.
  viaShareLink: boolean;
}): DocumentTrashedState {
  const { documentId, viaShareLink } = opts;
  const [trashed, setTrashed] = useState(false);
  const [restorable, setRestorable] = useState<TrashedDocument | null>(null);
  // Which Trash it sits in, for the telemetry `type`.
  const [from, setFrom] = useState<'Personal' | 'Team'>('Personal');

  const setDocumentTrashed = useCallback(
    (next: boolean) => {
      // Deleted from this page (the Explorer's delete of the open document): it is already on its way to the
      // Explorer, so the room's echo of the delete must not flash the deleted page first.
      if (next && documentId && isDocumentDeleted(documentId)) {
        debugLog('[trash] own delete, leaving for the Explorer');
        return;
      }
      if (next) debugLog('[trash] open document is in the Trash');
      setTrashed(next);
    },
    [documentId],
  );

  useEffect(() => {
    if (!trashed || viaShareLink || !documentId) return;
    let live = true;
    indexClient
      .getItem(documentId)
      .then(({ item }) => {
        if (!live || item.trashedAt === null || item.access !== 'edit') return;
        setRestorable({ trashedAt: item.trashedAt, reason: item.trashReason });
        setFrom(item.teamId ? 'Team' : 'Personal');
      })
      // Not the reader's to restore, or the index unreachable: the card says it was deleted.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [trashed, viaShareLink, documentId]);

  const restore = useCallback(async () => {
    if (!documentId || !restorable) return;
    await indexClient.restoreItem(documentId);
    track('Trash', 'Restored', from);
    // Reopen it from scratch: a fresh load is the one path that hydrates
    // everything a live document has.
    window.location.reload();
  }, [documentId, restorable, from]);

  return { trashed, setDocumentTrashed, restorable, restore };
}
