// One pass's view of both sides (liveworkspace/docs/drive.md "The service"): the person's own work as the index
// holds it, and the mirror's rows, indexed the ways the planners look them up.

import type { DriveFile } from '../server/drive-client';
import type { DriveRow, DriveRowKind, MirrorFolder, MirrorItem, MirrorTrashed } from './types';

export type MirrorSnapshot = {
  // This environment's liveworkspace origin, the `lwOrigin` the service stamps on what it makes.
  origin: string;
  rootFolderId: string;
  items: Map<string, MirrorItem>;
  folders: Map<string, MirrorFolder>;
  trash: Map<string, MirrorTrashed>;
  // Keyed by rowKey(kind, id).
  rows: Map<string, DriveRow>;
  rowsByFile: Map<string, DriveRow>;
};

export const rowKey = (kind: DriveRowKind, id: string) => `${kind}:${id}`;

export function buildSnapshot(input: {
  origin: string;
  rootFolderId: string;
  items: MirrorItem[];
  folders: MirrorFolder[];
  trash: MirrorTrashed[];
  rows: DriveRow[];
}): MirrorSnapshot {
  return {
    origin: input.origin,
    rootFolderId: input.rootFolderId,
    items: new Map(input.items.map((i) => [i.id, i])),
    folders: new Map(input.folders.map((f) => [f.id, f])),
    trash: new Map(input.trash.map((t) => [t.id, t])),
    rows: new Map(input.rows.map((r) => [rowKey(r.kind, r.id), r])),
    rowsByFile: new Map(input.rows.map((r) => [r.driveFileId, r])),
  };
}

/** Whether liveworkspace deleted this folder: its row outlives it until the Drive folder is binned, so a change
 *  Drive still reports for it (the create made before the delete) is stale, never a folder to bring back. */
export const folderDeletedHere = (snapshot: MirrorSnapshot, folderId: string) =>
  snapshot.rows.has(rowKey('folder', folderId)) && !snapshot.folders.has(folderId);

/** Record (or replace) a row in the snapshot's indexes. */
export function putSnapshotRow(snapshot: MirrorSnapshot, row: DriveRow): void {
  const key = rowKey(row.kind, row.id);
  const previous = snapshot.rows.get(key);
  if (previous && previous.driveFileId !== row.driveFileId) snapshot.rowsByFile.delete(previous.driveFileId);
  snapshot.rows.set(key, row);
  snapshot.rowsByFile.set(row.driveFileId, row);
}

export function dropSnapshotRow(snapshot: MirrorSnapshot, kind: DriveRowKind, id: string): void {
  const key = rowKey(kind, id);
  const previous = snapshot.rows.get(key);
  if (previous) snapshot.rowsByFile.delete(previous.driveFileId);
  snapshot.rows.delete(key);
}

/** The Drive folder a liveworkspace folder id maps to: the root for the top level, the folder's file once
 *  mirrored, null while it isn't mirrored yet. */
export function folderFileId(snapshot: MirrorSnapshot, folderId: string | null): string | null {
  if (folderId === null) return snapshot.rootFolderId;
  return snapshot.rows.get(rowKey('folder', folderId))?.driveFileId ?? null;
}

// Where a file belongs. Something at the top level because it was moved in Drive into a folder liveworkspace can't
// see stays where the person put it, so the notice's folder is its expected parent until it moves again.
function expectedParent(snapshot: MirrorSnapshot, localParent: string | null, row: DriveRow | undefined) {
  if (localParent === null && row?.notice === 'unseen_folder' && row.noticeParentId) return row.noticeParentId;
  return folderFileId(snapshot, localParent);
}

export const expectedItemParent = (snapshot: MirrorSnapshot, item: MirrorItem, row: DriveRow | undefined) =>
  expectedParent(snapshot, item.folderId, row);

export const expectedFolderParent = (snapshot: MirrorSnapshot, folder: MirrorFolder, row: DriveRow | undefined) =>
  expectedParent(snapshot, folder.parentId, row);

/** The liveworkspace folder a Drive parent id stands for: null for the root, the folder id for a mirrored folder,
 *  undefined for a folder liveworkspace can't see (or no parent at all). */
export function localFolderForParent(snapshot: MirrorSnapshot, parentId: string | null): string | null | undefined {
  if (parentId === null) return undefined;
  if (parentId === snapshot.rootFolderId) return null;
  const row = snapshot.rowsByFile.get(parentId);
  return row?.kind === 'folder' && snapshot.folders.has(row.id) ? row.id : undefined;
}

/** The Drive state a row records for a file. */
export function fileState(file: DriveFile): Pick<DriveRow, 'name' | 'parentId' | 'trashed' | 'md5' | 'headRevisionId'> {
  return {
    name: file.name,
    parentId: file.parents[0] ?? null,
    trashed: file.trashed,
    md5: file.md5Checksum,
    headRevisionId: file.headRevisionId,
  };
}

/** Folders parents first, so a child's Drive parent exists before it does. */
export function foldersParentsFirst(snapshot: MirrorSnapshot): MirrorFolder[] {
  const depths = new Map<string, number>();
  const depth = (f: MirrorFolder): number => {
    const known = depths.get(f.id);
    if (known !== undefined) return known;
    let d = 0;
    let cursor = f.parentId;
    const seen = new Set<string>([f.id]);
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      d += 1;
      cursor = snapshot.folders.get(cursor)?.parentId ?? null;
    }
    depths.set(f.id, d);
    return d;
  };
  return [...snapshot.folders.values()].sort((a, b) => depth(a) - depth(b) || a.id.localeCompare(b.id));
}
