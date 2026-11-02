import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allAppOrigins } from './auth.ts';
import { codeEmail } from './email.ts';
import { emailBrand } from './email-layout.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';
import { isSettingsApp } from './settings.ts';

// 0018_livehuddle.sql: the four app columns take livehuddle (registered before its launch,
// liveworkspace/docs/specs/002-architecture/integrating-an-app.md), and nothing already there is lost on the way.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const LIVEHUDDLE = '0018_livehuddle.sql';

function migrated(upTo: (file: string) => boolean): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter(upTo)) sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  return sql;
}

const count = (sql: DatabaseSync, table: string) =>
  Number((sql.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);

const indexesOf = (sql: DatabaseSync, table: string) =>
  (
    sql
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL`,
      )
      .all(table) as { name: string }[]
  )
    .map((r) => r.name)
    .sort();

function seed(sql: DatabaseSync): void {
  for (const id of ['user_a', 'user_b']) {
    sql
      .prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, 0, 0)`,
      )
      .run(id, id, `${id}@example.com`);
  }
  sql.exec(
    `INSERT INTO "oauthClient" (id, clientId, redirectUris) VALUES ('c1', 'client_1', '[]')`,
  );
  sql.exec(`INSERT INTO oauth_client_app (clientId, app) VALUES ('client_1', 'livedesign.app')`);
  sql.exec(`INSERT INTO account_app (user_id, app, first_seen_at, milestone_sent_at, first_share_sent_at)
            VALUES ('user_a', 'livediagram.app', 1, 2, 3), ('user_b', 'liveplanner.app', 4, NULL, NULL)`);
  sql.exec(`INSERT INTO email_lifecycle (user_id, created_at, welcome_sent_at, send_attempts, active_at, signup_app)
            VALUES ('user_a', 10, 11, 2, 12, 'livedocuments.app'), ('user_b', 20, NULL, 0, NULL, NULL)`);
  sql.exec(`INSERT INTO push_device (id, user_id, endpoint, p256dh, auth, label, app, created_at, last_sent_at)
            VALUES ('pd_1', 'user_a', 'https://push.example/1', '${'p'.repeat(87)}', '${'a'.repeat(22)}',
                    'Safari on iOS', 'livedesign', 5, 6)`);
}

describe('0018_livehuddle.sql', () => {
  it('keeps every row and index of the four tables', () => {
    const before = migrated((f) => f < LIVEHUDDLE);
    seed(before);
    const tables = ['oauth_client_app', 'account_app', 'email_lifecycle', 'push_device'];
    const rows = Object.fromEntries(
      tables.map((t) => [t, before.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]),
    );
    const indexes = Object.fromEntries(tables.map((t) => [t, indexesOf(before, t)]));

    before.exec(readFileSync(MIGRATIONS + LIVEHUDDLE, 'utf8'));
    for (const t of tables) {
      expect(before.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()).toEqual(rows[t]);
      expect(indexesOf(before, t)).toEqual(indexes[t]);
    }
    expect(before.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    // The parents' cascades still reach the rebuilt tables.
    before.exec(`DELETE FROM "user" WHERE id = 'user_a'`);
    expect(count(before, 'account_app')).toBe(1);
    expect(count(before, 'email_lifecycle')).toBe(1);
    expect(count(before, 'push_device')).toBe(0);
    before.exec(`DELETE FROM "oauthClient" WHERE clientId = 'client_1'`);
    expect(count(before, 'oauth_client_app')).toBe(0);
  });

  it('takes livehuddle in every app column, and still refuses an unknown app', () => {
    const sql = migrated(() => true);
    seed(sql);
    sql.exec(`UPDATE oauth_client_app SET app = 'livehuddle.app'`);
    sql.exec(
      `INSERT INTO account_app (user_id, app, first_seen_at) VALUES ('user_a', 'livehuddle.app', 7)`,
    );
    sql.exec(`UPDATE email_lifecycle SET signup_app = 'livehuddle.app' WHERE user_id = 'user_b'`);
    sql.exec(`UPDATE push_device SET app = 'livehuddle'`);
    expect(() =>
      sql.exec(
        `INSERT INTO account_app (user_id, app, first_seen_at) VALUES ('user_b', 'livenope.app', 7)`,
      ),
    ).toThrow(/CHECK constraint failed/);
    expect(() => sql.exec(`UPDATE push_device SET app = 'livenope'`)).toThrow(
      /CHECK constraint failed/,
    );
    expect(() => sql.exec(`UPDATE email_lifecycle SET signup_app = 'livenope.app'`)).toThrow(
      /CHECK constraint failed/,
    );
  });
});

describe('livehuddle in accounts', () => {
  it('is an app whose client, settings and sightings are accepted', () => {
    expect(isSettingsApp('livehuddle.app')).toBe(true);
    expect(isSettingsApp('livenope.app')).toBe(false);
  });

  it('may call the sign-in pages from its origins', () => {
    expect(allAppOrigins('production')).toEqual(
      expect.arrayContaining(['https://livehuddle.app', 'https://www.livehuddle.app']),
    );
    expect(allAppOrigins('development')).toContain('http://localhost:3500');
  });

  it('gets the plain liveworkspace sign-in email until its launch names it', () => {
    const env = { ENVIRONMENT: 'production', BASE_URL: 'https://liveworkspace.test' } as Env;
    expect(emailBrand(env, 'livehuddle.app')).toEqual(emailBrand(env, null));
    expect(codeEmail('123456', emailBrand(env, 'livehuddle.app')).text).not.toContain('livehuddle');
  });

  it('has its API among the token resources in production and staging', () => {
    expect(RESOURCES.production).toContain('https://livehuddle.app/api');
    expect(RESOURCES.staging).toContain('https://staging.livehuddle.app/api');
    expect(RESOURCES.production).toHaveLength(5);
  });
});
