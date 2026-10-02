// One pass's view of both sides (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Passes"): My documents as livediagram holds it, and the mirror's item
// rows, indexed the ways the planners look them up.

import type { DriveItem, DriveItemKind } from '@livediagram/api-schema';
import type { DriveFile } from './drive-client';
import type { MirrorDocument, MirrorFolder, MirrorTrashed } from './livediagram-port';

export type MirrorSnapshot = {
  host: string;
  rootFolderId: string;
  documents: Map<string, MirrorDocument>;
  folders: Map<string, MirrorFolder>;
  trash: Map<string, MirrorTrashed>;
  // Keyed by itemKey(kind, ldId).
  items: Map<string, DriveItem>;
  itemsByFile: Map<string, DriveItem>;
};

export const itemKey = (kind: DriveItemKind, ldId: string) => `${kind}:${ldId}`;

export function buildSnapshot(input: {
  host: string;
  rootFolderId: string;
  documents: MirrorDocument[];
  folders: MirrorFolder[];
  trash: MirrorTrashed[];
  items: DriveItem[];
}): MirrorSnapshot {
  return {
    host: input.host,
    rootFolderId: input.rootFolderId,
    documents: new Map(input.documents.map((d) => [d.id, d])),
    folders: new Map(input.folders.map((f) => [f.id, f])),
    trash: new Map(input.trash.map((t) => [t.id, t])),
    items: new Map(input.items.map((i) => [itemKey(i.kind, i.ldId), i])),
    itemsByFile: new Map(input.items.map((i) => [i.driveFileId, i])),
  };
}

// Record (or replace) an item in the snapshot's indexes.
export function putSnapshotItem(snapshot: MirrorSnapshot, item: DriveItem): void {
  const key = itemKey(item.kind, item.ldId);
  const previous = snapshot.items.get(key);
  if (previous && previous.driveFileId !== item.driveFileId) {
    snapshot.itemsByFile.delete(previous.driveFileId);
  }
  snapshot.items.set(key, item);
  snapshot.itemsByFile.set(item.driveFileId, item);
}

export function dropSnapshotItem(
  snapshot: MirrorSnapshot,
  kind: DriveItemKind,
  ldId: string,
): void {
  const key = itemKey(kind, ldId);
  const previous = snapshot.items.get(key);
  if (previous) snapshot.itemsByFile.delete(previous.driveFileId);
  snapshot.items.delete(key);
}

// The Drive folder a livediagram folder id maps to: the root for Unsorted,
// the folder's file once mirrored, null while it is not mirrored yet.
export function folderFileId(snapshot: MirrorSnapshot, folderId: string | null): string | null {
  if (folderId === null) return snapshot.rootFolderId;
  return snapshot.items.get(itemKey('folder', folderId))?.driveFileId ?? null;
}

// Where a document's file belongs. A document sitting in Unsorted because it was
// moved in Drive into a folder livediagram cannot see stays where the user put
// it, so the notice's folder is its expected parent until it moves again.
export function expectedDocumentParent(
  snapshot: MirrorSnapshot,
  liveDoc: MirrorDocument,
  item: DriveItem | undefined,
): string | null {
  if (liveDoc.folderId === null && item?.notice === 'unseen_folder' && item.noticeParentId) {
    return item.noticeParentId;
  }
  return folderFileId(snapshot, liveDoc.folderId);
}

export function expectedFolderParent(
  snapshot: MirrorSnapshot,
  folder: MirrorFolder,
  item: DriveItem | undefined,
): string | null {
  if (folder.parentId === null && item?.notice === 'unseen_folder' && item.noticeParentId) {
    return item.noticeParentId;
  }
  return folderFileId(snapshot, folder.parentId);
}

// The livediagram folder a Drive parent id stands for: `null` for the root
// (Unsorted / top level), the folder id for a mirrored folder, `undefined`
// for a folder livediagram cannot see (or no parent at all).
export function ldFolderForParent(
  snapshot: MirrorSnapshot,
  parentId: string | null,
): string | null | undefined {
  if (parentId === null) return undefined;
  if (parentId === snapshot.rootFolderId) return null;
  const item = snapshot.itemsByFile.get(parentId);
  return item?.kind === 'folder' && snapshot.folders.has(item.ldId) ? item.ldId : undefined;
}

// The Drive state an item records for a file.
export function fileState(
  file: DriveFile,
): Pick<DriveItem, 'name' | 'parentId' | 'trashed' | 'md5' | 'headRevisionId'> {
  return {
    name: file.name,
    parentId: file.parents[0] ?? null,
    trashed: file.trashed,
    md5: file.md5Checksum,
    headRevisionId: file.headRevisionId,
  };
}

// The folder ids under `folderId` (itself included), parents before children.
export function folderSubtree(snapshot: MirrorSnapshot, folderId: string): string[] {
  const out = [folderId];
  for (let i = 0; i < out.length; i++) {
    for (const f of snapshot.folders.values()) {
      if (f.parentId === out[i] && !out.includes(f.id)) out.push(f.id);
    }
  }
  return out;
}

// Folders parents first, so a child's Drive parent exists before it does.
export function foldersParentsFirst(snapshot: MirrorSnapshot): MirrorFolder[] {
  const depth = (f: MirrorFolder): number => {
    let d = 0;
    let cursor = f.parentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      d += 1;
      cursor = snapshot.folders.get(cursor)?.parentId ?? null;
    }
    return d;
  };
  return [...snapshot.folders.values()].sort(
    (a, b) => depth(a) - depth(b) || a.id.localeCompare(b.id),
  );
}
