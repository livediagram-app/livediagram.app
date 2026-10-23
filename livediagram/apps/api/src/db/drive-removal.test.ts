import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { DriveItem, DriveItemKind } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { listDriveItems, putDriveItems } from './drive';
import { deleteFolder } from './folders';
import { purgeDocuments, trashDocument } from './trash';
import { deleteDocument } from './documents';

// A removed document or folder is no longer mirrored (docs/specs/022-drive-mirror/drive-mirror.md, "Data"): its
// row in the person's store goes the next time their mirror is listed, and the browser finishes the Drive side from
// its own memory of the rows it saw.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function mirrorRow(kind: DriveItemKind, ldId: string, fileId: string): DriveItem {
  return {
    kind,
    ldId,
    driveFileId: fileId,
    name: ldId,
    ldName: ldId,
    parentId: null,
    trashed: false,
    md5: null,
    headRevisionId: null,
    mirroredSavedAt: null,
    notice: null,
    noticeParentId: null,
  };
}

async function rows(db: SqliteD1): Promise<string[]> {
  return (await listDriveItems(db.env, 'user_a')).map((r) => `${r.kind}:${r.ldId}`);
}

async function world() {
  const db = sqliteD1();
  for (const id of ['keep', 'doomed']) {
    insert(db.sql, 'documents', {
      id,
      owner_id: 'user_a',
      name: id,
      shareable: 0,
      saved_at: T0,
      created_at: T0,
    });
  }
  // A folder whose id happens to equal a document's: the kind is part of the key, so its row outlives that
  // document's removal.
  for (const id of ['fold', 'doomed']) {
    insert(db.sql, 'folders', {
      id,
      owner_id: 'user_a',
      parent_id: null,
      name: id,
      created_at: T0,
      updated_at: T0,
    });
  }
  await putDriveItems(db.env, 'user_a', [
    mirrorRow('document', 'keep', 'file-keep'),
    mirrorRow('document', 'doomed', 'file-doomed'),
    mirrorRow('folder', 'fold', 'file-fold'),
    mirrorRow('folder', 'doomed', 'file-folder-doomed'),
  ]);
  return db;
}

describe('mirror rows follow their removals', () => {
  it('a purge drops the purged document rows only', async () => {
    const db = await world();
    await trashDocument(db.env, 'doomed', T0);
    await purgeDocuments(db.env, ['doomed']);
    expect(await rows(db)).toEqual(['document:keep', 'folder:doomed', 'folder:fold']);
  });

  it('trashing keeps the row (the file goes to the bin, it is not forgotten)', async () => {
    const db = await world();
    await trashDocument(db.env, 'doomed', T0);
    expect(await rows(db)).toContain('document:doomed');
  });

  it('the immediate hard delete (Take Offline) drops the row', async () => {
    const db = await world();
    await deleteDocument(db.env, 'doomed');
    expect(await rows(db)).toEqual(['document:keep', 'folder:doomed', 'folder:fold']);
  });

  it('deleting a folder drops its folder row', async () => {
    const db = await world();
    await deleteFolder(db.env, 'fold');
    expect(await rows(db)).toEqual(['document:doomed', 'document:keep', 'folder:doomed']);
    expect(db.sql.prepare("SELECT 1 FROM folders WHERE id = 'fold'").get()).toBeUndefined();
  });
});
