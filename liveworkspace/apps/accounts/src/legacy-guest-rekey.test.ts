import type { DatabaseSync } from 'node:sqlite';
import {
  LEGACY_GUEST_SIGNING_LIVE_AT,
  rekeyedLegacyGuestOwner,
} from '@liveworkspace/migration/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { claimLegacyGuest, legacyClaimConfig } from './legacy-guests.ts';
import { REKEY_BATCH_MAX, REKEY_PATH, rekeyLegacyGuests } from './legacy-guest-rekey.ts';
import { readSettings, writeSettings } from './settings.ts';
import { testD1 } from './test-d1.ts';

// liveworkspace/docs/specs/003-accounts/accounts.md "Re-keying".

const BASE = 'https://liveworkspace.app';
const INDEX_URL = `${BASE}/api/index`;
const ADMIN = 'admin-token';
const REKEY_SECRET = 'rekey-secret';
const BEFORE = LEGACY_GUEST_SIGNING_LIVE_AT - 1;
const AFTER = LEGACY_GUEST_SIGNING_LIVE_AT + 1;
const OLD = [
  '0f8b5a2c-3d4e-4f60-8a1b-2c3d4e5f6a7b',
  '1a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d',
  '2b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e',
];
const NEW_GUEST = 'guest_11111111-2222-4333-8444-555555555555';

let env: Env;
let sql: DatabaseSync;
let merges: { guestId: string; userId: string; legacy?: boolean }[];
let mergeStatus: number;

function addLegacy(old: string, firstSeenAt: number, patch: Record<string, unknown> = {}) {
  sql
    .prepare(
      `INSERT INTO legacy_guest (id, firstSeenAt, claimedAt, claimedBy, claimingBy, claimingUntil)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `guest_${old}`,
      firstSeenAt,
      (patch.claimedAt as number) ?? null,
      (patch.claimedBy as string) ?? null,
      (patch.claimingBy as string) ?? null,
      (patch.claimingUntil as number) ?? null,
    );
}

const rows = () =>
  sql
    .prepare(
      'SELECT id, claimedAt, claimingBy, claimingUntil, rekeyedAt FROM legacy_guest ORDER BY id',
    )
    .all() as {
    id: string;
    claimedAt: number | null;
    claimingBy: string | null;
    rekeyedAt: number | null;
  }[];

async function rekey(body: unknown, token = ADMIN) {
  const response = await rekeyLegacyGuests(
    new Request(`${BASE}${REKEY_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  merges = [];
  mergeStatus = 200;
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${INDEX_URL}/internal/merge`) {
      merges.push(JSON.parse(String(init?.body)));
      return new Response('{"items":1}', { status: mergeStatus });
    }
    return new Response(null, { status: 404 });
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  env = {
    BASE_URL: BASE,
    ENVIRONMENT: 'production',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
    ADMIN_TOKEN: ADMIN,
    AUTH_DB: d1.db,
    INDEX_URL,
    INDEX_MERGE_KEY: 'merge-key',
    LEGACY_GUEST_ID_HMAC_SECRET: 'old-signing-secret',
    LEGACY_GUEST_REKEY_SECRET: REKEY_SECRET,
  } as unknown as Env;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('re-keying the guests from before signing', () => {
  it('is a plain 404 without the secret, and needs the admin token', async () => {
    expect((await rekey({ dryRun: true }, 'wrong')).status).toBe(401);
    env.ADMIN_TOKEN = '';
    expect((await rekey({ dryRun: true })).status).toBe(401);
    env.LEGACY_GUEST_REKEY_SECRET = ' ';
    expect(await rekey({ dryRun: true })).toEqual({ status: 404, body: { error: 'not_found' } });
  });

  it('refuses a limit out of range', async () => {
    for (const limit of [0, REKEY_BATCH_MAX + 1, 1.5, '3']) {
      expect(await rekey({ limit }), String(limit)).toEqual({
        status: 400,
        body: { error: 'invalid_limit' },
      });
    }
  });

  it('counts in a dry run, with a sample that shows only the start of each old id, and moves nothing', async () => {
    addLegacy(OLD[0]!, BEFORE);
    addLegacy(OLD[1]!, BEFORE, { claimingBy: 'user_ada', claimingUntil: Date.now() + 60_000 });
    addLegacy(OLD[2]!, AFTER);
    sql
      .prepare(
        'INSERT INTO legacy_guest (id, firstSeenAt, claimedAt, claimedBy) VALUES (?, ?, 5, ?)',
      )
      .run('guest_3c4d5e6f-7a8b-4c3d-9e4f-5a6b7c8d9e0f', BEFORE, 'user_ada');
    const before = rows();
    const answer = await rekey({ dryRun: true });
    expect(answer).toEqual({
      status: 200,
      body: {
        rows: 4,
        claimed: 1,
        unclaimed: 3,
        signedOnly: 1,
        rekeyed: 0,
        toRekey: 2,
        held: 1,
        sample: [
          { from: 'guest_0f8b5a2c…', to: await rekeyedLegacyGuestOwner(OLD[0]!, REKEY_SECRET) },
          { from: 'guest_1a2b3c4d…', to: await rekeyedLegacyGuestOwner(OLD[1]!, REKEY_SECRET) },
        ],
      },
    });
    expect(JSON.stringify(answer.body)).not.toContain(OLD[0]);
    expect(merges).toEqual([]);
    expect(rows()).toEqual(before);
  });

  it('moves a guest’s work, settings and profile to the re-keyed id, after which only the bare id claims it', async () => {
    addLegacy(OLD[0]!, BEFORE);
    const from = `guest_${OLD[0]}`;
    const to = await rekeyedLegacyGuestOwner(OLD[0]!, REKEY_SECRET);
    await writeSettings(env.AUTH_DB, from, 'livediagram.app', { all: { theme: 'light' } });
    sql
      .prepare(
        `INSERT INTO profile (owner_id, name, color, created_at, updated_at) VALUES (?, 'Old Ada', '#ff0000', 1, 1)`,
      )
      .run(from);

    expect(await rekey({})).toEqual({
      status: 200,
      body: { rekeyed: 1, skipped: 0, failed: 0, remaining: 0 },
    });
    expect(merges).toEqual([{ guestId: from, userId: to, legacy: true }]);
    expect(rows()).toEqual([
      {
        id: to,
        claimedAt: null,
        claimingBy: null,
        claimingUntil: null,
        rekeyedAt: expect.any(Number),
      },
    ]);
    expect((await readSettings(env.AUTH_DB, to, 'livediagram.app')).all).toMatchObject({
      theme: 'light',
    });
    expect(sql.prepare('SELECT owner_id FROM profile').all()).toEqual([{ owner_id: to }]);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM settings WHERE owner_id = ?').get(from)).toEqual({
      n: 0,
    });

    // Run again: nothing left.
    expect((await rekey({})).body).toEqual({ rekeyed: 0, skipped: 0, failed: 0, remaining: 0 });
    expect(merges).toHaveLength(1);

    // The bare id, unsigned, claims it now; the id the index shows a visitor does not.
    const config = legacyClaimConfig(env, 'old-signing-secret');
    const visitor = await claimLegacyGuest(config, {
      legacyId: to.slice('guest_'.length),
      signature: null,
      into: 'user_eve',
    });
    expect(visitor).toEqual({ status: 200, body: { merged: false, reason: 'unknown' } });
    expect(
      await claimLegacyGuest(config, { legacyId: OLD[0], signature: null, into: NEW_GUEST }),
    ).toEqual({ status: 200, body: { merged: true } });
    expect(merges.at(-1)).toEqual({ guestId: to, userId: NEW_GUEST, legacy: true });
  });

  it('leaves claimed guests, guests from after signing and guests held by a claim', async () => {
    addLegacy(OLD[0]!, BEFORE, { claimedAt: 5, claimedBy: 'user_ada' });
    addLegacy(OLD[1]!, AFTER);
    addLegacy(OLD[2]!, BEFORE, { claimingBy: 'user_ada', claimingUntil: Date.now() + 60_000 });
    expect((await rekey({})).body).toEqual({ rekeyed: 0, skipped: 1, failed: 0, remaining: 1 });
    expect(merges).toEqual([]);
    expect(rows().map((r) => r.id)).toEqual(OLD.map((old) => `guest_${old}`));
    expect(rows()[2]!.claimingBy).toBe('user_ada');
  });

  it('takes a guest whose claim died midway once its hold has run out', async () => {
    addLegacy(OLD[0]!, BEFORE, { claimingBy: 'user_ada', claimingUntil: Date.now() - 1 });
    expect((await rekey({})).body).toMatchObject({ rekeyed: 1, remaining: 0 });
  });

  it('lets the hold go when the index fails, so the next run moves it', async () => {
    addLegacy(OLD[0]!, BEFORE);
    mergeStatus = 503;
    expect((await rekey({})).body).toEqual({ rekeyed: 0, skipped: 0, failed: 1, remaining: 1 });
    expect(rows()[0]).toMatchObject({ id: `guest_${OLD[0]}`, claimingBy: null, rekeyedAt: null });
    mergeStatus = 200;
    expect((await rekey({})).body).toMatchObject({ rekeyed: 1, remaining: 0 });
  });

  it('counts a row a claim stamped while its merge ran as failed, and renames nothing', async () => {
    addLegacy(OLD[0]!, BEFORE);
    vi.stubGlobal('fetch', async () => {
      // A signed claim took it meanwhile (its hold lapsed in a slow merge): the row is claimed and not ours.
      sql
        .prepare("UPDATE legacy_guest SET claimedAt = 9, claimedBy = 'user_ada', claimingBy = NULL")
        .run();
      return new Response('{"items":0}');
    });
    expect((await rekey({})).body).toEqual({ rekeyed: 0, skipped: 0, failed: 1, remaining: 1 });
    expect(rows()[0]).toMatchObject({ id: `guest_${OLD[0]}`, claimedAt: 9, rekeyedAt: null });
  });

  it('moves at most the limit, and says how many are left', async () => {
    for (const old of OLD) addLegacy(old, BEFORE);
    expect((await rekey({ limit: 2 })).body).toEqual({
      rekeyed: 2,
      skipped: 0,
      failed: 0,
      remaining: 1,
    });
    expect((await rekey({})).body).toMatchObject({ rekeyed: 1, remaining: 0 });
    expect(rows().every((r) => r.rekeyedAt !== null)).toBe(true);
  });
});
