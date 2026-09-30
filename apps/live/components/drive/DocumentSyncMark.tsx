'use client';

// Where one document stands with Google Drive, on its Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "The Explorer shows each document's sync"):
// a small cloud beside its Updated time. Synced, waiting to sync, or syncing,
// each a different glyph so colour is never the only signal, and named on
// hover and focus. Nothing at all for a document that is not mirrored.

import { lucideCloudCheck, lucideCloudSync, lucideCloudUpload } from '@livediagram/icons/lucide';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { useDocumentSync, type DocumentSyncState } from './drive-mirror-context';

export const DOCUMENT_SYNC_LABEL: Record<DocumentSyncState, string> = {
  synced: 'Synced to Google Drive',
  waiting: 'Waiting to sync to Google Drive',
  syncing: 'Syncing to Google Drive…',
};

// Vendored Lucide glyphs (docs/specs/004-interface-design/iconography.md).
const MARK: Record<DocumentSyncState, ReturnType<typeof lucideGlyph>> = {
  synced: lucideGlyph(lucideCloudCheck, 14),
  waiting: lucideGlyph(lucideCloudUpload, 14),
  syncing: lucideGlyph(lucideCloudSync, 14),
};

// On-screen stroke in px.
export const DOCUMENT_SYNC_WEIGHT = 1;

export function DocumentSyncMark({ documentId, savedAt }: { documentId: string; savedAt: number }) {
  const state = useDocumentSync(documentId, savedAt);
  if (!state) return null;
  const label = DOCUMENT_SYNC_LABEL[state];
  const Icon = MARK[state];
  return (
    <Tooltip label={label}>
      <span
        role="img"
        tabIndex={0}
        aria-label={label}
        data-document-sync={state}
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500 ${
          state === 'synced'
            ? 'text-slate-400 dark:text-slate-500'
            : 'text-brand-600 dark:text-brand-300'
        } ${state === 'syncing' ? 'motion-safe:animate-pulse' : ''}`}
      >
        {/* Finer than the house weight: a quiet mark beside quiet metadata. */}
        <Icon weight={DOCUMENT_SYNC_WEIGHT} />
      </span>
    </Tooltip>
  );
}
