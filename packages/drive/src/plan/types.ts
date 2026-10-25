// The two sides a pass compares (liveworkspace/docs/drive.md "The service"): the person's own work as the index
// holds it, and the mirror's rows, the last Drive state the service knows for each item and folder.

import type { AppName } from '../formats';

export type DriveRowKind = 'item' | 'folder';

export type DriveNotice = 'unseen_folder';

export type DriveRow = {
  kind: DriveRowKind;
  // The liveworkspace item or folder id.
  id: string;
  // The item's app; null for a folder.
  app: AppName | null;
  driveFileId: string;
  // The file as the service last wrote or read it.
  name: string;
  parentId: string | null;
  trashed: boolean;
  md5: string | null;
  headRevisionId: string | null;
  // The liveworkspace name Drive's name stands for.
  localName: string;
  // The item's `updatedAt` the file's contents were last written from; null before the first write, 0 when Drive's
  // contents changed and must be rewritten.
  mirroredUpdatedAt: number | null;
  // When the contents were last written, for the per-item write interval.
  contentWrittenAt: number | null;
  notice: DriveNotice | null;
  // The Drive folder the person put it in that liveworkspace can't see.
  noticeParentId: string | null;
};

/** A live personal item. */
export type MirrorItem = {
  id: string;
  app: AppName;
  name: string;
  folderId: string | null;
  updatedAt: number;
  createdAt: number;
};

export type MirrorFolder = { id: string; name: string; parentId: string | null; updatedAt: number };

/** A personal item in the Trash. */
export type MirrorTrashed = { id: string; app: AppName; name: string; trashedAt: number };
