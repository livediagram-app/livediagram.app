import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { deleteFolder } from './folders';
import { setDocumentFolder } from './documents';

// The placement write on a real schema (docs/specs/013-workspace/folders.md "API"): the folder's
// existence and scope are checked inside the UPDATE, so a folder deleted after the route read it
// files nothing (the route answers 404) instead of leaving the document under a folder that is gone.

const T0 = 1_700_000_000_000;
let db: SqliteD1;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function folder(id: string, owner = 'owner', team: string | null = null) {
  insert(db.sql, 'folders', {
    id,
    owner_id: owner,
    parent_id: null,
    name: id,
    team_id: team,
    created_at: T0,
    updated_at: T0,
  });
}

function doc(id: string, owner = 'owner', team: string | null = null) {
  insert(db.sql, 'documents', {
    id,
    owner_id: owner,
    name: id,
    shareable: 0,
    team_id: team,
    folder_id: null,
    saved_at: T0,
    created_at: T0,
  });
}

const row = (id: string) =>
  db.sql.prepare('SELECT folder_id, team_id, owner_id FROM documents WHERE id = ?').get(id) as {
    folder_id: string | null;
    team_id: string | null;
    owner_id: string;
  };

beforeEach(() => {
  db = sqliteD1();
});

describe('setDocumentFolder', () => {
  it('files a document in its owner’s folder', async () => {
    folder('f');
    doc('d');
    expect(await setDocumentFolder(db.env, 'd', 'f')).toBe(true);
    expect(row('d').folder_id).toBe('f');
  });

  it('files nothing when the folder was deleted after the route read it', async () => {
    folder('f');
    doc('d');
    await deleteFolder(db.env, 'f');
    expect(await setDocumentFolder(db.env, 'd', 'f')).toBe(false);
    expect(row('d').folder_id).toBeNull();
  });

  it('files nothing into a folder that moved to another scope', async () => {
    folder('f', 'owner', 'team-1');
    doc('d');
    expect(await setDocumentFolder(db.env, 'd', 'f', null)).toBe(false);
    expect(await setDocumentFolder(db.env, 'd', 'f', 'team-2')).toBe(false);
    expect(row('d')).toEqual({ folder_id: null, team_id: null, owner_id: 'owner' });
  });

  it('files nothing into another owner’s personal folder', async () => {
    folder('theirs', 'someone-else');
    doc('d');
    expect(await setDocumentFolder(db.env, 'd', 'theirs')).toBe(false);
  });

  it('checks a transferred document against the NEW owner’s folders', async () => {
    folder('mine', 'member');
    doc('d', 'alice', 'team-1');
    expect(await setDocumentFolder(db.env, 'd', 'mine', null, 'member')).toBe(true);
    expect(row('d')).toEqual({ folder_id: 'mine', team_id: null, owner_id: 'member' });
  });

  it('files a team document in its team’s folder, and to a root', async () => {
    folder('tf', 'alice', 'team-1');
    doc('d', 'alice', 'team-1');
    expect(await setDocumentFolder(db.env, 'd', 'tf', 'team-1')).toBe(true);
    expect(await setDocumentFolder(db.env, 'd', null, 'team-1')).toBe(true);
    expect(row('d').folder_id).toBeNull();
  });
});
