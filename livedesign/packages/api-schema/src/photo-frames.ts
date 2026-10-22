// A tab's photos as `photo` room ops (docs/specs/031-photo/photo-store.md "Live sync"): per photo
// page, its layer ops in frames the room will carry, or that its photo is gone. The editor's
// broadcast uses it, so every path that saves a tab says the same about its photos.
import { diffPhoto, photosOf, PHOTO_FRAME_CHARS, type PhotoOp } from '@livedesign/photo-engine';
import type { RoomOp } from './room-messages';

type PhotosTab = { id: string; photos?: unknown };

/** The `photo` ops from `before`'s photos to `after`'s. Stored photos are compared by identity
 *  first, so an untouched photo costs nothing. */
export function tabPhotoOps(before: PhotosTab, after: PhotosTab): RoomOp[] {
  if (before.photos === after.photos) return [];
  const rawWas = (before.photos ?? {}) as Record<string, unknown>;
  const rawNow = (after.photos ?? {}) as Record<string, unknown>;
  const was = photosOf(before);
  const now = photosOf(after);
  const ops: RoomOp[] = [];
  for (const pageId of Object.keys(was))
    if (!(pageId in now)) ops.push({ kind: 'photo', tabId: after.id, pageId, removed: true });
  for (const [pageId, photo] of Object.entries(now)) {
    if (rawWas[pageId] !== undefined && rawWas[pageId] === rawNow[pageId]) continue;
    let frame: PhotoOp[] = [];
    let chars = 0;
    for (const op of diffPhoto(was[pageId], photo)) {
      const size = JSON.stringify(op).length;
      if (frame.length > 0 && chars + size > PHOTO_FRAME_CHARS) {
        ops.push({ kind: 'photo', tabId: after.id, pageId, ops: frame });
        frame = [];
        chars = 0;
      }
      frame.push(op);
      chars += size;
    }
    if (frame.length > 0) ops.push({ kind: 'photo', tabId: after.id, pageId, ops: frame });
  }
  return ops;
}
