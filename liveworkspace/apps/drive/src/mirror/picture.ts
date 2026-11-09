// The person's picture as a pass reads it (liveworkspace/docs/specs/005-drive/drive.md "Cadence", "The picture"): the
// last one read is kept in the object's SQLite, and most passes read only what changed since (the live items whose
// updatedAt moved, every folder, the whole Trash) and merge it over the kept one. A move leaves an item's updatedAt
// alone, and an item deleted straight from the live list leaves no trace, so a whole read still comes at least every
// DRIVE_PICTURE_FULL_MS, and at once whenever the kept picture can't be trusted: none kept, Check now or a fresh root
// (`full`), the mirror's own write to the index (stale), a folder gone from under a kept item, or too many items out
// of the Trash to read one by one.

import type { MirrorItem, MirrorTrashed } from '@liveworkspace/drive';
import type { Picture, PersonIndex } from '../index-api';
import type { KeptPicture, MirrorStore, PictureState } from './store';

const MINUTE = 60_000;
/** The longest a pass goes on reading only what changed before it reads the whole picture again. */
export const DRIVE_PICTURE_FULL_MS = 10 * MINUTE;
/** How far before the last read a read of what changed looks: a summary push that arrives a little late. */
export const DRIVE_PICTURE_SLACK_MS = 5 * MINUTE;
/** Items out of the Trash since the last read, each read on its own; more is a whole read. */
export const DRIVE_PICTURE_RECHECKS_MAX = 10;

/** `index` with `picture()` reading what changed when it can, and every write marking the kept picture stale. */
export function pictureIndex(
  index: PersonIndex,
  store: MirrorStore,
  now: () => number,
): PersonIndex {
  // Any write the mirror makes to the index: the next read is whole, as a write may be a move it cannot see. Marked
  // once until the next read (a pass applying hundreds of Drive-side changes writes the mark once).
  let marked = false;
  const stale =
    <A extends unknown[], R>(write: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (!marked) store.stalePicture();
      marked = true;
      return write(...args);
    };
  return {
    ...index,
    picture: async (options) => {
      const picture = await readPicture(index, store, now, options?.full === true);
      marked = false;
      return picture;
    },
    renameItem: stale(index.renameItem),
    moveItem: stale(index.moveItem),
    trashItem: stale(index.trashItem),
    restoreItem: stale(index.restoreItem),
    purgeItem: stale(index.purgeItem),
    createFolder: stale(index.createFolder),
    renameFolder: stale(index.renameFolder),
    moveFolder: stale(index.moveFolder),
    deleteFolder: stale(index.deleteFolder),
  };
}

async function readPicture(
  index: PersonIndex,
  store: MirrorStore,
  now: () => number,
  full: boolean,
): Promise<Picture> {
  // The moment before the read: anything changed during it is at or after this, so the next read sees it.
  const at = now();
  const state = store.pictureState();
  if (!full && state && state.fullAt > 0 && at - state.fullAt < DRIVE_PICTURE_FULL_MS) {
    const kept = store.keptPicture();
    const merged = await readChanged(index, kept, state);
    if (merged) {
      store.keepPicture(merged, { readAt: at, fullAt: state.fullAt }, kept);
      return merged;
    }
  }
  const picture = await index.picture();
  store.keepPicture(picture, { readAt: at, fullAt: at });
  return picture;
}

// The kept picture brought up to date from what changed, or null when that can't be trusted (a whole read instead).
async function readChanged(
  index: PersonIndex,
  kept: KeptPicture,
  state: PictureState,
): Promise<Picture | null> {
  const changed = await index.changedSince(Math.max(0, state.readAt - DRIVE_PICTURE_SLACK_MS));
  const items = new Map<string, MirrorItem>(kept.items);
  for (const item of changed.items) items.set(item.id, item);
  const trash = new Map<string, MirrorTrashed>(changed.trash.map((t) => [t.id, t]));
  // In the Trash now: not live (a trash leaves updatedAt alone, so the Trash says so, not the changed items).
  for (const id of trash.keys()) items.delete(id);
  // Out of the Trash since: restored (live again, its updatedAt where it was) or deleted for good.
  const left = [...kept.trash.keys()].filter((id) => !trash.has(id) && !items.has(id));
  if (left.length > DRIVE_PICTURE_RECHECKS_MAX) return null;
  for (const id of left) {
    const item = await index.readItem(id);
    if (item) items.set(id, item);
  }
  // A folder deleted moves its items up without touching them: a kept item in a folder now gone needs a whole read.
  const folders = new Set(changed.folders.map((f) => f.id));
  for (const item of items.values()) {
    if (item.folderId !== null && !folders.has(item.folderId)) return null;
  }
  return { items: [...items.values()], folders: changed.folders, trash: changed.trash };
}
