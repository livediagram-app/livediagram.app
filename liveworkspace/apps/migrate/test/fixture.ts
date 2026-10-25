// A hand-made old database: the old site's 100 migrations (fixtures/old-migrations.sql, concatenated from its
// repository) run into an in-memory SQLite, then fixture rows put in with `put`. And the new side's databases, built
// from this repository's own migrations, to run a bundle's SQL into.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { OLD_SCHEMA_LEVEL } from '@liveworkspace/migration';
import type { Db } from '../src/sql.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APPS = join(HERE, '..', '..');

export const NOW = Date.UTC(2026, 9, 1); // the snapshot's time
export const DAY = 86_400_000;

let oldSql: string | null = null;

export function oldDatabase(): DatabaseSync {
  oldSql ??= readFileSync(join(HERE, 'fixtures', 'old-migrations.sql'), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL)',
  );
  const parts = oldSql.split(/^-- migration: (.+)$/m);
  const names: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i]!.trim();
    db.exec(parts[i + 1]!);
    names.push(name);
  }
  const add = db.prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)');
  for (const name of names) add.run(name, '2026-09-01 00:00:00');
  if (names.at(-1) !== OLD_SCHEMA_LEVEL) throw new Error(`fixture ends at ${names.at(-1)}`);
  return db;
}

type Value = string | number | null;

/** Inserts one row. */
export function put(db: DatabaseSync, table: string, row: Record<string, Value>): void {
  const cols = Object.keys(row);
  db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  ).run(...Object.values(row));
}

/** A document with its tabs, in the old shape. */
export function putDocument(
  db: DatabaseSync,
  doc: Record<string, Value> & { id: string; owner_id: string },
  tabs: { id: string; name?: string; body: Record<string, unknown> }[],
): void {
  put(db, 'documents', {
    name: doc.id,
    saved_at: NOW - 5 * DAY,
    created_at: NOW - 30 * DAY,
    ...doc,
  });
  tabs.forEach((t, i) => {
    put(db, 'tabs', {
      id: t.id,
      name: t.name ?? t.id,
      data: JSON.stringify(t.body),
      updated_at: NOW - 6 * DAY,
      element_count: Array.isArray(t.body.elements) ? t.body.elements.length : 0,
    });
    put(db, 'document_tabs', {
      document_id: doc.id,
      tab_id: t.id,
      order_index: i,
      added_at: NOW - 29 * DAY,
    });
  });
}

const SERVICE: Record<Db, string> = {
  accounts: 'accounts',
  index: 'index',
  media: 'media',
  community: 'community',
};

/** The new side's four databases, from each service's migrations (and the legacy_guest table another change adds). */
export function newDatabases(): Record<Db, DatabaseSync> {
  const out = {} as Record<Db, DatabaseSync>;
  for (const db of Object.keys(SERVICE) as Db[]) {
    const d = new DatabaseSync(':memory:');
    d.exec('PRAGMA foreign_keys = ON');
    const dir = join(APPS, SERVICE[db], 'migrations');
    for (const f of readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      d.exec(readFileSync(join(dir, f), 'utf8'));
    }
    if (db === 'accounts') {
      d.exec(
        'CREATE TABLE IF NOT EXISTS legacy_guest (id TEXT PRIMARY KEY, firstSeenAt INTEGER NOT NULL, claimedAt INTEGER, claimedBy TEXT)',
      );
    }
    out[db] = d;
  }
  return out;
}

/** Runs a bundle's SQL files into the new side's databases, as `wrangler d1 execute --file` would. */
export function runBundleSql(
  bundleDir: string,
  dbs: Record<Db, DatabaseSync>,
  files: Record<Db, string[]>,
): void {
  for (const db of Object.keys(files) as Db[]) {
    for (const f of files[db]) dbs[db].exec(readFileSync(join(bundleDir, f), 'utf8'));
  }
}

export const clerkCsv = (
  rows: { id: string; email: string; first?: string; last?: string }[],
): string =>
  [
    'id,first_name,last_name,primary_email_address,verified_email_addresses,created_at',
    ...rows.map(
      (r) =>
        `${r.id},${r.first ?? ''},${r.last ?? ''},${r.email},${r.email},2025-01-01T00:00:00.000Z`,
    ),
  ].join('\n');

export const GUEST_A = '11111111-2222-4333-8444-555555555555';
export const GUEST_B = '66666666-7777-4888-9999-aaaaaaaaaaaa';

export const shape = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'rectangle',
  x,
  y,
  width: 120,
  height: 60,
  label: id,
  ...extra,
});
