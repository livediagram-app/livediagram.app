'use client';

// Where one document stands with Google Drive, on its Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "The Explorer shows each document's sync"):
// a small cloud beside its Updated time. Synced, waiting to sync, or syncing,
// each a different glyph so colour is never the only signal, and named on
// hover and focus. Nothing at all for a document that is not mirrored.

import {
  lucideCloudAlert,
  lucideCloudCheck,
  lucideCloudSync,
  lucideCloudUpload,
} from '@livediagram/icons/lucide';
import type { IconPrim } from '@livediagram/icons';
import { Glyph, Tooltip, type IconProps } from '@livediagram/ui';
import { useDocumentSync, type DocumentSyncState } from './drive-mirror-context';

export const DOCUMENT_SYNC_LABEL: Record<DocumentSyncState, string> = {
  synced: 'Synced to Google Drive',
  waiting: 'Waiting to sync to Google Drive',
  syncing: 'Syncing to Google Drive…',
  failed: "Couldn't sync to Google Drive. Trying again automatically.",
};

// Lucide's cloud glyphs as vendored, in two tones: the cloud stays as quiet as
// the metadata beside it, and only the symbol on it takes a colour, the check
// green (done), the arrows blue (on their way). The cloud is the one path of
// each glyph drawn with the cloud's arcs; everything else is the symbol.
const isCloud = (d: string) => d.includes('7 7 0');

const ACCENT: Record<DocumentSyncState, string> = {
  synced: 'text-emerald-600 dark:text-emerald-400',
  waiting: 'text-blue-600 dark:text-blue-400',
  syncing: 'text-blue-600 dark:text-blue-400',
  failed: 'text-amber-600 dark:text-amber-400',
};

const PRIMS: Record<DocumentSyncState, readonly IconPrim[]> = {
  synced: lucideCloudCheck,
  waiting: lucideCloudUpload,
  syncing: lucideCloudSync,
  failed: lucideCloudAlert,
};

// Vendored Lucide glyphs (docs/specs/004-interface-design/iconography.md).
function SyncGlyph({ state, size = 14, ...rest }: IconProps & { state: DocumentSyncState }) {
  return (
    <Glyph size={size} units={24} {...rest}>
      {PRIMS[state].map((p, i) =>
        p.t === 'path' ? (
          <path
            key={i}
            d={p.d}
            data-sync-part={isCloud(p.d) ? 'cloud' : 'symbol'}
            className={isCloud(p.d) ? undefined : ACCENT[state]}
          />
        ) : null,
      )}
    </Glyph>
  );
}

// On-screen stroke in px.
export const DOCUMENT_SYNC_WEIGHT = 1;

export function DocumentSyncMark({
  documentId,
  savedAt,
  mirrorable,
}: {
  documentId: string;
  savedAt: number;
  // The document belongs in Drive: the user's own, in their Personal Space, not
  // offline. Known from the row itself, so a new document shows Waiting at once.
  mirrorable: boolean;
}) {
  const state = useDocumentSync(documentId, savedAt, mirrorable);
  if (!state) return null;
  const label = DOCUMENT_SYNC_LABEL[state];
  return (
    <Tooltip label={label}>
      <span
        role="img"
        tabIndex={0}
        aria-label={label}
        data-document-sync={state}
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-slate-400 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-500 ${
          state === 'syncing' ? 'motion-safe:animate-pulse' : ''
        }`}
      >
        {/* Finer than the house weight: a quiet mark beside quiet metadata. */}
        <SyncGlyph state={state} weight={DOCUMENT_SYNC_WEIGHT} />
      </span>
    </Tooltip>
  );
}
