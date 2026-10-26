import type { DatabaseSync } from 'node:sqlite';
import { LEGACY_GUEST_SIGNING_LIVE_AT } from '@liveworkspace/migration/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { readSettings, writeSettings } from './settings.ts';
import { addClient, addUser, testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
const INDEX_URL = `${BASE}/api/index`;
const SECRET = 'old-livediagram-guest-secret';
const DIAGRAM = `Basic ${btoa('livediagram:secret')}`;
const PLANNER = `Basic ${btoa('liveplanner:secret')}`;
const CLIENTS: Record<string, string> = { [DIAGRAM]: 'livediagram', [PLANNER]: 'liveplanner' };

const OLD = '0f8b5a2c-3d4e-4f60-8a1b-2c3d4e5f6a7b';
const LEGACY = `guest_${OLD}`;
const NEW_GUEST = 'guest_11111111-2222-4333-8444-555555555555';

// Stands in for Better Auth: introspection knows the two clients' credentials.
const auth = {
  api: { getSession: async () => null },
  handler: async (request: Request) =>
    CLIENTS[request.headers.get('authorization') ?? '']
      ? Response.json({ active: false })
      : new Response(null, { status: 401 }),
} as unknown as Auth;

let env: Env;
let sql: DatabaseSync;
let merges: { authorization: string | null; body: unknown }[];
let mergeStatus: number;

// The old site's signature, as its api minted it.
async function sign(id: string, secret = SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(id)));
  return btoa(String.fromCharCode(...mac))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function addLegacy(firstSeenAt: number, claimed?: { at: number; by: string }) {
  sql
    .prepare('INSERT INTO legacy_guest (id, firstSeenAt, claimedAt, claimedBy) VALUES (?, ?, ?, ?)')
    .run(LEGACY, firstSeenAt, claimed?.at ?? null, claimed?.by ?? null);
}

const row = () =>
  sql.prepare('SELECT claimedAt, claimedBy FROM legacy_guest WHERE id = ?').get(LEGACY) as {
    claimedAt: number | null;
    claimedBy: string | null;
  };

async function claim(body: unknown, client = DIAGRAM) {
  const response = await handleAccountApi(
    new Request(`${BASE}/api/account/internal/legacy-guests/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: client },
      body: JSON.stringify(body),
    }),
    env,
    auth,
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const BEFORE = LEGACY_GUEST_SIGNING_LIVE_AT - 1;
const AFTER = LEGACY_GUEST_SIGNING_LIVE_AT + 1;

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  addUser(sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addClient(sql, 'livediagram', 'livediagram.app');
  addClient(sql, 'liveplanner', 'liveplanner.app');
  merges = [];
  mergeStatus = 200;
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${INDEX_URL}/internal/merge`) {
      merges.push({
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body)),
      });
      return new Response('{"items":1}', { status: mergeStatus });
    }
    return new Response(null, { status: 404 });
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  env = {
    BASE_URL: BASE,
    ENVIRONMENT: 'production',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
    AUTH_DB: d1.db,
    INDEX_URL,
    INDEX_MERGE_KEY: 'merge-key',
    LEGACY_GUEST_ID_HMAC_SECRET: SECRET,
  } as unknown as Env;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('claiming a returning guest of the old livediagram.app', () => {
  it('merges a signed id into a new guest, legacy, and stamps it', async () => {
    addLegacy(AFTER);
    const answer = await claim({ legacyId: OLD, signature: await sign(OLD), into: NEW_GUEST });
    expect(answer).toEqual({ status: 200, body: { merged: true } });
    expect(merges).toEqual([
      {
        authorization: 'Bearer merge-key',
        body: { guestId: LEGACY, userId: NEW_GUEST, legacy: true },
      },
    ]);
    expect(row()).toEqual({ claimedAt: expect.any(Number), claimedBy: NEW_GUEST });
  });

  it('merges into an account, with the guest’s settings', async () => {
    addLegacy(AFTER);
    await writeSettings(env.AUTH_DB, LEGACY, 'livediagram.app', { all: { theme: 'light' } });
    const answer = await claim({ legacyId: OLD, signature: await sign(OLD), into: 'user_ada' });
    expect(answer.body).toEqual({ merged: true });
    expect(merges[0]!.body).toEqual({ guestId: LEGACY, userId: 'user_ada', legacy: true });
    expect((await readSettings(env.AUTH_DB, 'user_ada', 'livediagram.app')).all).toMatchObject({
      theme: 'light',
    });
  });

  it('takes an unsigned id the old site saw before signing went live', async () => {
    addLegacy(BEFORE);
    expect((await claim({ legacyId: OLD, signature: null, into: NEW_GUEST })).body).toEqual({
      merged: true,
    });
  });

  it('refuses an unsigned id from after signing went live, moving nothing', async () => {
    addLegacy(AFTER);
    expect(await claim({ legacyId: OLD, signature: null, into: NEW_GUEST })).toEqual({
      status: 403,
      body: { error: 'signature_required' },
    });
    expect(merges).toEqual([]);
    expect(row().claimedAt).toBeNull();
  });

  it('refuses a bad signature before reading anything', async () => {
    addLegacy(BEFORE);
    for (const signature of [await sign(OLD, 'another-secret'), await sign(`${OLD}x`), 'abc']) {
      expect(await claim({ legacyId: OLD, signature, into: NEW_GUEST })).toEqual({
        status: 403,
        body: { error: 'bad_signature' },
      });
    }
    expect(merges).toEqual([]);
  });

  it('answers unknown for an id that was never migrated', async () => {
    expect(
      (await claim({ legacyId: OLD, signature: await sign(OLD), into: NEW_GUEST })).body,
    ).toEqual({ merged: false, reason: 'unknown' });
    expect(merges).toEqual([]);
  });

  it('answers claimed for someone else, and merged again for the same caller', async () => {
    addLegacy(AFTER, { at: 5, by: 'user_ada' });
    const signature = await sign(OLD);
    expect((await claim({ legacyId: OLD, signature, into: NEW_GUEST })).body).toEqual({
      merged: false,
      reason: 'claimed',
    });
    expect((await claim({ legacyId: OLD, signature, into: 'user_ada' })).body).toEqual({
      merged: true,
    });
    expect(merges).toEqual([]);
    expect(row()).toEqual({ claimedAt: 5, claimedBy: 'user_ada' });
  });

  it('is idempotent: a retry after a claim merges nothing', async () => {
    addLegacy(AFTER);
    const body = { legacyId: OLD, signature: await sign(OLD), into: NEW_GUEST };
    expect((await claim(body)).body).toEqual({ merged: true });
    const first = row();
    expect((await claim(body)).body).toEqual({ merged: true });
    expect(merges).toHaveLength(1);
    expect(row()).toEqual(first);
  });

  it('stamps nothing when the index fails, so the next try merges again', async () => {
    addLegacy(AFTER);
    mergeStatus = 503;
    const body = { legacyId: OLD, signature: await sign(OLD), into: NEW_GUEST };
    expect(await claim(body)).toEqual({ status: 502, body: { error: 'merge_failed' } });
    expect(row().claimedAt).toBeNull();
    mergeStatus = 200;
    expect((await claim(body)).body).toEqual({ merged: true });
    expect(merges).toHaveLength(2);
  });

  it('lets only one of two claims at once merge, into one person', async () => {
    addLegacy(AFTER);
    const signature = await sign(OLD);
    // Hold every merge until both claims have started.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const inner = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      await held;
      return inner(input, init);
    });
    const first = claim({ legacyId: OLD, signature, into: NEW_GUEST });
    const second = claim({ legacyId: OLD, signature, into: 'user_ada' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    const answers = await Promise.all([first, second]);
    expect(merges).toHaveLength(1);
    expect(answers.filter((a) => a.body.merged === true)).toHaveLength(1);
    const winner = (merges[0]!.body as { userId: string }).userId;
    expect(row()).toEqual({ claimedAt: expect.any(Number), claimedBy: winner });
    // The other is told to come back, which keeps the old keys in its browser for a later load.
    const loser = answers.find((a) => a.body.merged !== true)!;
    expect(loser).toEqual({ status: 503, body: { error: 'claim_in_progress' } });
    // Coming back, it finds the id taken.
    const again = await claim({
      legacyId: OLD,
      signature,
      into: winner === NEW_GUEST ? 'user_ada' : NEW_GUEST,
    });
    expect(again.body).toEqual({ merged: false, reason: 'claimed' });
  });

  it('takes over a claim that never finished once its hold has run out', async () => {
    addLegacy(AFTER);
    sql
      .prepare('UPDATE legacy_guest SET claimingBy = ?, claimingUntil = ? WHERE id = ?')
      .run('user_ada', Date.now() - 1, LEGACY);
    const answer = await claim({ legacyId: OLD, signature: await sign(OLD), into: NEW_GUEST });
    expect(answer.body).toEqual({ merged: true });
    expect(row().claimedBy).toBe(NEW_GUEST);
  });

  it('checks the body', async () => {
    addLegacy(BEFORE);
    const signature = await sign(OLD);
    const cases: [unknown, string][] = [
      [{ legacyId: OLD.toUpperCase(), signature, into: NEW_GUEST }, 'invalid_legacy_id'],
      [{ legacyId: `guest_${OLD}`, signature, into: NEW_GUEST }, 'invalid_legacy_id'],
      // Not a v4 UUID.
      [
        { legacyId: OLD.replace('-4f60', '-1f60'), signature, into: NEW_GUEST },
        'invalid_legacy_id',
      ],
      [{ legacyId: OLD, signature: 7, into: NEW_GUEST }, 'invalid_signature'],
      [{ legacyId: OLD, signature, into: LEGACY }, 'invalid_into'],
      [{ legacyId: OLD, signature, into: 'someone' }, 'invalid_into'],
      [{ legacyId: OLD, signature }, 'invalid_into'],
    ];
    for (const [body, error] of cases) {
      expect(await claim(body)).toEqual({ status: 400, body: { error } });
    }
  });

  it('is livediagram’s alone, and a plain 404 without the secret', async () => {
    addLegacy(BEFORE);
    const body = { legacyId: OLD, signature: null, into: NEW_GUEST };
    expect(await claim(body, PLANNER)).toEqual({ status: 403, body: { error: 'wrong_app' } });
    expect((await claim(body, `Basic ${btoa('nobody:x')}`)).status).toBe(401);
    env.LEGACY_GUEST_ID_HMAC_SECRET = undefined;
    expect(await claim(body)).toEqual({ status: 404, body: { error: 'not_found' } });
    expect(merges).toEqual([]);
  });

  it('is limited per caller', async () => {
    addLegacy(BEFORE);
    const keys: string[] = [];
    env.LEGACY_GUEST_LIMITER = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: false };
      },
    } as unknown as RateLimit;
    expect(await claim({ legacyId: OLD, signature: null, into: NEW_GUEST })).toEqual({
      status: 429,
      body: { error: 'rate_limited' },
    });
    expect(keys).toEqual([`claim:${NEW_GUEST}`]);
    expect(merges).toEqual([]);
  });
});
