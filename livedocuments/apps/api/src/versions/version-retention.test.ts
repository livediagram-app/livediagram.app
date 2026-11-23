import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_AGE_MS,
  VERSION_AUTO_MAX_BYTES,
  VERSION_AUTO_MAX_BYTES_PAID,
  VERSION_AUTO_MAX_PAID,
  VERSION_IDLE_MS,
} from '@livedocuments/api-schema';
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import { DOCUMENT_SCHEMA_VERSION, migrateDocumentSchema } from '../document-room/document-schema';
import { makeTestRouteContext } from '../routes/test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { DocumentEnv } from '../types';
import {
  applyVersionRetention,
  documentOwnerScope,
  learnVersionRetention,
  settleVersionRetention,
  VERSION_RETENTION_CHECK_MS,
  versionMaxAgeMs,
  versionRetentionOf,
  writeVersionRetention,
} from './version-retention';
import { VERSION_RETENTION_LEGACY } from './version-retention-schema';

// What a tab's automatic versions are held to with Pro on (docs/specs/006-document/version-history.md "With Pro on";
// blueprint VH25), on real SQLite: the row the prune reads, each tier's numbers in it, the room learning them off the
// save's path, and nothing written on a guess.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 20);

// Each test's own owners: the entitlement cache is the isolate's.
let serial = 0;
const account = () => `user_keeps${++serial}`;

function setUp(): SqliteD1 {
  const db = sqliteD1();
  db.sql
    .prepare(
      "INSERT INTO document (id, saved_at, created_at, name, owner_id) VALUES ('D', 0, 1, 'Doc', 'o')",
    )
    .run();
  db.sql
    .prepare(
      "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t1', 'Pitch', '{}', 1000, 1, 1)",
    )
    .run();
  return db;
}

// One automatic version kept `daysAgo` days before NOW, the prune running as each lands.
let rev = 1;
function keep(db: SqliteD1, daysAgo: number, opts: { name?: string; bytes?: number } = {}) {
  rev += 1;
  db.sql
    .prepare(
      `INSERT INTO tab_versions (id, tab_id, rev, kind, name, tab_name, data, bytes, element_count, saved_at, created_at)
       VALUES (?, 't1', ?, 'idle', ?, 'Pitch', '{}', ?, 1, ?, ?)`,
    )
    .run(
      `v_${rev}`,
      rev,
      opts.name ?? null,
      opts.bytes ?? 10,
      NOW - daysAgo * DAY,
      NOW - daysAgo * DAY,
    );
}

const ages = (db: SqliteD1) =>
  (
    db.sql.prepare('SELECT created_at, name FROM tab_versions ORDER BY created_at').all() as {
      created_at: number;
      name: string | null;
    }[]
  ).map((r) => (r.name ? `${r.name}` : Math.round((NOW - r.created_at) / DAY)));

const held = (db: SqliteD1) =>
  db.sql.prepare('SELECT max_age_ms, max_count, max_bytes FROM version_retention').all();

function proEnv(db: SqliteD1, tiers: Record<string, Tier> = {}, up = true) {
  const asked: string[] = [];
  const env = {
    ...db.env,
    PRO_ENABLED: 'true',
    SUBSCRIPTION_KEY: 'k',
    // A service that is down is left alone for a moment, per address: the outage test has its own.
    ...(up ? {} : { SUBSCRIPTION_URL: 'https://down.test/api/subscription' }),
    SUBSCRIPTION: {
      fetch: async (_input: string, init?: RequestInit) => {
        if (!up) return new Response('down', { status: 503 });
        const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
        asked.push(owner);
        const tier = tiers[owner] ?? 'free';
        return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
      },
    },
  } as DocumentEnv;
  return { env, asked };
}

afterEach(() => vi.restoreAllMocks());

describe('the retention row', () => {
  it('starts at the bounds every tab had, so a room that takes the step prunes as it did', () => {
    const db = setUp();
    expect(held(db)).toEqual([
      {
        max_age_ms: VERSION_AUTO_MAX_AGE_MS,
        max_count: VERSION_AUTO_MAX,
        max_bytes: VERSION_AUTO_MAX_BYTES,
      },
    ]);
    keep(db, 40);
    keep(db, 29);
    keep(db, 0);
    // Past 30 days goes as the next version is kept; inside it stays.
    expect(ages(db)).toEqual([29, 0]);
    for (let n = 0; n < VERSION_AUTO_MAX + 5; n += 1) keep(db, 0);
    expect(ages(db)).toHaveLength(VERSION_AUTO_MAX);
  });

  it('reaches a room made before it without touching what the room holds', () => {
    const db = setUp();
    keep(db, 3, { name: 'Launch' });
    keep(db, 2);
    // The room as it stood one step back: no row, and the trigger with its numbers written in.
    db.sql.exec('DROP TABLE version_retention');
    db.sql.exec(`UPDATE _document_schema SET version = ${DOCUMENT_SCHEMA_VERSION - 1}`);
    migrateDocumentSchema((query) => {
      db.sql.exec(query);
      return { toArray: () => db.sql.prepare('SELECT version FROM _document_schema').all() };
    });
    expect(db.sql.prepare('SELECT version FROM _document_schema').get()).toEqual({
      version: DOCUMENT_SCHEMA_VERSION,
    });
    expect(held(db)).toHaveLength(1);
    expect(ages(db)).toEqual(['Launch', 2]);
  });
});

describe('each tier’s numbers', () => {
  it('maps a tier that keeps history for a time to that age, and one with no age limit to the safety caps', () => {
    expect(versionRetentionOf(7)).toEqual({
      maxAgeMs: 7 * DAY,
      maxCount: VERSION_AUTO_MAX,
      maxBytes: VERSION_AUTO_MAX_BYTES,
    });
    expect(versionRetentionOf(null)).toEqual({
      maxAgeMs: null,
      maxCount: VERSION_AUTO_MAX_PAID,
      maxBytes: VERSION_AUTO_MAX_BYTES_PAID,
    });
    expect(VERSION_AUTO_MAX_PAID).toBe(500);
    expect(VERSION_AUTO_MAX_BYTES_PAID).toBe(64 * 1024 * 1024);
  });

  it('on Free keeps 7 days: a version a moment older goes as the next is kept, never a named one', async () => {
    const db = setUp();
    await writeVersionRetention(db.env, versionRetentionOf(7));
    keep(db, 20, { name: 'Launch' });
    keep(db, 8);
    keep(db, 7);
    keep(db, 1);
    keep(db, 0);
    expect(ages(db)).toEqual(['Launch', 7, 1, 0]);
  });

  it('on Pro keeps every age, up to 500 versions and 64 MiB a tab', async () => {
    const db = setUp();
    await writeVersionRetention(db.env, versionRetentionOf(null));
    keep(db, 900);
    keep(db, 400);
    keep(db, 0);
    expect(ages(db)).toEqual([900, 400, 0]);
    for (let n = 0; n < VERSION_AUTO_MAX_PAID; n += 1) keep(db, 0);
    // The newest 500: the two oldest went for the count alone.
    expect(ages(db)).toHaveLength(VERSION_AUTO_MAX_PAID);
    expect(ages(db)).not.toContain(900);
    // And by bytes: three of 30 MiB pass 64 MiB, so the oldest of them and everything before it go.
    for (let n = 0; n < 3; n += 1) keep(db, 0, { bytes: 30 * 1024 * 1024 });
    expect(ages(db)).toHaveLength(2);
  });
});

describe('applyVersionRetention', () => {
  it('writes nothing and asks nothing with Pro off', async () => {
    const db = setUp();
    const { env, asked } = proEnv(db);
    expect(
      await applyVersionRetention({ ...env, PRO_ENABLED: 'false' }, `p:${account()}`),
    ).toBeNull();
    expect(asked).toEqual([]);
    expect(await versionMaxAgeMs(db.env)).toBe(VERSION_AUTO_MAX_AGE_MS);
  });

  it('writes the owner’s tier’s numbers, and answers them for the rail', async () => {
    const db = setUp();
    const free: OwnerScope = `p:${account()}`;
    const team: OwnerScope = `t:team_keeps${++serial}`;
    const { env } = proEnv(db, { [team]: 'team' });
    expect(await applyVersionRetention(env, free)).toEqual({ days: 7, owner: free });
    expect(await versionMaxAgeMs(env)).toBe(7 * DAY);
    expect(await applyVersionRetention(env, team)).toEqual({ days: null, owner: team });
    expect(await versionMaxAgeMs(env)).toBeNull();
    expect(held(db)).toEqual([
      {
        max_age_ms: null,
        max_count: VERSION_AUTO_MAX_PAID,
        max_bytes: VERSION_AUTO_MAX_BYTES_PAID,
      },
    ]);
  });

  it('holds a guest’s document to Free without asking', async () => {
    const db = setUp();
    const { env, asked } = proEnv(db);
    expect(await applyVersionRetention(env, null)).toEqual({ days: 7, owner: null });
    expect(asked).toEqual([]);
  });

  it('leaves the row as it was where nobody named the owner, or the service cannot say', async () => {
    const db = setUp();
    await writeVersionRetention(db.env, versionRetentionOf(null));
    expect(await applyVersionRetention(proEnv(db).env, undefined)).toBeNull();
    expect(await applyVersionRetention(proEnv(db, {}, false).env, `p:${account()}`)).toBeNull();
    // Still the Pro row it held: an outage never reads as Free.
    expect(await versionMaxAgeMs(db.env)).toBeNull();
  });
});

describe('the daily upkeep’s part', () => {
  it('puts the row back to the bounds every document had once Pro is off, and leaves it with Pro on', async () => {
    const db = setUp();
    await writeVersionRetention(db.env, versionRetentionOf(7));
    await settleVersionRetention({ ...db.env, PRO_ENABLED: 'true' });
    expect(await versionMaxAgeMs(db.env)).toBe(7 * DAY);
    await settleVersionRetention(db.env);
    expect(held(db)).toEqual([
      {
        max_age_ms: VERSION_RETENTION_LEGACY.maxAgeMs,
        max_count: VERSION_RETENTION_LEGACY.maxCount,
        max_bytes: VERSION_RETENTION_LEGACY.maxBytes,
      },
    ]);
  });
});

describe('learning the tier as requests arrive', () => {
  const ctxFor = (env: DocumentEnv, owner: string | null, waited: Promise<unknown>[]) => ({
    ...makeTestRouteContext('PUT', '/api/documents/D/tabs/t1', {
      owner: 'user_editor',
      env,
      grant: {
        item: 'D',
        level: 'edit',
        tab: null,
        sub: 'user_editor',
        team: null,
        ...(owner ? { owner } : {}),
        exp: 9_999_999_999,
        shareCode: null,
        token: 'signed',
      },
    }),
    env,
    waitUntil: (work: Promise<unknown>) => void waited.push(work),
  });

  it('does nothing at all with Pro off', () => {
    const db = setUp();
    const waited: Promise<unknown>[] = [];
    const { env, asked } = proEnv(db);
    learnVersionRetention(ctxFor({ ...env, PRO_ENABLED: '' }, account(), waited), NOW);
    expect(waited).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('asks once an hour per room, after the answer, and never the saver’s own tier', async () => {
    const db = setUp();
    const owner = account();
    const waited: Promise<unknown>[] = [];
    // The Editor saving is on Pro; the document is not theirs.
    const { env, asked } = proEnv(db, { 'p:user_editor': 'pro' });
    const ctx = ctxFor(env, owner, waited);
    expect(documentOwnerScope(ctx)).toBe(`p:${owner}`);
    learnVersionRetention(ctx, NOW);
    // A burst of saves in the hour asks nothing more.
    for (let n = 1; n <= 50; n += 1) learnVersionRetention(ctx, NOW + n * 600);
    expect(waited).toHaveLength(1);
    await Promise.all(waited);
    expect(asked).toEqual([`p:${owner}`]);
    expect(await versionMaxAgeMs(env)).toBe(7 * DAY);
    learnVersionRetention(ctx, NOW + VERSION_RETENTION_CHECK_MS);
    expect(waited).toHaveLength(2);
  });

  it('asks nothing for a grant that names no owner, or another document’s', async () => {
    const db = setUp();
    const waited: Promise<unknown>[] = [];
    const { env } = proEnv(db);
    learnVersionRetention(ctxFor(env, null, waited), NOW);
    const other = ctxFor(env, account(), waited);
    learnVersionRetention({ ...other, grant: { ...other.grant!, item: 'E' } }, NOW);
    expect(waited).toEqual([]);
    expect(documentOwnerScope({ ...other, segments: ['api', 'folders'] })).toBeUndefined();
  });

  it('only logs a write that fails, and runs without a waitUntil', async () => {
    const db = setUp();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const waited: Promise<unknown>[] = [];
    const { env } = proEnv(db);
    db.sql.exec('DROP TABLE version_retention');
    learnVersionRetention(ctxFor(env, account(), waited), NOW);
    await Promise.all(waited);
    expect(warn).toHaveBeenCalledWith('[versions] retention not learnt', expect.anything());
    // No row: the bounds every document had.
    db.sql.exec(
      'CREATE TABLE version_retention (id INTEGER PRIMARY KEY, max_age_ms INTEGER, max_count INTEGER, max_bytes INTEGER)',
    );
    expect(await versionMaxAgeMs(env)).toBe(VERSION_AUTO_MAX_AGE_MS);
    const bare = sqliteD1();
    const { waitUntil: _none, ...without } = ctxFor(proEnv(bare).env, account(), []);
    expect(() => learnVersionRetention(without, NOW)).not.toThrow();
  });
});

describe('the idle trigger’s version', () => {
  it('still lands and is held to the tier’s age', async () => {
    const db = setUp();
    await writeVersionRetention(db.env, versionRetentionOf(7));
    keep(db, 10);
    db.sql
      .prepare("UPDATE tabs SET data = '{\"a\":1}', updated_at = ?, rev = rev + 1 WHERE id = 't1'")
      .run(1000 + VERSION_IDLE_MS + NOW);
    const kinds = db.sql.prepare('SELECT kind FROM tab_versions').all();
    expect(kinds).toEqual([{ kind: 'idle' }]);
  });
});
