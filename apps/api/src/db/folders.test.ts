import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { deleteFolder } from './folders';
import { trashDocument } from './trash';

// Deleting a folder on a real schema (docs/specs/013-workspace/folders.md "Deleting a folder",
// blueprint folder-delete.md): its direct documents and subfolders move up to its parent, the space
// root for a top-level folder, trashed documents included, in one batch with its Drive row.

const T0 = 1_700_000_000_000;
let db: SqliteD1;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function folder(id: string, parent: string | null, team: string | null = null) {
  insert(db.sql, 'folders', {
    id,
    owner_id: 'owner',
    parent_id: parent,
    name: id,
    team_id: team,
    created_at: T0,
    updated_at: T0,
  });
}

function doc(id: string, folderId: string | null, team: string | null = null) {
  insert(db.sql, 'documents', {
    id,
    owner_id: 'owner',
    name: id,
    shareable: 0,
    team_id: team,
    folder_id: folderId,
    saved_at: T0,
    created_at: T0,
  });
}

const parentOf = (id: string) =>
  (
    db.sql.prepare('SELECT parent_id FROM folders WHERE id = ?').get(id) as {
      parent_id: string | null;
    }
  ).parent_id;
const folderOf = (id: string) =>
  (
    db.sql.prepare('SELECT folder_id FROM documents WHERE id = ?').get(id) as {
      folder_id: string | null;
    }
  ).folder_id;
const exists = (id: string) =>
  db.sql.prepare('SELECT 1 FROM folders WHERE id = ?').get(id) !== undefined;

beforeEach(() => {
  db = sqliteD1();
});

describe('deleteFolder', () => {
  it('moves a nested folder’s documents and subfolders to its parent', async () => {
    folder('projects', null);
    folder('workshops', 'projects');
    folder('archive', 'workshops');
    doc('retro', 'workshops');

    await deleteFolder(db.env, 'workshops');

    expect(exists('workshops')).toBe(false);
    expect(parentOf('archive')).toBe('projects');
    expect(folderOf('retro')).toBe('projects');
  });

  it('moves a top-level folder’s contents to the root of its space', async () => {
    folder('workshops', null);
    folder('archive', 'workshops');
    doc('retro', 'workshops');

    await deleteFolder(db.env, 'workshops');

    expect(parentOf('archive')).toBeNull();
    expect(folderOf('retro')).toBeNull();
  });

  it('leaves grandchildren where they are', async () => {
    folder('projects', null);
    folder('workshops', 'projects');
    folder('archive', 'workshops');
    folder('2025', 'archive');
    doc('old', 'archive');

    await deleteFolder(db.env, 'workshops');

    expect(parentOf('2025')).toBe('archive');
    expect(folderOf('old')).toBe('archive');
  });

  it('moves trashed documents up too, so a restore lands in the parent', async () => {
    folder('projects', null);
    folder('workshops', 'projects');
    doc('binned', 'workshops');
    await trashDocument(db.env, 'binned', T0);

    await deleteFolder(db.env, 'workshops');

    expect(folderOf('binned')).toBe('projects');
  });

  it('moves a team folder’s contents to its parent in the same team', async () => {
    folder('design', null, 'team-a');
    folder('sprints', 'design', 'team-a');
    folder('week-1', 'sprints', 'team-a');
    doc('board', 'sprints', 'team-a');

    await deleteFolder(db.env, 'sprints');

    expect(parentOf('week-1')).toBe('design');
    expect(folderOf('board')).toBe('design');
  });

  it('touches nothing outside the folder', async () => {
    folder('a', null);
    folder('b', 'a');
    folder('c', null);
    doc('in-c', 'c');

    await deleteFolder(db.env, 'b');

    expect(folderOf('in-c')).toBe('c');
    expect(parentOf('c')).toBeNull();
  });

  it('answers the parent the contents moved to', async () => {
    folder('projects', null);
    folder('workshops', 'projects');
    folder('top', null);

    expect(await deleteFolder(db.env, 'workshops')).toEqual({ parentId: 'projects' });
    expect(await deleteFolder(db.env, 'top')).toEqual({ parentId: null });
  });
});
