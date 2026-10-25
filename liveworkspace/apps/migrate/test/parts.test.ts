// The tool's smaller parts on their own: the owner map, the SQL writer's no-overwrite rule and chunking, the
// snapshot loader, the one-way names, the targets against the services' wrangler.toml files, and the KV step.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { mediaGuestOwner } from '@liveworkspace/media';
import { OLD_SCHEMA_LEVEL } from '@liveworkspace/migration';
import { apply } from '../src/apply.ts';
import { copierHash, mediaGuestOwnerSync, uuidFromSeed } from '../src/ids.ts';
import { OwnerMap, readExistingAccounts } from '../src/owner-map.ts';
import { BATCH_ROWS, SqlWriter, type LedgerView } from '../src/sql.ts';
import { StatementSplitter, snapshot } from '../src/snapshot.ts';
import {
  configOf,
  databaseOf,
  mediaBucketOf,
  MCP_CONFIG,
  OAUTH_KV,
  REPO_ROOT,
  TARGET_ACCOUNT_ID,
} from '../src/targets.ts';
import { DBS } from '../src/sql.ts';
import { GUEST_A, GUEST_B } from './fixture.ts';
import { planScenario, tempDir } from './helpers.ts';
import { scenario } from './scenario.ts';

const clerk = (id: string, email: string) => ({
  id,
  email,
  givenName: '',
  familyName: '',
  name: id,
  verified: true,
  createdAt: '2025-01-01T00:00:00.000Z',
});

describe('the owner map', () => {
  it('maps a Clerk id to itself, or to the account that already has its email; a guest to its legacy id', () => {
    const map = new OwnerMap(
      [clerk('user_b', 'b@x.com'), clerk('user_a', 'a@x.com')],
      readExistingAccounts(JSON.stringify([{ id: 'user_new', email: 'B@X.com ' }])),
      new Map([[GUEST_B, 'user_a']]),
    );
    expect(map.ownerOf('user_a')).toBe('user_a');
    expect(map.ownerOf('user_b')).toBe('user_new');
    expect(map.ownerOf(GUEST_A)).toBe(`guest_${GUEST_A}`);
    expect(map.ownerOf(GUEST_B)).toBe('user_a');
    expect(map.ownerOf('not-a-uuid')).toBe('guest_not-a-uuid');
    expect(map.ownerOf('user_ghost')).toBe('user_ghost');
    expect(map.matches).toEqual([{ clerkId: 'user_b', accountId: 'user_new', email: 'b@x.com' }]);
    expect(map.importedAccounts().map((a) => a.id)).toEqual(['user_a']);
    expect([...map.guests].sort()).toEqual([GUEST_A, 'not-a-uuid'].sort());
    expect([...map.invalidGuests]).toEqual(['not-a-uuid']);
    expect([...map.unknownAccounts]).toEqual(['user_ghost']);
  });

  it('refuses an accounts list without ids or emails', () => {
    expect(() => readExistingAccounts('[{"id":"user_x"}]')).toThrow(/id.*email/);
  });
});

describe('the SQL writer', () => {
  const ledgerOf = (rows: Record<string, string>): LedgerView => ({
    version: (db, t, k) => rows[`${db}|${t}|${k}`],
  });
  const spec = (id: string, version: number) => ({
    table: 't',
    key: id,
    columns: ['id', 'v', 'updated_at'],
    values: [id, `it's ${version}`, version],
    conflict: ['id'],
    version,
    guard: 'updated_at',
  });

  it('inserts what is new in batches, skips what is unchanged, guards what changed, and counts each', () => {
    const dir = tempDir('sql');
    const w = new SqlWriter('index', dir, ledgerOf({ 'index|t|b': '1', 'index|t|c': '1' }), ['t']);
    w.row(spec('a', 1));
    w.row(spec('b', 1));
    w.row(spec('c', 2));
    const [file] = w.close();
    const sql = readFileSync(join(dir, file!), 'utf8');
    expect(sql).toContain(
      "INSERT OR IGNORE INTO t (id, v, updated_at) VALUES ('a', 'it''s 1', 1);",
    );
    expect(sql).toContain(
      'ON CONFLICT (id) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at WHERE t.updated_at = 1;',
    );
    expect(sql).not.toContain("'b'");
    expect(sql).not.toMatch(/DELETE/i);
    expect(w.counts.get('t')).toEqual({
      inserted: 1,
      updated: 1,
      unchanged: 1,
      changedNotWritten: 0,
    });
    // Run against SQLite: the guarded update leaves a row changed on the new side alone.
    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT, updated_at INTEGER); INSERT INTO t VALUES ('c', 'changed here', 5)",
    );
    db.exec(sql);
    expect(db.prepare("SELECT v FROM t WHERE id = 'c'").get()).toEqual({ v: 'changed here' });
  });

  it('counts a change to an insert-only row without writing it, and splits batches and chunks', () => {
    const dir = tempDir('sql2');
    const w = new SqlWriter('media', dir, ledgerOf({ 'media|t|x': '"old"' }), ['t']);
    w.row({
      table: 't',
      key: 'x',
      columns: ['id'],
      values: ['x'],
      conflict: ['id'],
      version: 'new',
    });
    for (let i = 0; i < BATCH_ROWS * 2 + 1; i++)
      w.row({
        table: 't',
        key: `k${i}`,
        columns: ['id'],
        values: [`k${i}`],
        conflict: ['id'],
        version: 1,
      });
    const files = w.close();
    const sql = readFileSync(join(dir, files[0]!), 'utf8');
    expect(sql.match(/INSERT OR IGNORE/g)).toHaveLength(3);
    expect(w.counts.get('t')?.changedNotWritten).toBe(1);
    const ledger = readFileSync(join(dir, 'ledger', 'media', '0001.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(ledger).toHaveLength(BATCH_ROWS * 2 + 1);
  });

  it('writes parents before the rows that point at them', () => {
    const dir = tempDir('sql3');
    const w = new SqlWriter('index', dir, ledgerOf({}), ['parent', 'child']);
    w.row({
      table: 'child',
      key: 'c',
      columns: ['id'],
      values: ['c'],
      conflict: ['id'],
      version: 1,
    });
    w.row({
      table: 'parent',
      key: 'p',
      columns: ['id'],
      values: ['p'],
      conflict: ['id'],
      version: 1,
    });
    const sql = readFileSync(join(dir, w.close()[0]!), 'utf8');
    expect(sql.indexOf('INTO parent')).toBeLessThan(sql.indexOf('INTO child'));
  });
});

describe('the snapshot', () => {
  it('cuts statements at semicolons outside quotes and comments, however the text is chunked', () => {
    const text =
      "INSERT INTO t VALUES ('a;b', 'it''s');\n-- a ; comment\nINSERT INTO t VALUES (\"x;\");/* ; */CREATE TABLE u (x);";
    for (let size = 1; size < 12; size++) {
      const s = new StatementSplitter();
      const out: string[] = [];
      for (let i = 0; i < text.length; i += size) out.push(...s.push(text.slice(i, i + size)));
      out.push(...s.end());
      expect(out.map((x) => x.replace(/\s+/g, ' ').trim())).toEqual([
        "INSERT INTO t VALUES ('a;b', 'it''s');",
        '-- a ; comment INSERT INTO t VALUES ("x;");',
        '/* ; */CREATE TABLE u (x);',
      ]);
    }
  });

  it('loads an export at the right level and refuses any other', async () => {
    const dir = tempDir('snap');
    const exportAt = (level: string) =>
      `PRAGMA defer_foreign_keys=TRUE;\nCREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT);\nINSERT INTO d1_migrations VALUES(1,'${level}','x');\nCREATE TABLE _cf_KV(k);\nINSERT INTO sqlite_sequence VALUES('d1_migrations',1);\n`;
    writeFileSync(join(dir, 'good.sql'), exportAt(OLD_SCHEMA_LEVEL));
    writeFileSync(join(dir, 'bad.sql'), exportAt('0098_older.sql'));
    const meta = await snapshot(join(dir, 'good.sql'), join(dir, 'good.sqlite'), 123);
    expect(meta).toMatchObject({ level: OLD_SCHEMA_LEVEL, snapshotAt: 123 });
    await expect(snapshot(join(dir, 'bad.sql'), join(dir, 'bad.sqlite'))).rejects.toThrow(
      /refused/,
    );
    await expect(snapshot(join(dir, 'good.sql'), join(dir, 'good.sqlite'))).rejects.toThrow(
      /never written over/,
    );
  });
});

describe('the one-way names', () => {
  it("match the media service's guest owner and are stable", async () => {
    expect(mediaGuestOwnerSync('livediagram.app', `guest_${GUEST_A}`)).toBe(
      await mediaGuestOwner('livediagram.app', `guest_${GUEST_A}`),
    );
    expect(uuidFromSeed('doc:livedocuments')).toBe(uuidFromSeed('doc:livedocuments'));
    expect(uuidFromSeed('doc:livedocuments')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(copierHash('user_a')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the targets', () => {
  it('name the databases, bucket, KV and account the wrangler.toml files do', () => {
    for (const db of DBS) {
      const toml = readFileSync(join(REPO_ROOT, configOf(db)), 'utf8');
      expect(toml).toContain(`account_id = "${TARGET_ACCOUNT_ID}"`);
      expect(toml).toContain(`database_name = "${databaseOf(db, 'production')}"`);
      expect(toml).toContain(`database_name = "${databaseOf(db, 'staging')}"`);
    }
    const media = readFileSync(join(REPO_ROOT, configOf('media')), 'utf8');
    expect(media).toContain(`bucket_name = "${mediaBucketOf('production')}"`);
    expect(media).toContain(`bucket_name = "${mediaBucketOf('staging')}"`);
    const mcp = readFileSync(join(REPO_ROOT, MCP_CONFIG), 'utf8');
    expect(mcp).toContain(`id = "${OAUTH_KV.production}"`);
    expect(mcp).toContain(`id = "${OAUTH_KV.staging}"`);
  });
});

describe('the MCP client registrations', () => {
  it('keeps live client: keys with their expiry and puts them in one bulk write', async () => {
    const dir = tempDir('kv');
    const nowSeconds = Math.floor(Date.UTC(2026, 9, 1) / 1000);
    writeFileSync(
      join(dir, 'dump.json'),
      JSON.stringify([
        { name: 'client:b', value: '{"client_id":"b"}', expiration: nowSeconds + 86_400 },
        { name: 'client:a', value: { client_id: 'a' } },
        { name: 'client:old', value: '{}', expiration: nowSeconds - 1 },
        { name: 'grant:x', value: '{}' },
      ]),
    );
    const { outDir, manifest } = await planScenario(scenario(), {
      oauthKvPath: join(dir, 'dump.json'),
    });
    expect(JSON.parse(readFileSync(join(outDir, 'kv', 'mcp-clients.json'), 'utf8'))).toEqual([
      { key: 'client:a', value: '{"client_id":"a"}' },
      { key: 'client:b', value: '{"client_id":"b"}', expiration: nowSeconds + 86_400 },
    ]);
    expect(manifest.steps.at(-1)).toEqual({ step: 'kv', file: 'kv/mcp-clients.json', count: 2 });
    const lines: string[] = [];
    await apply({
      bundleDir: outDir,
      env: 'production',
      ledgerPath: join(dir, 'l.sqlite'),
      dryRun: true,
      wrangler: ['wrangler'],
      vars: {},
      log: (l) => lines.push(l),
      runner: { run: () => Promise.reject(new Error('never')) },
      http: { send: () => Promise.reject(new Error('never')) },
      now: () => Date.UTC(2026, 9, 1),
    });
    expect(lines.find((l) => l.includes('kv bulk put'))).toContain(
      `--namespace-id ${OAUTH_KV.production} --remote`,
    );
  });
});
