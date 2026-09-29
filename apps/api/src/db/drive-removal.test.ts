import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteFolder } from './folders';
import { purgeDocuments, trashDocument } from './trash';
import { deleteDocument } from './documents';

// Deleting a document, folder or account deletes its mirror rows in the same
// batch as the rest of the removal (docs/specs/022-drive-mirror/drive-mirror.md, "Data").

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function mirrorRow(sql: DatabaseSync, owner: string, kind: string, ldId: string, fileId: string) {
  insert(sql, 'drive_items', {
    owner_id: owner,
    item_kind: kind,
    ld_id: ldId,
    drive_file_id: fileId,
    name: ldId,
    ld_name: ldId,
    parent_id: null,
  });
}

function rows(sql: DatabaseSync): string[] {
  return (
    sql.prepare('SELECT item_kind, ld_id FROM drive_items ORDER BY item_kind, ld_id').all() as {
      item_kind: string;
      ld_id: string;
    }[]
  ).map((r) => `${r.item_kind}:${r.ld_id}`);
}

function world() {
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
    mirrorRow(db.sql, 'user_a', 'document', id, `file-${id}`);
  }
  insert(db.sql, 'folders', {
    id: 'fold',
    owner_id: 'user_a',
    parent_id: null,
    name: 'Fold',
    created_at: T0,
    updated_at: T0,
  });
  mirrorRow(db.sql, 'user_a', 'folder', 'fold', 'file-fold');
  // A folder mirror row whose ld id happens to equal a document id must survive
  // that document's removal: the kind is part of the key.
  mirrorRow(db.sql, 'user_a', 'folder', 'doomed', 'file-folder-doomed');
  return db;
}

describe('mirror rows follow their removals', () => {
  it('a purge drops the purged document rows only', async () => {
    const db = world();
    await trashDocument(db.env, 'doomed', T0);
    await purgeDocuments(db.env, ['doomed']);
    expect(rows(db.sql)).toEqual(['document:keep', 'folder:doomed', 'folder:fold']);
  });

  it('trashing keeps the row (the file goes to the bin, it is not forgotten)', async () => {
    const db = world();
    await trashDocument(db.env, 'doomed', T0);
    expect(rows(db.sql)).toContain('document:doomed');
  });

  it('the immediate hard delete (Take Offline) drops the row', async () => {
    const db = world();
    await deleteDocument(db.env, 'doomed');
    expect(rows(db.sql)).toEqual(['document:keep', 'folder:doomed', 'folder:fold']);
  });

  it('deleting a folder drops its folder row in the same batch', async () => {
    const db = world();
    await deleteFolder(db.env, 'fold');
    expect(rows(db.sql)).toEqual(['document:doomed', 'document:keep', 'folder:doomed']);
    expect(db.sql.prepare("SELECT 1 FROM folders WHERE id = 'fold'").get()).toBeUndefined();
  });
});
