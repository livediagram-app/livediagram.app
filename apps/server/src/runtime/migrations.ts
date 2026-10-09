import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

// Migrations for the self-hosted runtime: the same files the api worker ships
// (apps/api/migrations), applied in filename order at start-up
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// database").
//
// The bookkeeping table is \`d1_migrations\`, the one wrangler writes, with the same
// columns. That is deliberate: a database can move between the two runtimes
// without re-applying or skipping anything, and an operator reading the file
// sees the same table either way.

export type MigrationRun = {
  applied: string[];
  alreadyApplied: string[];
};

const BOOKKEEPING = `CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export function applyMigrations(sql: DatabaseSync, migrationsDir: string): MigrationRun {
  sql.exec(BOOKKEEPING);
  const done = new Set(
    sql
      .prepare('SELECT name FROM d1_migrations')
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  );
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  for (const name of files) {
    if (done.has(name)) {
      alreadyApplied.push(name);
      continue;
    }
    const body = readFileSync(join(migrationsDir, name), 'utf8');
    // One transaction per migration: a failure leaves the database at the last
    // migration that fully applied, never half of one.
    sql.exec('BEGIN');
    try {
      sql.exec(body);
      sql.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
      sql.exec('COMMIT');
      applied.push(name);
    } catch (err) {
      sql.exec('ROLLBACK');
      throw new Error(`migration ${name} failed: ${(err as Error).message}`, { cause: err });
    }
  }
  return { applied, alreadyApplied };
}
