'use client';

// The unseen-folder mark on a diagram's Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "Folders livediagram cannot see").

import { HoverCard, Glyph } from '@livediagram/ui';
import { useDriveNotice } from './drive-mirror-context';

export const DRIVE_NOTICE_TEXT = "Moved in Drive to a folder livediagram can't see.";

export function DriveNoticeMarker({ diagramId }: { diagramId: string }) {
  const notice = useDriveNotice(diagramId);
  if (!notice) return null;
  return (
    <HoverCard
      title="In a Drive folder livediagram can't see"
      description={`${DRIVE_NOTICE_TEXT} Open Settings, Account, Cloud Sync to show it the folder.`}
    >
      <span
        aria-label={DRIVE_NOTICE_TEXT}
        className="inline-flex shrink-0 items-center text-amber-600 dark:text-amber-400"
      >
        <Glyph size={13} units={16}>
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
          <path d="M8 7v2.5" />
          <path d="M8 11.2v.1" />
        </Glyph>
      </span>
    </HoverCard>
  );
}
