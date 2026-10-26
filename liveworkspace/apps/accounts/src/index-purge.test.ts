import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Auth } from './auth.ts';
import { deleteAccount } from './delete-account.ts';
import {
  purgeFromIndex,
  recordPendingPurge,
  retryPendingPurges,
  type IndexPurgeConfig,
} from './index-purge.ts';
import { createTeam, teamsClaim } from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';

const INDEX_URL = 'https://liveworkspace.app/api/index';

type Sent = { url: string; auth: string | null; body: unknown };

let db: D1Database;
let sql: DatabaseSync;
let sent: Sent[];
let answer: () => Response | Promise<Response>;

// The index, behind its service binding.
const indexService = {
  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({
      url: String(input),
      auth: new Headers(init.headers).get('authorization'),
      body: JSON.parse(String(init.body)),
    });
    return answer();
  },
} as unknown as Fetcher;

const config: IndexPurgeConfig = { indexUrl: INDEX_URL, indexService, indexKey: 'merge-key' };

const pending = () =>
  sql.prepare('SELECT userId, teamIds, attempts, lastError FROM pending_purges').all();

beforeEach(() => {
  ({ db, sql } = testD1());
  sent = [];
  answer = () => Response.json({ done: true, items: 3 });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('purgeFromIndex', () => {
  it("sends the request with accounts' key and clears it once the index has it", async () => {
    await recordPendingPurge(db, 'user_ada', ['team_1']);
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(true);
    expect(sent).toEqual([
      {
        url: `${INDEX_URL}/internal/purge-person`,
        auth: 'Bearer merge-key',
        body: { personId: 'user_ada', teamIds: ['team_1'] },
      },
    ]);
    expect(pending()).toEqual([]);
  });

  it('keeps the request, and says so, when the index refuses or is unreachable', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    answer = () => new Response(null, { status: 503 });
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(false);
    answer = () => Promise.reject(new TypeError('network'));
    expect(await purgeFromIndex(db, config, 'user_ada')).toBe(false);
    expect(pending()).toEqual([
      { userId: 'user_ada', teamIds: '[]', attempts: 2, lastError: 'TypeError' },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('keeps the request when the index is not set up', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    expect(await purgeFromIndex(db, {}, 'user_ada')).toBe(false);
    expect(sent).toEqual([]);
    expect(pending()).toMatchObject([{ lastError: 'index_not_configured' }]);
  });
});

describe('retryPendingPurges', () => {
  it('sends every waiting request again until the index takes it, louder the longer it fails', async () => {
    await recordPendingPurge(db, 'user_ada', []);
    await recordPendingPurge(db, 'user_bea', ['team_2']);
    answer = () => new Response(null, { status: 500 });
    for (let i = 0; i < 3; i++) {
      expect(await retryPendingPurges(db, config)).toEqual({ sent: 0, failed: 2, waiting: 2 });
    }
    // The third failure of each is an error, not a warning.
    expect(console.error).toHaveBeenCalledTimes(2);

    answer = () => Response.json({ done: false, items: 500 });
    expect(await retryPendingPurges(db, config)).toEqual({ sent: 2, failed: 0, waiting: 0 });
    expect(pending()).toEqual([]);
    expect(sent.at(-1)).toMatchObject({ body: { personId: 'user_bea', teamIds: ['team_2'] } });
    // Nothing waiting: nothing sent.
    sent = [];
    expect(await retryPendingPurges(db, config)).toEqual({ sent: 0, failed: 0, waiting: 0 });
    expect(sent).toEqual([]);
  });
});

describe('deleteAccount', () => {
  // Better Auth's part, stood in for: introspection says the token is Ada's, and deleting the user
  // deletes the row.
  const auth = {
    handler: async () => Response.json({ active: true, sub: 'user_ada', client_id: 'livediagram' }),
    $context: Promise.resolve({
      internalAdapter: {
        deleteUser: async (id: string) => {
          sql.prepare('DELETE FROM "user" WHERE id = ?').run(id);
        },
      },
    }),
  } as unknown as Auth;

  const close = () =>
    deleteAccount(
      new Request(
        'https://liveworkspace.app/api/auth/delete-account',
        {
          method: 'POST',
          headers: { authorization: `Basic ${btoa('livediagram:secret')}` },
          body: JSON.stringify({ token: 'access-token' }),
        },
      ),
      auth,
      db,
      config,
    );

  beforeEach(() => {
    addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
    addUser(sql, { id: 'user_bea', email: 'bea@example.com' });
  });

  it('tells the index, naming the teams that closed with the account', async () => {
    const solo = (await createTeam(db, { id: 'user_ada', email: 'ada@example.com' }, 'Solo')) as {
      ok: true;
      value: { id: string };
    };
    expect(await teamsClaim(db, 'user_ada')).toHaveLength(1);

    const res = await close();
    expect(await res.json()).toEqual({ deleted: true });
    expect(sent).toEqual([
      expect.objectContaining({ body: { personId: 'user_ada', teamIds: [solo.value.id] } }),
    ]);
    expect(pending()).toEqual([]);
    expect(sql.prepare('SELECT id FROM "user"').all()).toEqual([{ id: 'user_bea' }]);
  });

  it('disconnects the account’s Google Drive mirror once the account is gone', async () => {
    const disconnected: string[] = [];
    const res = await deleteAccount(
      new Request(
        'https://liveworkspace.app/api/auth/delete-account',
        {
          method: 'POST',
          headers: { authorization: `Basic ${btoa('livediagram:secret')}` },
          body: JSON.stringify({ token: 'access-token' }),
        },
      ),
      auth,
      db,
      config,
      async () => {},
      (userId) => {
        // The account is already closed when Drive is told.
        expect(sql.prepare('SELECT id FROM "user" WHERE id = ?').all(userId)).toEqual([]);
        disconnected.push(userId);
      },
    );
    expect(res.status).toBe(200);
    expect(disconnected).toEqual(['user_ada']);
  });

  it('still closes the account when the index is down, and leaves the purge for the cron', async () => {
    answer = () => new Response(null, { status: 502 });
    const res = await close();
    expect(res.status).toBe(200);
    expect(sql.prepare('SELECT id FROM "user" WHERE id = ?').all('user_ada')).toEqual([]);
    expect(pending()).toEqual([
      { userId: 'user_ada', teamIds: '[]', attempts: 1, lastError: 'status_502' },
    ]);

    answer = () => Response.json({ done: true, items: 0 });
    expect(await retryPendingPurges(db, config)).toMatchObject({ sent: 1, waiting: 0 });
  });
});
