import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { deleteFolder, moveFolder } from './folders';
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

// The cycle check runs inside the move's own UPDATE (docs/specs/013-workspace/folders.md), so two
// crossing moves cannot both pass a check made before either wrote.
describe('moveFolder', () => {
  it('moves a folder under an unrelated one', async () => {
    folder('a', null);
    folder('b', null);
    expect(await moveFolder(db.env, 'a', 'b')).toBe(true);
    expect(parentOf('a')).toBe('b');
  });

  it('refuses the second of two crossing moves, leaving no loop', async () => {
    folder('a', null);
    folder('b', null);
    // Both "checks" would have passed against the starting tree; the first write lands, the second
    // sees it inside its own statement.
    const [first, second] = await Promise.all([
      moveFolder(db.env, 'a', 'b'),
      moveFolder(db.env, 'b', 'a'),
    ]);
    expect([first, second]).toEqual([true, false]);
    expect(parentOf('a')).toBe('b');
    expect(parentOf('b')).toBeNull();
  });

  it('refuses a folder into itself or any descendant', async () => {
    folder('a', null);
    folder('b', 'a');
    folder('c', 'b');
    expect(await moveFolder(db.env, 'a', 'a')).toBe(false);
    expect(await moveFolder(db.env, 'a', 'c')).toBe(false);
    expect(parentOf('a')).toBeNull();
  });

  it('refuses a parent that no longer exists', async () => {
    folder('a', null);
    expect(await moveFolder(db.env, 'a', 'gone')).toBe(false);
    expect(parentOf('a')).toBeNull();
  });

  it('moves to the root', async () => {
    folder('a', null);
    folder('b', 'a');
    expect(await moveFolder(db.env, 'b', null)).toBe(true);
    expect(parentOf('b')).toBeNull();
  });

  it('ends its walk on an already corrupt loop', async () => {
    folder('x', null);
    folder('y', 'x');
    db.sql.prepare("UPDATE folders SET parent_id = 'y' WHERE id = 'x'").run();
    folder('a', null);
    expect(await moveFolder(db.env, 'a', 'x')).toBe(true);
  });

  it('walks a deep chain in one statement', async () => {
    folder('f0', null);
    for (let i = 1; i < 500; i++) folder(`f${i}`, `f${i - 1}`);
    const started = performance.now();
    expect(await moveFolder(db.env, 'f0', 'f499')).toBe(false);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
