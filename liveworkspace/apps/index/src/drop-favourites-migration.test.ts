import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';
import { foreignKeyProblems } from '../scripts/items-rebuild-check';

// 0023_drop_favourites.sql (liveworkspace/docs/specs/004-index/one-explorer.md "Favourites removed", Work Tracker
// 1199): the unread favourites table goes with its rows and two indexes, and nothing else changes.

const MIGRATION = '0023_drop_favourites.sql';
const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const SQL = readFileSync(MIGRATIONS + MIGRATION, 'utf8');

const count = (sql: DatabaseSync, query: string) =>
  Number((sql.prepare(`SELECT count(*) AS n FROM ${query}`).get() as { n: number }).n);
const schema = (sql: DatabaseSync) =>
  sql
    .prepare(
      `SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
    )
    .all() as { type: string; name: string; sql: string | null }[];
const isFavourites = (name: string) => name.startsWith('favourites');

// Every migration before this one, with an item, favourites on it and the rows beside them that must stay.
function before(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter((f) => f < MIGRATION)) {
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  }
  sql.exec(`
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at) VALUES
      ('i1', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', 'Plan', 1, 1);
    INSERT INTO favourites (person_id, item_id, created_at) VALUES ('u1', 'i1', 2), ('u2', 'i1', 3);
    INSERT INTO opens (person_id, item_id, last_opened_at, hidden) VALUES ('u1', 'i1', 4, 0);
    INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at) VALUES
      ('e1', 'liveplanner', 'i1', 'u1', 'Ada', 'favourited', 'Plan', NULL, 5);
  `);
  return sql;
}

// As D1 runs a migration file: one transaction, foreign keys on.
function apply(sql: DatabaseSync): void {
  sql.exec('BEGIN');
  sql.exec(SQL);
  sql.exec('COMMIT');
}

describe(MIGRATION, () => {
  it('drops the favourites table and its two indexes, and nothing else', () => {
    const sql = before();
    expect(
      schema(sql)
        .map((r) => r.name)
        .filter(isFavourites),
    ).toEqual(['favourites_item', 'favourites_person_created', 'favourites']);
    const rest = schema(sql).filter((r) => !isFavourites(r.name));

    apply(sql);

    expect(schema(sql)).toEqual(rest);
    expect(foreignKeyProblems(sql)).toEqual([]);
  });

  it('keeps the item, its opens and its old favourited event', () => {
    const sql = before();
    apply(sql);
    expect(count(sql, 'items')).toBe(1);
    expect(count(sql, 'opens')).toBe(1);
    expect(count(sql, `events WHERE type = 'favourited'`)).toBe(1);
    // An item still deletes cleanly, its children cascading, with nothing pointing at the dropped table.
    sql.exec(`DELETE FROM items WHERE id = 'i1'`);
    expect(count(sql, 'opens')).toBe(0);
    expect(count(sql, 'events')).toBe(0);
  });

  it('runs again harmlessly, and on D1: no compound SELECT, no bound parameters', () => {
    const sql = before();
    apply(sql);
    expect(() => apply(sql)).not.toThrow();
    expect(() => assertD1Compound(SQL)).not.toThrow();
    expect(SQL).not.toMatch(/\?|\bUNION\b/i);
  });
});
