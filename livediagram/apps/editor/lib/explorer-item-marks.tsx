'use client';

// livediagram's own marks on the shared Explorer's items (@liveworkspace/explorer RenderItemMark,
// docs/specs/022-drive-mirror/drive-mirror.md "The Explorer shows each document's sync"): beside a canvas's name, the
// unseen-folder mark when its Drive copy sits in a folder livediagram cannot see; beside its Updated time, where it
// stands with Google Drive. Only a canvas the mirror copies has either: the person's own, in their own space, not
// shared with them, not in the Trash.
import type { RenderItemMark } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import { DocumentSyncMark } from '@/components/drive/DocumentSyncMark';
import { DriveNoticeMarker } from '@/components/drive/DriveNoticeMarker';

/** Whether the Google Drive mirror copies this item for this person. */
export function isMirroredItem(item: Item, accountId: string | null): boolean {
  return (
    accountId !== null &&
    item.app === 'livediagram' &&
    item.ownerId === accountId &&
    item.teamId === null &&
    item.sharedVia === null &&
    item.trashedAt === null
  );
}

const cache = new Map<string | null, RenderItemMark>();

/** The marks for this person's Explorer, one function per person so the Explorer's rows keep their memo. */
export function driveItemMarks(accountId: string | null): RenderItemMark {
  let marks = cache.get(accountId);
  if (!marks) {
    marks = (item, at) => {
      if (!isMirroredItem(item, accountId)) return null;
      return at === 'title' ? (
        <DriveNoticeMarker documentId={item.id} />
      ) : (
        <DocumentSyncMark documentId={item.id} savedAt={item.updatedAt} mirrorable />
      );
    };
    if (cache.size > 8) cache.clear();
    cache.set(accountId, marks);
  }
  return marks;
}
