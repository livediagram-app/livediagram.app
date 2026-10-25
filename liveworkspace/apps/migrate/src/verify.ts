// `migrate verify <bundle> --env …` (docs/migration.md, step 9): read-only checks that what the bundle wrote is on
// the new side. For each table, every row the bundle's ledger files name is looked up by its key (on the table's
// primary key, so each check is an index lookup), and the table's total is counted. Only SELECTs: nothing here can
// write. The queries are built on their own (verifyQueries), so the tests run them against local SQLite.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Runner } from './apply.ts';
import { databaseOf, configOf, REPO_ROOT, TARGET_TOKEN_VAR, type Env } from './targets.ts';
import { DBS, literal, type Db, type LedgerEntry } from './sql.ts';

/** Each table's key columns, in the order the plan joins them (with `|`) into a ledger key. */
export const KEY_COLUMNS: Record<Db, Record<string, readonly string[]>> = {
  accounts: {
    '"user"': ['id'],
    team: ['id'],
    team_member: ['id'],
    api_token: ['id'],
    settings: ['owner_id', 'scope'],
    email_lifecycle: ['user_id'],
    account_app: ['user_id', 'app'],
    profile: ['owner_id'],
    legacy_guest: ['id'],
  },
  index: {
    folders: ['id'],
    items: ['id'],
    favourites: ['person_id', 'item_id'],
    opens: ['person_id', 'item_id'],
    use_days: ['person_id', 'item_id', 'day'],
    share_links: ['code'],
    share_passwords: ['item_id'],
    shared_with: ['person_id', 'item_id'],
    placement_defaults: ['person_id', 'default_key'],
    timeline_events: ['id'],
    timeline_event_scopes: ['scope', 'event_id'],
  },
  media: { images: ['id'], refs: ['app', 'document', 'image_id'] },
  community: {
    posts: ['id'],
    post_tags: ['post_id', 'tag'],
    likes: ['post_id', 'liker_key'],
    copies: ['post_id', 'copier'],
    reports: ['post_id', 'reporter_key'],
  },
};

// Keys per query: a statement stays well under D1's 100 KB.
const KEYS_PER_QUERY = 500;

export type VerifyQuery =
  | { db: Db; table: string; kind: 'count'; sql: string }
  | { db: Db; table: string; kind: 'missing'; sql: string; keys: number };

/** The keys each table's rows were written under, from the bundle's ledger files. */
export function bundleKeys(bundleDir: string): Map<Db, Map<string, Set<string>>> {
  const out = new Map<Db, Map<string, Set<string>>>();
  for (const db of DBS) {
    const tables = new Map<string, Set<string>>();
    out.set(db, tables);
    let files: string[];
    try {
      files = readdirSync(join(bundleDir, 'ledger', db))
        .filter((f) => f.endsWith('.jsonl'))
        .sort();
    } catch {
      continue;
    }
    for (const f of files) {
      for (const line of readFileSync(join(bundleDir, 'ledger', db, f), 'utf8').split('\n')) {
        if (!line) continue;
        const [table, key] = JSON.parse(line) as LedgerEntry;
        let keys = tables.get(table);
        if (!keys) tables.set(table, (keys = new Set()));
        keys.add(key);
      }
    }
  }
  return out;
}

/** The read-only queries: a total per table, and the keys of the bundle's rows that are not there. */
export function verifyQueries(keys: Map<Db, Map<string, Set<string>>>): VerifyQuery[] {
  const out: VerifyQuery[] = [];
  for (const db of DBS) {
    for (const [table, columns] of Object.entries(KEY_COLUMNS[db])) {
      out.push({ db, table, kind: 'count', sql: `SELECT COUNT(*) AS n FROM ${table}` });
      const wanted = [...(keys.get(db)?.get(table) ?? [])].sort();
      const names = columns.map((_, i) => `k${i}`);
      for (let i = 0; i < wanted.length; i += KEYS_PER_QUERY) {
        const slice = wanted.slice(i, i + KEYS_PER_QUERY);
        const values = slice
          .map((key) => {
            const parts = columns.length === 1 ? [key] : splitKey(key, columns.length);
            return `(${parts.map((p) => literal(p)).join(', ')})`;
          })
          .join(', ');
        const on = columns.map((c, j) => `t.${c} = v.${names[j]}`).join(' AND ');
        out.push({
          db,
          table,
          kind: 'missing',
          keys: slice.length,
          sql:
            `WITH v(${names.join(', ')}) AS (VALUES ${values}) ` +
            `SELECT ${names.map((n) => `v.${n}`).join(', ')} FROM v ` +
            `WHERE NOT EXISTS (SELECT 1 FROM ${table} t WHERE ${on})`,
        });
      }
    }
  }
  return out;
}

// A key joined with `|`: the last parts never hold one (ids, scopes, codes), so a part with one is the first.
function splitKey(key: string, n: number): string[] {
  const parts = key.split('|');
  if (parts.length === n) return parts;
  return [parts.slice(0, parts.length - n + 1).join('|'), ...parts.slice(parts.length - n + 1)];
}

export type Execute = (db: Db, sql: string) => Promise<Record<string, unknown>[]>;

export type VerifyTable = {
  db: Db;
  table: string;
  total: number;
  expected: number;
  missing: number;
  sample: string[];
};

export async function verify(
  queries: readonly VerifyQuery[],
  execute: Execute,
): Promise<VerifyTable[]> {
  const byTable = new Map<string, VerifyTable>();
  const entry = (db: Db, table: string) => {
    const k = `${db}.${table}`;
    let t = byTable.get(k);
    if (!t) byTable.set(k, (t = { db, table, total: 0, expected: 0, missing: 0, sample: [] }));
    return t;
  };
  for (const q of queries) {
    const t = entry(q.db, q.table);
    const rows = await execute(q.db, q.sql);
    if (q.kind === 'count') t.total = Number(rows[0]?.n ?? 0);
    else {
      t.expected += q.keys;
      t.missing += rows.length;
      for (const r of rows) if (t.sample.length < 20) t.sample.push(Object.values(r).join('|'));
    }
  }
  return [...byTable.values()];
}

// Refuses anything but one SELECT (or WITH … SELECT): verify reads.
function assertReadOnly(sql: string): void {
  if (!/^(SELECT|WITH)\s/i.test(sql) || /;\s*\S/.test(sql))
    throw new Error('verify runs single SELECTs only');
}

export function verifyCommand(o: {
  wrangler: string[];
  db: Db;
  env: Env;
  sql: string;
  token: string;
  base: Record<string, string>;
}) {
  assertReadOnly(o.sql);
  return {
    argv: [
      ...o.wrangler,
      'd1',
      'execute',
      databaseOf(o.db, o.env),
      '--remote',
      '--json',
      '--command',
      o.sql,
      '--config',
      join(REPO_ROOT, configOf(o.db)),
      ...(o.env === 'staging' ? ['--env', 'staging'] : []),
    ],
    env: { ...o.base, CLOUDFLARE_API_TOKEN: o.token },
    cwd: REPO_ROOT,
  };
}

/** The executor verify uses on a real run: wrangler's JSON answer, `[{ results: [...] }]`. */
export function wranglerExecute(o: {
  runner: Runner;
  wrangler: string[];
  env: Env;
  vars: Record<string, string | undefined>;
}): Execute {
  const token = o.vars[TARGET_TOKEN_VAR];
  if (!token) throw new Error(`${TARGET_TOKEN_VAR} is not set`);
  const base: Record<string, string> = { CI: 'true', WRANGLER_SEND_METRICS: 'false' };
  for (const name of ['PATH', 'HOME', 'TMPDIR']) if (o.vars[name]) base[name] = o.vars[name]!;
  return async (db, sql) => {
    const result = await o.runner.run(
      verifyCommand({ wrangler: o.wrangler, db, env: o.env, sql, token, base }),
    );
    if (result.code !== 0)
      throw new Error(`verify ${db}: ${result.stderr.trim() || result.stdout.trim()}`);
    const parsed = JSON.parse(result.stdout) as { results?: Record<string, unknown>[] }[];
    return parsed.flatMap((p) => p.results ?? []);
  };
}
