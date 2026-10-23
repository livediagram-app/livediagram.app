'use client';

// The open editor follows a change made in Google Drive
// (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow"): its
// Explorer panel and folder chips re-read, its title takes a rename, and a
// move to the Trash shows the deleted card.

import { useAfterDriveChange } from '@/hooks/persistence/useAfterDriveChange';
import { apiLoadDocument } from '@/lib/api-client';
import { isDocumentTrashedError, isTrashedInIndex } from '@/lib/document-trashed';

export function useDriveFollow(opts: {
  ownerId: string | null;
  documentId: string | null;
  enabled: boolean;
  refreshDocumentList: (ownerId: string) => void;
  setDocumentName: (name: string) => void;
  setDocumentTrashed: (trashed: boolean) => void;
  loadMeta?: (ownerId: string, documentId: string) => Promise<{ name: string } | null>;
}): void {
  const { ownerId, documentId, enabled } = opts;
  useAfterDriveChange(
    () => {
      if (!ownerId || !documentId) return;
      opts.refreshDocumentList(ownerId);
      const load = opts.loadMeta ?? apiLoadDocument;
      void load(ownerId, documentId)
        .then(async (meta) => {
          if (meta?.name) opts.setDocumentName(meta.name);
          // Gone from the api: the index says whether Drive sent it to the Trash.
          else if (meta === null && (await isTrashedInIndex(documentId)))
            opts.setDocumentTrashed(true);
        })
        .catch((err: unknown) => {
          if (isDocumentTrashedError(err)) opts.setDocumentTrashed(true);
        });
    },
    enabled && !!ownerId && !!documentId,
  );
}
