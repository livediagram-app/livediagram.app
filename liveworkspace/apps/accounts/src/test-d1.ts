// A real D1 for tests: in-memory SQLite with every migration applied, behind the part of D1's surface
// this Worker calls (prepare / bind / first / all / run / batch). A batch runs in one transaction, as
// D1's does. Not a .test.ts file, so vitest doesn't collect it.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url).href);

const toSql = (value: unknown): SQLInputValue =>
  typeof value === 'boolean' ? (value ? 1 : 0) : (value as SQLInputValue);

export function testD1(): { db: D1Database; sql: DatabaseSync } {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    sql.exec(readFileSync(MIGRATIONS + file, 'utf8'));
  }

  const statement = (query: string, args: SQLInputValue[] = []) => {
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    const run = () => {
      const result = sql.prepare(query).run(...args);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    };
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async (column?: string) => {
        const row = rows()[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return column ? row[column] : row;
      },
      all: async () => ({ success: true, results: rows(), meta: {} }),
      run: async () => run(),
      // What a batch runs: a read answers its rows, a write its change count.
      exec: () =>
        /^\s*select/i.test(query) ? { success: true, results: rows(), meta: {} } : run(),
    };
  };

  const db = {
    prepare: (query: string) => statement(query),
    // Never called here, but Better Auth recognises a D1 by it.
    exec: async (query: string) => sql.exec(query),
    batch: async (statements: { exec: () => unknown }[]) => {
      sql.exec('BEGIN');
      try {
        const results = statements.map((s) => s.exec());
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db: db as unknown as D1Database, sql };
}

export function addUser(
  sql: DatabaseSync,
  user: { id: string; email: string; name?: string; verified?: boolean },
) {
  sql
    .prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.name ?? user.id,
      user.email,
      user.verified === false ? 0 : 1,
      '2026',
      '2026',
    );
}

// An OAuth client, as clients.ts registers one, and the app it is (none when `app` is null).
export function addClient(sql: DatabaseSync, clientId: string, app: string | null) {
  sql
    .prepare(
      `INSERT INTO oauthClient (id, clientId, redirectUris, createdAt, updatedAt) VALUES (?, ?, '[]', '2026', '2026')`,
    )
    .run(`id-${clientId}`, clientId);
  if (app) {
    sql.prepare('INSERT INTO oauth_client_app (clientId, app) VALUES (?, ?)').run(clientId, app);
  }
}
