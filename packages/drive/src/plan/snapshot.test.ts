import { describe, expect, it } from 'vitest';
import type { DriveFile } from '../server/drive-client';
import {
  buildSnapshot,
  dropSnapshotRow,
  fileState,
  folderDeletedHere,
  folderFileId,
  foldersParentsFirst,
  localFolderForParent,
  putSnapshotRow,
  rowKey,
} from './snapshot';
import type { DriveRow, MirrorFolder } from './types';

const row = (over: Partial<DriveRow> = {}): DriveRow => ({
  kind: 'folder',
  id: 'f1',
  app: null,
  driveFileId: 'file-f1',
  name: 'Work',
  localName: 'Work',
  parentId: 'root',
  trashed: false,
  md5: null,
  headRevisionId: null,
  mirroredUpdatedAt: null,
  contentWrittenAt: null,
  notice: null,
  noticeParentId: null,
  ...over,
});

const WORK: MirrorFolder = { id: 'f1', name: 'Work', parentId: null, updatedAt: 0 };

const snap = (folders: MirrorFolder[] = [WORK], rows: DriveRow[] = [row()]) =>
  buildSnapshot({
    origin: 'https://liveworkspace.test',
    rootFolderId: 'root',
    items: [],
    folders,
    trash: [],
    rows,
  });

describe('snapshot', () => {
  it('keys rows by kind and id, so an item and a folder may share an id', () => {
    const s = snap(
      [WORK],
      [row(), row({ kind: 'item', app: 'livediagram', driveFileId: 'file-i' })],
    );
    expect(s.rows.size).toBe(2);
    expect(s.rows.get(rowKey('item', 'f1'))!.driveFileId).toBe('file-i');
    expect(s.rowsByFile.get('file-f1')!.kind).toBe('folder');
  });

  it('replaces a row, dropping its old file from the file index', () => {
    const s = snap();
    putSnapshotRow(s, row({ driveFileId: 'file-new' }));
    expect(s.rowsByFile.has('file-f1')).toBe(false);
    expect(s.rowsByFile.get('file-new')!.id).toBe('f1');
    expect(s.rows.get(rowKey('folder', 'f1'))!.driveFileId).toBe('file-new');
    dropSnapshotRow(s, 'folder', 'f1');
    expect(s.rows.size).toBe(0);
    expect(s.rowsByFile.size).toBe(0);
    // Dropping what isn't there is fine.
    dropSnapshotRow(s, 'item', 'nope');
  });

  it('maps a folder to its Drive folder: the root for the top level, null before it is mirrored', () => {
    const s = snap();
    expect(folderFileId(s, null)).toBe('root');
    expect(folderFileId(s, 'f1')).toBe('file-f1');
    expect(folderFileId(s, 'f2')).toBeNull();
  });

  it('maps a Drive parent back to a folder: null for the root, undefined for anything it cannot see', () => {
    const s = snap();
    expect(localFolderForParent(s, 'root')).toBeNull();
    expect(localFolderForParent(s, 'file-f1')).toBe('f1');
    expect(localFolderForParent(s, 'hidden')).toBeUndefined();
    expect(localFolderForParent(s, null)).toBeUndefined();
    // A folder deleted here whose row outlives it is not a place to move into.
    const deleted = snap([], [row()]);
    expect(localFolderForParent(deleted, 'file-f1')).toBeUndefined();
    expect(folderDeletedHere(deleted, 'f1')).toBe(true);
    expect(folderDeletedHere(s, 'f1')).toBe(false);
    expect(folderDeletedHere(snap([], []), 'f1')).toBe(false);
  });

  it('records a file’s first parent and its content markers', () => {
    const file: DriveFile = {
      id: 'x',
      name: 'N',
      mimeType: 'm',
      parents: ['p1', 'p2'],
      trashed: true,
      appProperties: {},
      md5Checksum: 'md5',
      headRevisionId: 'rev',
      ownedByMe: true,
    };
    expect(fileState(file)).toEqual({
      name: 'N',
      parentId: 'p1',
      trashed: true,
      md5: 'md5',
      headRevisionId: 'rev',
    });
    expect(fileState({ ...file, parents: [] }).parentId).toBeNull();
  });

  it('orders folders parents first, by id within a level', () => {
    const s = snap([
      { ...WORK, id: 'c', parentId: 'b' },
      { ...WORK, id: 'b', parentId: 'a' },
      { ...WORK, id: 'y', parentId: null },
      { ...WORK, id: 'a', parentId: null },
      // A parent that isn't in the list counts as one level.
      { ...WORK, id: 'orphan', parentId: 'missing' },
    ]);
    expect(foldersParentsFirst(s).map((f) => f.id)).toEqual(['a', 'y', 'b', 'orphan', 'c']);
  });
});
