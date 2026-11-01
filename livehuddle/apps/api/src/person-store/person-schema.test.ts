import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migratePersonSchema } from './person-schema';

// A person's own SQLite (docs/specs/015-api/api.md "What each person's object holds"): steps append, and a store
// at any version reaches the latest. The second step drops livehuddle's own Google Drive mirror's tables
// (liveworkspace/docs/specs/005-drive/drive.md "Coming from livehuddle's mirror").

const tables = (db: DatabaseSync) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((r) => r.name);

const version = (db: DatabaseSync) =>
  (db.prepare('SELECT version FROM _person_schema').get() as { version: number }).version;

describe('migratePersonSchema', () => {
  it('leaves a new store with its shape libraries and no Drive tables', () => {
    const db = new DatabaseSync(':memory:');
    migratePersonSchema(nodeItemSql(db));
    expect(tables(db)).toEqual(['_person_schema', 'shape_libraries']);
    expect(version(db)).toBe(2);
  });

  it('drops a version 1 store’s Drive tables, sealed tokens and all, and keeps its libraries', () => {
    const db = new DatabaseSync(':memory:');
    const sql = nodeItemSql(db);
    migratePersonSchema(sql);
    // Back to version 1, as a store made before the step: the Drive tables, with a connection and an item in them.
    db.exec(`
      CREATE TABLE drive_connections (id INTEGER PRIMARY KEY, refresh_token_enc TEXT, connected_at INTEGER NOT NULL);
      INSERT INTO drive_connections VALUES (1, 'sealed', 1);
      CREATE TABLE drive_items (item_kind TEXT, ld_id TEXT, drive_file_id TEXT);
      INSERT INTO drive_items VALUES ('document', 'd1', 'f1');
      INSERT INTO shape_libraries VALUES ('l1', 'Icons', 'drawio', '[]', 1, 1);
      UPDATE _person_schema SET version = 1;
    `);

    migratePersonSchema(sql);

    expect(tables(db)).toEqual(['_person_schema', 'shape_libraries']);
    expect(version(db)).toBe(2);
    expect(db.prepare('SELECT id FROM shape_libraries').all()).toEqual([{ id: 'l1' }]);
  });

  it('runs nothing again on a store already at the latest version', () => {
    const db = new DatabaseSync(':memory:');
    const sql = nodeItemSql(db);
    migratePersonSchema(sql);
    db.exec('CREATE TABLE drive_items (x TEXT)');
    migratePersonSchema(sql);
    expect(tables(db)).toContain('drive_items');
  });
});
