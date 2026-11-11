import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { describe, expect, it } from 'vitest';
import { foreignKeyProblems } from '../scripts/items-rebuild-check';

// 0017_events.sql (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The event log"): the Timeline's
// feed tables go, the kinds nothing reads are deleted, and timeline_events becomes `events` with every other row,
// foreign key and cascade kept, on a database made by every migration before it.

const MIGRATION = '0017_events.sql';
const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const SQL = readFileSync(MIGRATIONS + MIGRATION, 'utf8');

const count = (sql: DatabaseSync, query: string) =>
  Number((sql.prepare(`SELECT count(*) AS n FROM ${query}`).get() as { n: number }).n);
const names = (sql: DatabaseSync, type: 'table' | 'index') =>
  (
    sql
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all(type) as { name: string }[]
  ).map((r) => r.name);

// Up to 0016, with a row of every kind of event, their scopes, dismissals and last looks, and the rows that copy
// an event's id (a webhook delivery, an audit row).
function before(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter((f) => f < MIGRATION)) {
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  }
  sql.exec(`
    INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at) VALUES
      ('i1', 'liveplanner', 'plan', 'u1', NULL, 'p:u1', 'Plan', 1, 1),
      ('i2', 'livediagram', 'canvas', 'u1', 't1', 't:t1', 'Flow', 1, 1);
    INSERT INTO timeline_events (id, app, item_id, actor_id, type, title, detail, occurred_at) VALUES
      ('e-created', 'liveplanner', 'i1', 'u1', 'created', 'Plan', NULL, 10),
      ('e-edited', 'liveplanner', 'i1', 'u1', 'edited', 'Plan', NULL, 11),
      ('e-fav', 'livediagram', 'i2', 'u2', 'favourited', 'Flow', NULL, 12),
      ('e-team', 'liveworkspace', NULL, 'u1', 'team_joined', 'Guild', '{"teamId":"t1"}', 13),
      ('e-expiring', 'liveplanner', 'i1', NULL, 'share_link_expiring', 'Plan', NULL, 14),
      ('e-images', 'liveplanner', NULL, 'u1', 'image_uploaded', 'Images', '{"count":"2"}', 15),
      ('e-offline', 'liveplanner', NULL, 'u1', 'taken_offline', 'Gone', NULL, 16),
      ('e-team-gone', 'liveworkspace', NULL, 'u1', 'team_deleted', 'Old', NULL, 17),
      ('e-tok1', 'liveworkspace', NULL, 'u1', 'token_created', 'CI', NULL, 18),
      ('e-tok2', 'liveworkspace', NULL, 'u1', 'token_revoked', 'CI', NULL, 19),
      ('e-tok3', 'liveworkspace', NULL, NULL, 'token_expiring', 'CI', NULL, 20);
    INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at) VALUES
      ('p:u1', 'e-created', 'liveplanner', 10), ('t:t1', 'e-fav', 'livediagram', 12),
      ('p:u1', 'e-tok1', 'liveworkspace', 18);
    INSERT INTO timeline_dismissals (person_id, event_id, created_at) VALUES ('u1', 'e-edited', 30);
    INSERT INTO timeline_scope_state (person_id, last_seen_at) VALUES ('u1', 40);
    INSERT INTO webhooks (id, item_id, kind, name, url_sealed, host, events, created_by, created_at) VALUES
      ('w1', 'i1', 'json', 'Hook', 'sealed', 'example.com', ',created,', 'u1', 1);
    INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, item_id, title, occurred_at, next_at) VALUES
      ('w1', 'e-created', 'created', 'liveplanner', 'i1', 'Plan', 10, 11);
    INSERT INTO team_audit_events (team_id, id, type, app, title, occurred_at) VALUES
      ('t1', 'e-team', 'team_joined', 'liveworkspace', 'Guild', 13);
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
  it('drops the feed’s tables and the kinds nothing reads, and keeps every other event as `events`', () => {
    const sql = before();
    const tables = names(sql, 'table');
    migrate(sql);
    expect(names(sql, 'table')).toEqual(
      tables
        .filter((t) => !t.startsWith('timeline_'))
        .concat('events')
        .sort(),
    );
    expect(
      (sql.prepare('SELECT id FROM events ORDER BY id').all() as { id: string }[]).map((r) => r.id),
    ).toEqual(['e-created', 'e-edited', 'e-fav', 'e-team']);
    // What copies an event's id is untouched.
    expect(count(sql, 'webhook_deliveries')).toBe(1);
    expect(count(sql, 'team_audit_events')).toBe(1);
    expect(foreignKeyProblems(sql)).toEqual([]);
    expect(sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('indexes History, the actor and the sweep, and leaves no index of the old names', () => {
    const sql = before();
    migrate(sql);
    const indexes = names(sql, 'index');
    expect(indexes.filter((i) => i.startsWith('timeline_'))).toEqual([]);
    expect(indexes.filter((i) => i.startsWith('events_'))).toEqual([
      'events_actor',
      'events_item',
      'events_occurred',
    ]);
    const columns = (index: string) =>
      (
        sql.prepare(`SELECT name, desc FROM pragma_index_xinfo(?) WHERE key = 1`).all(index) as {
          name: string;
          desc: number;
        }[]
      ).map((c) => `${c.name}${c.desc ? ' DESC' : ''}`);
    expect(columns('events_item')).toEqual(['item_id', 'occurred_at DESC', 'id DESC']);
    expect(columns('events_actor')).toEqual(['actor_id']);
    expect(columns('events_occurred')).toEqual(['occurred_at']);
  });

  it('still cascades from items to their events, and refuses an event on no item that exists', () => {
    const sql = before();
    migrate(sql);
    sql.exec(`DELETE FROM items WHERE id = 'i1'`);
    expect(count(sql, `events WHERE item_id = 'i1'`)).toBe(0);
    expect(count(sql, `events`)).toBe(2);
    expect(() =>
      sql.exec(`INSERT INTO events (id, app, item_id, type, title, occurred_at)
                VALUES ('x', 'liveplanner', 'nope', 'edited', 'X', 1)`),
    ).toThrow(/FOREIGN KEY constraint failed/);
    // The schema names no table that is gone.
    const schema = (
      sql.prepare('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL').all() as {
        sql: string;
      }[]
    )
      .map((r) => r.sql)
      .join('\n');
    expect(schema).not.toMatch(/timeline_/);
  });

  it('runs on D1: no compound SELECT, no bound parameters', () => {
    expect(() => assertD1Compound(SQL)).not.toThrow();
    expect(SQL).not.toMatch(/\?|\bUNION\b/i);
  });
});
