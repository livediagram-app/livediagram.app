import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';
import { foreignKeyProblems } from '../scripts/items-rebuild-check';

// 0033_item_calls_spaces.sql (liveworkspace/docs/specs/004-index/blueprints/item-calls.md "Tables"): item_calls is
// rebuilt without the UNIQUE on space_id and with `chosen`, every call and invite kept, on a database made by every
// migration before it.

const MIGRATION = '0033_item_calls_spaces.sql';
const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const SQL = readFileSync(MIGRATIONS + MIGRATION, 'utf8');

const count = (sql: DatabaseSync, query: string) =>
  Number((sql.prepare(`SELECT count(*) AS n FROM ${query}`).get() as { n: number }).n);

// Up to 0032, with two calls (one with a summary, a plan and its link) and an invite to each.
function before(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter((f) => f < MIGRATION)) {
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  }
  sql.exec(`
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at) VALUES
      ('doc', 'livediagram', 'canvas', 'u1', NULL, 'p:u1', 'Retro', 1, 1),
      ('s1', 'livehuddle', 'space', 'u1', NULL, 'p:u1', 'Retro Call', 1, 1),
      ('s2', 'livehuddle', 'space', 'u1', NULL, 'p:u1', 'Retro Call', 1, 1),
      ('kb', 'liveknowledge', 'knowledgebase', 'u1', NULL, 'p:u1', 'Wiki', 1, 1),
      ('plan', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', 'Actions', 1, 1);
    INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
      VALUES ('code1', 's1', 'participate', NULL, 'never', NULL, 1, 0);
    INSERT INTO item_calls (id, item_id, space_id, host_id, share_code, people, names, started_at, live_at, ended_at,
        summary_item_id, summary_link, summary_title, plan_id, updated_at) VALUES
      ('ic_1', 'doc', 's1', 'u1', 'code1', 0, '["Ada"]', 10, 11, 12, 'kb', 'https://kb/p', 'Notes', 'plan', 13),
      ('ic_2', 'doc', 's2', 'u1', NULL, 2, '[]', 20, 21, NULL, NULL, NULL, NULL, NULL, 22);
    INSERT INTO item_call_invites (id, call_id, person_id, by_name, at) VALUES
      ('ci:1', 'ic_1', 'u2', 'Ada', 14), ('ci:2', 'ic_2', 'u3', 'Ada', 23);
  `);
  return sql;
}

// As D1 runs a migration file: one transaction, foreign keys on.
function migrate(sql: DatabaseSync): void {
  sql.exec('BEGIN');
  sql.exec(SQL);
  sql.exec('COMMIT');
}

describe(MIGRATION, () => {
  it('keeps every call and invite, each call not chosen', () => {
    const sql = before();
    const calls = sql.prepare('SELECT * FROM item_calls ORDER BY id').all();
    migrate(sql);
    expect(sql.prepare('SELECT * FROM item_calls ORDER BY id').all()).toEqual(
      calls.map((c) => ({ ...c, chosen: 0 })),
    );
    expect(
      (sql.prepare('SELECT id FROM item_call_invites ORDER BY id').all() as { id: string }[]).map(
        (r) => r.id,
      ),
    ).toEqual(['ci:1', 'ci:2']);
    expect(count(sql, "sqlite_master WHERE name LIKE 'aside_%'")).toBe(0);
    expect(foreignKeyProblems(sql)).toEqual([]);
  });

  it('lets a Space hold one call after another, indexed newest first', () => {
    const sql = before();
    migrate(sql);
    sql.exec(`INSERT INTO item_calls (id, item_id, space_id, host_id, started_at, updated_at, chosen)
              VALUES ('ic_3', 'doc', 's1', 'u1', 30, 30, 1)`);
    expect(count(sql, "item_calls WHERE space_id = 's1'")).toBe(2);
    const columns = (index: string) =>
      (
        sql.prepare(`SELECT name, desc FROM pragma_index_xinfo(?) WHERE key = 1`).all(index) as {
          name: string;
          desc: number;
        }[]
      ).map((c) => `${c.name}${c.desc ? ' DESC' : ''}`);
    expect(columns('item_calls_space')).toEqual(['space_id', 'started_at DESC']);
    expect(columns('item_calls_item')).toEqual(['item_id', 'started_at DESC']);
    expect(columns('item_calls_host')).toEqual(['host_id']);
    expect(columns('item_call_invites_person')).toEqual(['person_id', 'at DESC']);
  });

  it('still cascades: a Space takes its calls, a call its invites, and a link going clears it', () => {
    const sql = before();
    migrate(sql);
    sql.exec(`DELETE FROM share_links WHERE code = 'code1'`);
    expect(
      (
        sql.prepare(`SELECT share_code FROM item_calls WHERE id = 'ic_1'`).get() as {
          share_code: string | null;
        }
      ).share_code,
    ).toBeNull();
    sql.exec(`DELETE FROM items WHERE id = 's1'`);
    expect(count(sql, 'item_calls')).toBe(1);
    expect(count(sql, 'item_call_invites')).toBe(1);
    expect(() =>
      sql.exec(`INSERT INTO item_calls (id, item_id, space_id, host_id, started_at, updated_at)
                VALUES ('x', 'doc', 'nope', 'u1', 1, 1)`),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('runs on D1: no compound SELECT, no bound parameters', () => {
    expect(() => assertD1Compound(SQL)).not.toThrow();
    expect(SQL).not.toMatch(/\?|\bUNION\b/i);
  });
});
