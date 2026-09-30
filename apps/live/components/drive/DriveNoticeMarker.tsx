'use client';

// The unseen-folder mark on a document's Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "Folders livediagram cannot see").

import { lucideFolderLock } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { DRIVE_NOTICE_TEXT } from '@/lib/drive/cloud-sync-copy';
import { useDriveNotice } from './drive-mirror-context';

// Vendored Lucide glyph (docs/specs/004-interface-design/iconography.md): a
// folder livediagram has no access to.
const FolderLockGlyph = lucideGlyph(lucideFolderLock, 13);

export function DriveNoticeMarker({ documentId }: { documentId: string }) {
  const notice = useDriveNotice(documentId);
  if (!notice) return null;
  return (
    <HoverCard
      title="In a folder livediagram can't see"
      description="Open Settings › Account › Cloud Sync to show livediagram that folder."
    >
      <span
        aria-label={DRIVE_NOTICE_TEXT}
        className="inline-flex shrink-0 items-center text-amber-600 dark:text-amber-400"
      >
        <FolderLockGlyph />
      </span>
    </HoverCard>
  );
}
