import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 0022_staging_livediagram_resource.sql: staging's livediagram client, bound only to its old workers.dev router's API,
// also takes https://staging.livediagram.app/api; nothing else changes, and running it twice adds nothing.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const FIX = '0022_staging_livediagram_resource.sql';
const OLD = 'https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api';
const NEW = 'https://staging.livediagram.app/api';

function before(): DatabaseSync {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of FILES.filter((f) => f < FIX))
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  return sql;
}

const fix = (sql: DatabaseSync) => sql.exec(readFileSync(MIGRATIONS + FIX, 'utf8'));

function client(sql: DatabaseSync, clientId: string, ...resources: string[]): void {
  sql
    .prepare(`INSERT INTO "oauthClient" (id, clientId, redirectUris) VALUES (?, ?, '[]')`)
    .run(clientId, clientId);
  for (const r of resources)
    sql
      .prepare(`INSERT INTO "oauthClientResource" (id, clientId, resourceId) VALUES (?, ?, ?)`)
      .run(`${clientId}:${r}`, clientId, r);
}

function resource(sql: DatabaseSync, identifier: string): void {
  sql
    .prepare(`INSERT INTO "oauthResource" (id, identifier, name) VALUES (?, ?, ?)`)
    .run(identifier, identifier, identifier);
}

const resourcesOf = (sql: DatabaseSync, clientId: string) =>
  (
    sql
      .prepare(
        `SELECT resourceId FROM "oauthClientResource" WHERE clientId = ? ORDER BY resourceId`,
      )
      .all(clientId) as { resourceId: string }[]
  ).map((r) => r.resourceId);

describe('0022: staging livediagram resource', () => {
  it('binds the old router client to staging.livediagram.app/api, keeping the old binding', () => {
    const sql = before();
    resource(sql, OLD);
    resource(sql, NEW);
    resource(sql, 'https://staging.liveplanner.app/api');
    client(sql, 'diagram', OLD);
    client(sql, 'planner', 'https://staging.liveplanner.app/api');
    fix(sql);
    expect(resourcesOf(sql, 'diagram')).toEqual([NEW, OLD].sort());
    expect(resourcesOf(sql, 'planner')).toEqual(['https://staging.liveplanner.app/api']);
    fix(sql);
    expect(resourcesOf(sql, 'diagram')).toHaveLength(2);
  });

  it('changes nothing where no client holds the old router (production, local)', () => {
    const sql = before();
    resource(sql, 'https://livediagram.app/api');
    client(sql, 'diagram', 'https://livediagram.app/api');
    fix(sql);
    expect(resourcesOf(sql, 'diagram')).toEqual(['https://livediagram.app/api']);
    expect(
      Number(
        (sql.prepare(`SELECT count(*) AS n FROM "oauthClientResource"`).get() as { n: number }).n,
      ),
    ).toBe(1);
  });

  it('adds nothing when the staging resource is not registered', () => {
    const sql = before();
    resource(sql, OLD);
    client(sql, 'diagram', OLD);
    fix(sql);
    expect(resourcesOf(sql, 'diagram')).toEqual([OLD]);
  });
});
