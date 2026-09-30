'use client';

// Where one document stands with Google Drive, on its Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "The Explorer shows each document's sync"):
// a small cloud beside its Updated time. Synced, waiting to sync, or syncing,
// each a different glyph so colour is never the only signal, and named on
// hover and focus. Nothing at all for a document that is not mirrored.

import { Glyph, Tooltip } from '@livediagram/ui';
import { useDocumentSync, type DocumentSyncState } from './drive-mirror-context';

export const DOCUMENT_SYNC_LABEL: Record<DocumentSyncState, string> = {
  synced: 'Synced to Google Drive',
  waiting: 'Waiting to sync to Google Drive',
  syncing: 'Syncing to Google Drive…',
};

const CLOUD = 'M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6A4 4 0 0 0 4.4 7.3a2.6 2.6 0 0 0 .1 5.2z';

function Mark({ state }: { state: DocumentSyncState }) {
  switch (state) {
    case 'synced':
      return (
        <Glyph size={14} units={16}>
          <path d={CLOUD} />
          <path d="M6.3 9.6l1.3 1.3 2.3-2.4" />
        </Glyph>
      );
    case 'waiting':
      return (
        <Glyph size={14} units={16}>
          <path d={CLOUD} />
          <path d="M8 8.2v1.6l1 .7" />
        </Glyph>
      );
    case 'syncing':
      return (
        <Glyph size={14} units={16}>
          <path d={CLOUD} />
          <path d="M8 11V8.2M6.8 9.3 8 8.1l1.2 1.2" />
        </Glyph>
      );
  }
}

export function DocumentSyncMark({ documentId, savedAt }: { documentId: string; savedAt: number }) {
  const state = useDocumentSync(documentId, savedAt);
  if (!state) return null;
  const label = DOCUMENT_SYNC_LABEL[state];
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
        <Mark state={state} />
      </span>
    </Tooltip>
  );
}
