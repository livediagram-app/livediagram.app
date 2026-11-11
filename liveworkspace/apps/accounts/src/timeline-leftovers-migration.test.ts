import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 0023_drop_timeline_leftovers.sql (liveworkspace/docs/specs/003-accounts/blueprints/accounts.md "Migrations"): the
// team events' outbox becomes index_events_outbox with every waiting row and its attempts kept, and api_token loses
// expiryNotedAt and its index with every token kept, on a database made by every migration before it.

const MIGRATION = '0023_drop_timeline_leftovers.sql';
const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const names = (sql: DatabaseSync, type: 'table' | 'index') =>
  (
    sql
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all(type) as { name: string }[]
  ).map((r) => r.name);

const columnsOf = (sql: DatabaseSync, table: string) =>
  (sql.prepare('SELECT name FROM pragma_table_info(?)').all(table) as { name: string }[]).map(
    (r) => r.name,
  );

function before(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter((f) => f < MIGRATION)) {
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  }
  sql.exec(`
    INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES
      ('user_a', 'Ada', 'ada@example.com', 1, 0, 0);
    INSERT INTO api_token (id, userId, tokenHash, name, createdAt, expiresAt, expiryWarnedAt, expiryNotedAt) VALUES
      ('tok_1', 'user_a', 'hash_1', 'CI', 1, 100, 50, 60),
      ('tok_2', 'user_a', 'hash_2', 'Laptop', 2, 200, NULL, NULL);
    INSERT INTO index_timeline_outbox (id, body, createdAt, attempts) VALUES
      ('team_joined:m1', '{"id":"team_joined:m1"}', 10, 3),
      ('token_expiring:tok_1', '{"id":"token_expiring:tok_1"}', 11, 0);
  `);
  return sql;
}

const TOKEN_COLUMNS =
  'id, userId, tokenHash, name, readOnly, createdAt, lastUsedAt, expiresAt, revokedAt, expiryWarnedAt';

describe(MIGRATION, () => {
  it('renames the outbox with every waiting row and its attempts', () => {
    const sql = before();
    sql.exec(readFileSync(MIGRATIONS + MIGRATION, 'utf8'));

    expect(names(sql, 'table')).toContain('index_events_outbox');
    expect(names(sql, 'table')).not.toContain('index_timeline_outbox');
    expect(names(sql, 'index').filter((n) => /timeline|expiry_note/.test(n))).toEqual([]);
    expect(
      sql
        .prepare('SELECT id, body, createdAt, attempts FROM index_events_outbox ORDER BY id')
        .all(),
    ).toEqual([
      { id: 'team_joined:m1', body: '{"id":"team_joined:m1"}', createdAt: 10, attempts: 3 },
      {
        id: 'token_expiring:tok_1',
        body: '{"id":"token_expiring:tok_1"}',
        createdAt: 11,
        attempts: 0,
      },
    ]);
    // The cron still reads it oldest first by its index, and a resend's INSERT OR IGNORE still keys on the id.
    const plan = sql
      .prepare('EXPLAIN QUERY PLAN SELECT id FROM index_events_outbox ORDER BY createdAt, id')
      .all() as { detail: string }[];
    expect(plan.map((r) => r.detail).join(' ')).toContain('index_events_outbox_order');
    sql.exec(
      `INSERT OR IGNORE INTO index_events_outbox (id, body, createdAt) VALUES ('team_joined:m1', '{}', 12)`,
    );
    expect(sql.prepare('SELECT count(*) AS n FROM index_events_outbox').get()).toEqual({ n: 2 });
  });

  it('drops expiryNotedAt and its index, with every token, constraint and other index kept', () => {
    const sql = before();
    const tokens = sql.prepare(`SELECT ${TOKEN_COLUMNS} FROM api_token ORDER BY id`).all();
    sql.exec(readFileSync(MIGRATIONS + MIGRATION, 'utf8'));

    expect(columnsOf(sql, 'api_token')).toEqual(TOKEN_COLUMNS.split(', '));
    expect(sql.prepare(`SELECT ${TOKEN_COLUMNS} FROM api_token ORDER BY id`).all()).toEqual(tokens);
    expect(names(sql, 'table')).not.toContain('api_token_next');
    expect(names(sql, 'index')).toEqual(
      expect.arrayContaining(['api_token_user_idx', 'api_token_expiry_warning_idx']),
    );
    expect(sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    // A hash is still unique, a token still needs its user, and goes with them.
    expect(() =>
      sql.exec(`INSERT INTO api_token (id, userId, tokenHash, name, createdAt, expiresAt)
                VALUES ('tok_3', 'user_a', 'hash_1', 'Copy', 3, 300)`),
    ).toThrow(/UNIQUE/);
    expect(() =>
      sql.exec(`INSERT INTO api_token (id, userId, tokenHash, name, createdAt, expiresAt)
                VALUES ('tok_4', 'user_gone', 'hash_4', 'Orphan', 4, 400)`),
    ).toThrow(/FOREIGN KEY/);
    sql.exec(`DELETE FROM "user" WHERE id = 'user_a'`);
    expect(sql.prepare('SELECT count(*) AS n FROM api_token').get()).toEqual({ n: 0 });
  });
});
