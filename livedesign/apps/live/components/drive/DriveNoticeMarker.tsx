'use client';

// The unseen-folder mark on a document's Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "Folders livepages cannot see").

import { lucideFolderLock } from '@livepages/icons/lucide';
import { HoverCard, lucideGlyph } from '@livepages/ui';
import { DRIVE_NOTICE_TEXT } from '@/lib/drive/cloud-sync-copy';
import { useDriveNotice } from './drive-mirror-context';

// Vendored Lucide glyph (docs/specs/004-interface-design/iconography.md): a
// folder livepages has no access to.
const FolderLockGlyph = lucideGlyph(lucideFolderLock, 13);

export function DriveNoticeMarker({ documentId }: { documentId: string }) {
  const notice = useDriveNotice(documentId);
  if (!notice) return null;
  return (
    <HoverCard
      title="In a folder livepages can't see"
      description="Open Settings › Account › Cloud Sync to show livepages that folder."
    >
      <span
        role="img"
        aria-label={DRIVE_NOTICE_TEXT}
        className="inline-flex shrink-0 items-center text-amber-600 dark:text-amber-400"
      >
        <FolderLockGlyph />
      </span>
    </HoverCard>
  );
}
