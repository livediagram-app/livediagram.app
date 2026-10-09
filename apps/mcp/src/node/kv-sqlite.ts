// The OAuth server's KV namespace, answered from a SQLite table
// (docs/specs/016-platform/self-hosted-runtime.md, "MCP process").
//
// The hosted Worker keeps client registrations, authorize sessions, codes and
// device records in `OAUTH_KV` with short TTLs (apps/mcp/wrangler.toml). A
// self-hosted deployment has no KV namespace, so the three calls that code makes
// — get, put with `expirationTtl`, delete — are answered from one table in the
// MCP process's own database file. That state is nobody else's, so it gets its
// own file rather than sharing the app's: one writer per SQLite file is the
// cheaper arrangement.
//
// Expiry is enforced on read: the `get` that finds a row past its `expires_at`
// deletes it and answers null, so a code can never outlive its TTL because a
// sweeper did not run. `sweep()` is for the rows nobody will read again
// (rate-limit counters) and runs on a timer while the process is up.

import { DatabaseSync } from 'node:sqlite';
import type { OauthKv } from '../env';

export type SqliteKv = {
  /** The `OAUTH_KV` the application code sees. */
  binding: OauthKv;
  /** Delete every row past its expiry; returns how many went. */
  sweep(): number;
  close(): void;
};

type KvRow = { value: string; expires_at: number | null };

export function openKv(path: string): SqliteKv {
  const db = new DatabaseSync(path);
  // The same journal and lock budget the app process's file uses
  // (blueprints/DEFAULTS.md D7, D8): WAL so a reader never blocks the writer,
  // and a busy timeout rather than a failed statement under a burst.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(
    `CREATE TABLE IF NOT EXISTS mcp_kv (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       expires_at INTEGER
     )`,
  );

  const select = db.prepare('SELECT value, expires_at FROM mcp_kv WHERE key = ?');
  const remove = db.prepare('DELETE FROM mcp_kv WHERE key = ?');
  const removeExpired = db.prepare(
    'DELETE FROM mcp_kv WHERE expires_at IS NOT NULL AND expires_at <= ?',
  );
  const upsert = db.prepare(
    `INSERT INTO mcp_kv (key, value, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
  );

  function read(key: string): string | null {
    const row = select.get(key) as KvRow | undefined;
    if (!row) return null;
    if (row.expires_at !== null && row.expires_at <= Date.now()) {
      remove.run(key);
      return null;
    }
    return row.value;
  }

  const binding = {
    async get(key: string, type?: 'text' | 'json'): Promise<unknown> {
      const raw = read(key);
      if (raw === null) return null;
      return type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const ttl = options?.expirationTtl;
      upsert.run(key, value, ttl === undefined ? null : Date.now() + ttl * 1000);
    },
    async delete(key: string): Promise<void> {
      remove.run(key);
    },
  } as unknown as OauthKv;

  return {
    binding,
    sweep: () => Number(removeExpired.run(Date.now()).changes),
    close: () => db.close(),
  };
}
